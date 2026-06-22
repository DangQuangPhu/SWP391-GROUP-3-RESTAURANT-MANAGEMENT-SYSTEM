/**
 * resolveRequestService.js
 * Phūrai Restaurant Management System
 *
 * Flow C — Manager resolves a pending edit or cancel request.
 *
 * Implements the exact 5-step transaction from spec Section 1.4 for edit requests,
 * and the cancel resolution flow from Q3 decisions.
 *
 * Key rules:
 *  - reservation_status NEVER stores 'Request' — it's display-only
 *  - edit_used_count is NOT incremented here (already incremented in Flow B)
 *  - On decline: booking is completely unchanged, only flag cleared
 *  - On cancel-process: table released, status set to 'Cancelled'
 *  - All side-effects (email, socket) are fire-and-forget AFTER commit
 *  - dbo.Payments: manual attestation only (TODO: wire to Payments table if needed)
 */

import pool from "../db.js";
import { getIO } from "../socket.js";
import {
  sendCancelConfirmedEmail,
  sendCancelRejectedEmail,
} from "../email.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Resolve a cancel request.
 *
 * PATCH /api/manager/reservations/:id/resolve-cancel
 *
 * @param {number} reservationId
 * @param {number} managerId
 * @param {'process'|'reject'} decision
 * @param {string} callerIp
 */
export async function resolveCancelRequest(reservationId, managerId, decision, callerIp) {
  if (decision !== "process" && decision !== "reject") {
    return { success: false, code: "INVALID_DECISION", message: "Decision must be 'process' or 'reject'." };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT
         r.reservation_id,
         r.reservation_status,
         r.has_pending_request,
         r.request_type,
         r.pending_changes_json,
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

    if (!r.has_pending_request || r.request_type !== "cancel") {
      await connection.rollback();
      connection.release();
      return {
        success: false,
        code: "NO_PENDING_CANCEL_REQUEST",
        message: "This reservation does not have a pending cancel request.",
      };
    }

    // ── REJECT cancellation ──────────────────────────────────────────────────
    if (decision === "reject") {
      await connection.query(
        `UPDATE dbo.Reservations
         SET has_pending_request  = 0,
             pending_changes_json = NULL,
             request_type         = NULL,
             resolved_at          = SYSDATETIME(),
             resolved_by          = ?,
             updated_at           = SYSDATETIME()
         WHERE reservation_id = ?`,
        [managerId, reservationId]
      );

      await connection.query(
        `INSERT INTO dbo.AuditLogs
           (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
         VALUES (?, N'MANAGER_REJECT_CANCELLATION', N'Reservations', ?, NULL, NULL, ?, SYSDATETIME())`,
        [managerId, reservationId, callerIp || null]
      );

      await connection.commit();
      connection.release();

      sendCancelRejectedEmail({
        toEmail: r.recipient_email,
        customerName: r.recipient_name,
        reservationId,
      }).catch((e) => console.error("[resolveCancelRequest/reject] Email failed:", e?.message));

      const io = getIO();
      if (io) {
        io.to("room:manager").emit("reservation:request_resolved", {
          reservation_id: reservationId, decision: "reject", request_type: "cancel",
        });
      }

      return { success: true, decision: "reject" };
    }

    // ── PROCESS refund & cancel ──────────────────────────────────────────────
    // 1. Transition reservation to Cancelled
    await connection.query(
      `UPDATE dbo.Reservations
       SET reservation_status   = N'Cancelled',
           has_pending_request  = 0,
           pending_changes_json = NULL,
           request_type         = NULL,
           cancelled_at         = SYSDATETIME(),
           cancel_reason        = N'Customer cancellation request approved',
           resolved_at          = SYSDATETIME(),
           resolved_by          = ?,
           updated_at           = SYSDATETIME()
       WHERE reservation_id = ?`,
      [managerId, reservationId]
    );

    // 2. Release assigned tables back to Available
    await connection.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Available',
           updated_at   = SYSDATETIME()
       WHERE table_id IN (
         SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = ?
       )`,
      [reservationId]
    );

    // NOTE: dbo.Payments refund is handled as a manual attestation by the manager
    // in this implementation. Wire to Payments table if payment gateway is integrated.

    // 3. Audit log
    await connection.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'MANAGER_PROCESS_CANCELLATION', N'Reservations', ?, NULL, ?, ?, SYSDATETIME())`,
      [
        managerId,
        reservationId,
        JSON.stringify({ refund_confirmed: true, cancelled_at: new Date().toISOString() }),
        callerIp || null,
      ]
    );

    await connection.commit();
    connection.release();

    // 4. Fire-and-forget
    sendCancelConfirmedEmail({
      toEmail: r.recipient_email,
      customerName: r.recipient_name,
      reservationId,
    }).catch((e) => console.error("[resolveCancelRequest/process] Email failed:", e?.message));

    const io = getIO();
    if (io) {
      io.to("room:manager").emit("reservation:request_resolved", {
        reservation_id: reservationId, decision: "process", request_type: "cancel",
      });
      io.emit("reservation:request_resolved", {
        reservation_id: reservationId, decision: "process", request_type: "cancel",
      });
    }

    return { success: true, decision: "process" };
  } catch (err) {
    try { await connection.rollback(); } catch { /* ignore */ }
    connection.release();
    console.error("[resolveCancelRequest] Transaction failed:", err);
    throw err;
  }
}
