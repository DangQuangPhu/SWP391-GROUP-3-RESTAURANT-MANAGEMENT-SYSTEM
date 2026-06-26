/**
 * reservationRequestService.js
 * Phūrai Restaurant Management System
 *
 * Flow B — Customer submits an edit or cancel request on a Confirmed booking.
 *
 * Rules enforced:
 *  - reservation_status stays 'Confirmed' throughout — never written as 'Request'
 *  - has_pending_request flag is the one and only pending indicator
 *  - edit_used_count is checked server-side; frontend disabled button is not trusted
 *  - pending_changes_json stores only the allow-listed diff, never full req.body
 *  - All writes are inside a transaction; audit log inserted on commit
 *  - Fire-and-forget socket emissions AFTER commit, never blocking
 */

import pool from "../db.js";
import { getIO } from "../socket.js";
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
]);

/**
 * Validate and sanitize the changes payload for an edit request.
 * Rejects any key not in the allow-list.
 * @param {Record<string,unknown>} changes
 * @returns {{ valid: boolean, sanitized: Record<string,unknown>, rejectedKeys: string[] }}
 */
function sanitizeEditChanges(changes) {
  const sanitized = {};
  const rejectedKeys = [];
  for (const [key, val] of Object.entries(changes || {})) {
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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // ── 2. Lock and read the current reservation row ────────────────────────
    const [rows] = await connection.query(
      `SELECT
         r.reservation_id,
         r.customer_id,
         r.reservation_status,
         r.has_pending_request,
         r.edit_used_count,
         r.request_type,
         COALESCE(ua.email, r.contact_email, '') AS recipient_email,
         COALESCE(ua.full_name, r.contact_name, N'Guest') AS recipient_name
       FROM dbo.Reservations r WITH (UPDLOCK, ROWLOCK)
       LEFT JOIN dbo.UserAccounts ua ON ua.user_id = r.customer_id
       WHERE r.reservation_id = ?`,
      [reservationId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, code: "NOT_FOUND", message: "Reservation not found." };
    }

    const r = rows[0];

    // ── 3. Ownership check ──────────────────────────────────────────────────
    if (customerId && r.customer_id !== customerId) {
      await connection.rollback();
      connection.release();
      return { success: false, code: "FORBIDDEN", message: "You do not own this reservation." };
    }

    // ── 4. State guard: must be Confirmed ───────────────────────────────────
    if (r.reservation_status !== "Confirmed") {
      await connection.rollback();
      connection.release();
      return {
        success: false,
        code: "INVALID_STATUS",
        message: `Edit requests can only be made on Confirmed bookings (current status: ${r.reservation_status}).`,
      };
    }

    // ── 5. One-edit cap (server-side) ───────────────────────────────────────
    if (r.edit_used_count >= 1) {
      await connection.rollback();
      connection.release();
      return {
        success: false,
        code: "EDIT_LIMIT_REACHED",
        message: "This reservation has already used its one allowed edit.",
      };
    }

    // ── 6. No concurrent pending request ────────────────────────────────────
    if (r.has_pending_request) {
      await connection.rollback();
      connection.release();
      return {
        success: false,
        code: "REQUEST_ALREADY_PENDING",
        message: "A request is already pending review for this booking. Please wait for it to be resolved.",
      };
    }

    // ── 7. Write the pending request ────────────────────────────────────────
    await connection.query(
      `UPDATE dbo.Reservations
       SET has_pending_request  = 1,
           pending_changes_json = ?,
           request_type         = N'edit',
           edit_used_count      = edit_used_count + 1,
           updated_at           = SYSDATETIME()
       WHERE reservation_id = ?`,
      [JSON.stringify(sanitized), reservationId]
    );

    // ── 8. Audit log ────────────────────────────────────────────────────────
    const auditPayload = buildSanitizedAuditPayload(sanitized);
    await connection.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'CUSTOMER_EDIT_REQUEST', N'Reservations', ?, NULL, ?, ?, SYSDATETIME())`,
      [
        customerId || null,
        reservationId,
        JSON.stringify(auditPayload),
        callerIp || null,
      ]
    );

    await connection.commit();
    connection.release();

    // ── 9. Fire-and-forget: notify Manager portal ──────────────────────────
    const io = getIO();
    if (io) {
      io.to("room:manager").emit("reservation:edit_requested", {
        reservation_id: reservationId,
        request_type: "edit",
        requested_changes: sanitized,
      });
    }

    sendEditRequestReceivedEmail({
      toEmail: r.recipient_email,
      customerName: r.recipient_name,
      reservationId,
    }).catch(e => console.error("[submitEditRequest] Email failed:", e?.message));

    return { success: true };
  } catch (err) {
    try { await connection.rollback(); } catch { /* ignore */ }
    connection.release();
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT
         r.reservation_id,
         r.customer_id,
         r.reservation_status,
         r.has_pending_request,
         COALESCE(ua.email, r.contact_email, '') AS recipient_email,
         COALESCE(ua.full_name, r.contact_name, N'Guest') AS recipient_name
       FROM dbo.Reservations r WITH (UPDLOCK, ROWLOCK)
       LEFT JOIN dbo.UserAccounts ua ON ua.user_id = r.customer_id
       WHERE r.reservation_id = ?`,
      [reservationId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, code: "NOT_FOUND", message: "Reservation not found." };
    }

    const r = rows[0];

    if (customerId && r.customer_id !== customerId) {
      await connection.rollback();
      connection.release();
      return { success: false, code: "FORBIDDEN", message: "You do not own this reservation." };
    }

    if (r.reservation_status !== "Confirmed") {
      await connection.rollback();
      connection.release();
      return {
        success: false,
        code: "INVALID_STATUS",
        message: `Cancel requests can only be made on Confirmed bookings (current status: ${r.reservation_status}).`,
      };
    }

    if (r.has_pending_request) {
      await connection.rollback();
      connection.release();
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

    await connection.query(
      `UPDATE dbo.Reservations
       SET has_pending_request  = 1,
           pending_changes_json = ?,
           request_type         = N'cancel',
           updated_at           = SYSDATETIME()
       WHERE reservation_id = ?`,
      [requestPayload, reservationId]
    );

    await connection.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'CUSTOMER_CANCEL_REQUEST', N'Reservations', ?, NULL, ?, ?, SYSDATETIME())`,
      [
        customerId || null,
        reservationId,
        requestPayload,
        callerIp || null,
      ]
    );

    await connection.commit();
    connection.release();

    const io = getIO();
    if (io) {
      io.to("room:manager").emit("reservation:cancel_requested", {
        reservation_id: reservationId,
        request_type: "cancel",
        cancel_reason: cancelReason || null,
      });
    }

    sendCancelRequestReceivedEmail({
      toEmail: r.recipient_email,
      customerName: r.recipient_name,
      reservationId,
    }).catch(e => console.error("[submitCancelRequest] Email failed:", e?.message));

    return { success: true };
  } catch (err) {
    try { await connection.rollback(); } catch { /* ignore */ }
    connection.release();
    console.error("[submitCancelRequest] Transaction failed:", err);
    throw err;
  }
}
