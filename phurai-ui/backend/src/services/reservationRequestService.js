/**
 * reservationRequestService.js
 * Phūrai Restaurant Management System
 *
 * Flow A — Customer submits an edit request on a Confirmed booking.
 * Flow B — Customer submits a cancel request on a Confirmed booking.
 *
 * Rules enforced:
 *  - Uses mssql (sql.Transaction + pool.request()) — NOT mysql2 API
 *  - reservation_status stays 'Confirmed'/'Await Check-in' throughout
 *  - ReservationChangeRequests is the one source of truth for pending requests
 *  - edit_used_count is checked server-side; frontend disabled button is not trusted
 *  - pending_changes_json stores only the allow-listed diff, never full req.body
 *  - All writes are inside a transaction; audit log inserted on commit
 *  - Fire-and-forget socket emissions AFTER commit, never blocking
 */

import sql from "mssql";
import { getRawPool } from "../db.js";
import { getIO } from "../socket.js";
import { notifyStaffNewCustomerAction } from "./notificationService.js";
import { buildSanitizedAuditPayload } from "../utils/auditSanitizer.js";
import {
  sendEditRequestReceivedEmail,
  sendCancelRequestReceivedEmail,
} from "../email.js";

// Allow-list for fields a customer may include in an edit request.
const EDIT_REQUEST_ALLOWED_FIELDS = new Set([
  "reservation_start_at",
  "reservation_end_at",
  "guest_count",
  "special_request",
  "contact_phone",
  "preorder_items",
  "dining_purpose",
  "table_ids",
]);

const REQUESTABLE_STATUSES = new Set([
  "Confirmed",
  "Await Check-in",
  "AWAIT CHECK-IN",
  "Reserved",
  "Awaiting Deposit",
  "Pending Payment",
  "Pending Request",
]);

function isRequestableStatus(status) {
  return REQUESTABLE_STATUSES.has(String(status || "").trim());
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getFirstRequestedTableId(changes) {
  const ids = Array.isArray(changes?.table_ids) ? changes.table_ids : [];
  const first = Number(ids[0]);
  return Number.isFinite(first) && first > 0 ? first : null;
}

function getRequestedDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRequestedPartySize(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function inferEditRequestType(changes) {
  if (getFirstRequestedTableId(changes)) return "TableChange";
  if (changes?.reservation_start_at || changes?.reservation_end_at) return "TimeChange";
  if (changes?.guest_count) return "PartySizeChange";
  return "edit";
}

function customerOwnsReservation(row, customerId) {
  const numericCustomerId = Number(customerId);
  if (!Number.isFinite(numericCustomerId) || numericCustomerId <= 0) {
    return false;
  }

  if (Number(row.customer_id) === numericCustomerId) {
    return true;
  }

  const requesterEmail = normalizeEmail(row.requester_email);
  const reservationEmail = normalizeEmail(row.contact_email || row.recipient_email);

  return !row.customer_id && requesterEmail && reservationEmail && requesterEmail === reservationEmail;
}

/**
 * Validate and sanitize the changes payload for an edit request.
 * Rejects any key not in the allow-list.
 * @param {Record<string,unknown>} changes
 * @returns {{ valid: boolean, sanitized: Record<string,unknown>, rejectedKeys: string[] }}
 */
function sanitizeEditChanges(changes) {
  const sanitized = {};
  const rejectedKeys = [];
  
  const normalisedChanges = { ...changes };

  for (const [key, val] of Object.entries(normalisedChanges || {})) {
    if (EDIT_REQUEST_ALLOWED_FIELDS.has(key)) {
      sanitized[key] = val;
    } else {
      rejectedKeys.push(key);
    }
  }

  return {
    valid: Object.keys(sanitized).length > 0,
    sanitized,
    rejectedKeys,
  };
}

/**
 * Submit an edit request for an existing Confirmed booking.
 *
 * POST /api/reservations/:id/request-edit
 *
 * @param {number} reservationId
 * @param {number|null} customerId - null for guests (validated against contact_email)
 * @param {Record<string,unknown>} changes - fields the customer wants to change
 * @param {string} callerIp
 * @returns {Promise<{success: boolean, message?: string, code?: string}>}
 */
export async function submitEditRequest(reservationId, customerId, changes, callerIp) {
  // ── 1. Validate & sanitize changes ─────────────────────────────────────────
  const { valid, sanitized, rejectedKeys } = sanitizeEditChanges(changes);
  if (!valid) {
    return {
      success: false,
      code: "NO_VALID_CHANGES",
      message: "No valid fields provided for the edit request.",
    };
  }
  if (rejectedKeys.length > 0) {
    return {
      success: false,
      code: "INVALID_FIELDS",
      message: `These fields cannot be changed via an edit request: ${rejectedKeys.join(", ")}.`,
    };
  }

  const pool = await getRawPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // ── 2. Lock and read the current reservation row ────────────────────────
    const readResult = await transaction.request()
      .input("customerId", sql.Int, customerId || null)
      .input("reservationId", sql.Int, reservationId)
      .query(`
        SELECT
          r.reservation_id,
          r.customer_id,
          r.reservation_status,
          CASE WHEN EXISTS (
            SELECT 1
            FROM dbo.ReservationChangeRequests rcr
            WHERE rcr.reservation_id = r.reservation_id
              AND rcr.request_status = N'Pending'
          ) THEN 1 ELSE 0 END AS has_pending_request,
          r.edit_used_count,
          r.request_type,
          r.contact_email,
          (SELECT TOP 1 email FROM dbo.UserAccounts WHERE user_id = @customerId) AS requester_email,
          COALESCE(ua.email, r.contact_email, '') AS recipient_email,
          COALESCE(ua.full_name, r.contact_name, N'Guest') AS recipient_name
        FROM dbo.Reservations r WITH (UPDLOCK, ROWLOCK)
        LEFT JOIN dbo.UserAccounts ua ON ua.user_id = r.customer_id
        WHERE r.reservation_id = @reservationId
      `);

    if (readResult.recordset.length === 0) {
      await transaction.rollback();
      return { success: false, code: "NOT_FOUND", message: "Reservation not found." };
    }

    const r = readResult.recordset[0];

    // ── 3. Ownership check ──────────────────────────────────────────────────
    if (!customerOwnsReservation(r, customerId)) {
      await transaction.rollback();
      return { success: false, code: "FORBIDDEN", message: "You do not own this reservation." };
    }

    // ── 4. State guard: must be Confirmed or AWAIT CHECK-IN ─────────────────
    if (!isRequestableStatus(r.reservation_status)) {
      await transaction.rollback();
      return {
        success: false,
        code: "INVALID_STATUS",
        message: `Edit requests can only be made on Confirmed bookings (current status: ${r.reservation_status}).`,
      };
    }

    // ── 5. One-edit cap (server-side) ───────────────────────────────────────
    if (r.edit_used_count >= 1) {
      await transaction.rollback();
      return {
        success: false,
        code: "EDIT_LIMIT_REACHED",
        message: "This reservation has already used its one allowed edit.",
      };
    }

    // ── 6. No concurrent pending request ────────────────────────────────────
    if (r.has_pending_request) {
      await transaction.rollback();
      return {
        success: false,
        code: "REQUEST_ALREADY_PENDING",
        message: "A request is already pending review for this booking. Please wait for it to be resolved.",
      };
    }

    // ── 7. Write the pending request ────────────────────────────────────────
    await transaction.request()
      .input("changesJson", sql.NVarChar(sql.MAX), JSON.stringify(sanitized))
      .input("reservationId", sql.Int, reservationId)
      .query(`
        UPDATE dbo.Reservations
        SET pending_changes_json = @changesJson,
            request_type         = N'edit',
            edit_used_count      = edit_used_count + 1,
            updated_at           = SYSDATETIME()
        WHERE reservation_id = @reservationId
      `);

    const requestType = inferEditRequestType(sanitized);
    const reasonPayload = JSON.stringify({
      changes: sanitized,
      source: "customer_portal",
    });
    const changeRequestResult = await transaction.request()
      .input("reservationId", sql.Int, reservationId)
      .input("customerId", sql.Int, customerId || null)
      .input("contactEmail", sql.NVarChar(255), r.contact_email || r.recipient_email || null)
      .input("requestType", sql.NVarChar(30), requestType)
      .input("requestedTableId", sql.Int, getFirstRequestedTableId(sanitized))
      .input("requestedStartAt", sql.DateTime2, getRequestedDate(sanitized.reservation_start_at))
      .input("requestedEndAt", sql.DateTime2, getRequestedDate(sanitized.reservation_end_at))
      .input("requestedPartySize", sql.Int, getRequestedPartySize(sanitized.guest_count))
      .input("reason", sql.NVarChar(sql.MAX), reasonPayload)
      .query(`
        INSERT INTO dbo.ReservationChangeRequests
          (reservation_id, requested_by_customer_id, requested_by_contact_email, request_type,
           requested_table_id, requested_start_at, requested_end_at, requested_party_size,
           reason, request_status, requires_financial_approval, created_at)
        OUTPUT inserted.request_id
        VALUES
          (@reservationId, @customerId, @contactEmail, @requestType,
           @requestedTableId, @requestedStartAt, @requestedEndAt, @requestedPartySize,
           @reason, N'Pending', 0, SYSDATETIME())
      `);
    const requestId = changeRequestResult.recordset?.[0]?.request_id || null;

    // ── 8. Audit log ────────────────────────────────────────────────────────
    const auditPayload = buildSanitizedAuditPayload(sanitized);
    await transaction.request()
      .input("userId", sql.Int, customerId || null)
      .input("reservationId", sql.Int, reservationId)
      .input("auditJson", sql.NVarChar(sql.MAX), JSON.stringify(auditPayload))
      .input("ipAddress", sql.VarChar(50), callerIp || null)
      .query(`
        INSERT INTO dbo.AuditLogs
          (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
        VALUES (@userId, N'CUSTOMER_EDIT_REQUEST', N'Reservations', @reservationId, NULL, @auditJson, @ipAddress, SYSDATETIME())
      `);

    await transaction.commit();

    // ── 9. Fire-and-forget: notify Manager portal ──────────────────────────
    try {
      const io = getIO();
      if (io) {
        const payload = {
          reservation_id: reservationId,
          request_id: requestId,
          request_type: "edit",
          workflow_type: requestType,
          requested_changes: sanitized,
        };
        io.to("room:staff").emit("reservation:edit_requested", payload);
        io.to("room:manager").emit("reservation:edit_requested", payload);
        io.to("room:staff").emit("reservation:request_pending", payload);
        io.to("room:manager").emit("reservation:request_pending", payload);
      }

      notifyStaffNewCustomerAction({
        actionType: "change_request",
        title: "New Change Request Submitted 📝",
        message: `Customer ${r.recipient_name || "Guest"} submitted a change request for reservation #${String(reservationId).padStart(6, "0")}.`,
        payload: { reservation_id: reservationId, request_id: requestId, request_type: "edit" }
      }).catch((e) => console.error("[submitEditRequest] Staff notification failed:", e?.message));
    } catch (emitErr) {
      console.error("[submitEditRequest] Socket emit failed:", emitErr?.message);
    }

    Promise.resolve(
      sendEditRequestReceivedEmail({
        toEmail: r.recipient_email,
        customerName: r.recipient_name,
        reservationId,
      })
    ).catch(e => console.error("[submitEditRequest] Email failed:", e?.message));

    return { success: true, request_id: requestId };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* ignore */ }
    console.error("[submitEditRequest] Transaction failed:", err);
    throw err;
  }
}

/**
 * Submit a cancellation request for a Confirmed booking.
 * The booking stays Confirmed and the table stays Reserved until Manager acts.
 *
 * POST /api/reservations/:id/request-cancel
 *
 * @param {number} reservationId
 * @param {number|null} customerId
 * @param {string|null} cancelReason - optional free text from customer
 * @param {string} callerIp
 * @returns {Promise<{success: boolean, message?: string, code?: string}>}
 */
export async function submitCancelRequest(reservationId, customerId, cancelReason, callerIp) {
  const pool = await getRawPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const readResult = await transaction.request()
      .input("customerId", sql.Int, customerId || null)
      .input("reservationId", sql.Int, reservationId)
      .query(`
        SELECT
          r.reservation_id,
          r.customer_id,
          r.reservation_status,
          CASE WHEN EXISTS (
            SELECT 1
            FROM dbo.ReservationChangeRequests rcr
            WHERE rcr.reservation_id = r.reservation_id
              AND rcr.request_status = N'Pending'
          ) THEN 1 ELSE 0 END AS has_pending_request,
          r.contact_email,
          (SELECT TOP 1 email FROM dbo.UserAccounts WHERE user_id = @customerId) AS requester_email,
          COALESCE(ua.email, r.contact_email, '') AS recipient_email,
          COALESCE(ua.full_name, r.contact_name, N'Guest') AS recipient_name
        FROM dbo.Reservations r WITH (UPDLOCK, ROWLOCK)
        LEFT JOIN dbo.UserAccounts ua ON ua.user_id = r.customer_id
        WHERE r.reservation_id = @reservationId
      `);

    if (readResult.recordset.length === 0) {
      await transaction.rollback();
      return { success: false, code: "NOT_FOUND", message: "Reservation not found." };
    }

    const r = readResult.recordset[0];

    if (!customerOwnsReservation(r, customerId)) {
      await transaction.rollback();
      return { success: false, code: "FORBIDDEN", message: "You do not own this reservation." };
    }

    if (!isRequestableStatus(r.reservation_status)) {
      await transaction.rollback();
      return {
        success: false,
        code: "INVALID_STATUS",
        message: `Cancel requests can only be made on Confirmed bookings (current status: ${r.reservation_status}).`,
      };
    }

    if (r.has_pending_request) {
      await transaction.rollback();
      return {
        success: false,
        code: "REQUEST_ALREADY_PENDING",
        message: "A request is already pending review. Please wait for it to be resolved.",
      };
    }

    // Store cancel reason in pending_changes_json
    const requestPayload = cancelReason
      ? JSON.stringify({ cancel_reason: String(cancelReason).slice(0, 500) })
      : null;

    await transaction.request()
      .input("requestPayload", sql.NVarChar(sql.MAX), requestPayload)
      .input("reservationId", sql.Int, reservationId)
      .query(`
        UPDATE dbo.Reservations
        SET pending_changes_json = @requestPayload,
            request_type         = N'cancel',
            updated_at           = SYSDATETIME()
        WHERE reservation_id = @reservationId
      `);

    const changeRequestResult = await transaction.request()
      .input("reservationId", sql.Int, reservationId)
      .input("customerId", sql.Int, customerId || null)
      .input("contactEmail", sql.NVarChar(255), r.contact_email || r.recipient_email || null)
      .input("reason", sql.NVarChar(sql.MAX), requestPayload)
      .query(`
        INSERT INTO dbo.ReservationChangeRequests
          (reservation_id, requested_by_customer_id, requested_by_contact_email, request_type,
           reason, request_status, requires_financial_approval, created_at)
        OUTPUT inserted.request_id
        VALUES
          (@reservationId, @customerId, @contactEmail, N'Cancel',
           @reason, N'Pending', 1, SYSDATETIME())
      `);
    const requestId = changeRequestResult.recordset?.[0]?.request_id || null;

    await transaction.request()
      .input("userId", sql.Int, customerId || null)
      .input("reservationId", sql.Int, reservationId)
      .input("requestPayload", sql.NVarChar(sql.MAX), requestPayload)
      .input("ipAddress", sql.VarChar(50), callerIp || null)
      .query(`
        INSERT INTO dbo.AuditLogs
          (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
        VALUES (@userId, N'CUSTOMER_CANCEL_REQUEST', N'Reservations', @reservationId, NULL, @requestPayload, @ipAddress, SYSDATETIME())
      `);

    await transaction.commit();

    try {
      const io = getIO();
      if (io) {
        const payload = {
          reservation_id: reservationId,
          request_id: requestId,
          request_type: "cancel",
          cancel_reason: cancelReason || null,
        };
        io.to("room:staff").emit("reservation:cancel_requested", payload);
        io.to("room:manager").emit("reservation:cancel_requested", payload);
        io.to("room:staff").emit("reservation:request_pending", payload);
        io.to("room:manager").emit("reservation:request_pending", payload);
      }

      notifyStaffNewCustomerAction({
        actionType: "cancellation_request",
        title: "Reservation Cancellation Requested ⚠️",
        message: `Customer ${r.recipient_name || "Guest"} requested cancellation for reservation #${String(reservationId).padStart(6, "0")}.`,
        payload: { reservation_id: reservationId, request_id: requestId, request_type: "cancel" }
      }).catch((e) => console.error("[submitCancelRequest] Staff notification failed:", e?.message));
    } catch (emitErr) {
      console.error("[submitCancelRequest] Socket emit failed:", emitErr?.message);
    }

    Promise.resolve(
      sendCancelRequestReceivedEmail({
        toEmail: r.recipient_email,
        customerName: r.recipient_name,
        reservationId,
      })
    ).catch(e => console.error("[submitCancelRequest] Email failed:", e?.message));

    return { success: true, request_id: requestId };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* ignore */ }
    console.error("[submitCancelRequest] Transaction failed:", err);
    throw err;
  }
}
