/**
 * refundService.js
 * Phūrai Restaurant Management System
 *
 * Phase 1 — Processes deposit refunds for approved cancel requests.
 *
 * Rules:
 *  - Inserts a dbo.Payments row with payment_status='Refunded'
 *  - Emits a customer-facing Socket.IO notification
 *  - Logs to AuditLogs with 'DEPOSIT_REFUNDED' action
 *  - All writes inside a transaction passed by the caller
 *  - Fire-and-forget notification AFTER commit
 */

import pool from "../db.js";
import { getIO } from "../socket.js";

/**
 * Process a deposit refund for a cancelled reservation.
 *
 * @param {object} opts
 * @param {import('mysql2').PoolConnection} opts.connection - Active DB connection (must be in a transaction)
 * @param {number} opts.reservationId
 * @param {number} opts.managerId - User ID of the Manager authorising the refund
 * @param {number} opts.amount - Refund amount in VND
 * @param {string} opts.reason - Short description (stored in notes)
 * @param {number|null} opts.customerId - Customer user_id for socket emission (null for guest)
 * @param {string|null} opts.callerIp
 * @returns {Promise<{ paymentId: number }>}
 */
export async function processRefund({ connection, reservationId, managerId, amount, reason, customerId, callerIp }) {
  // 1. Determine the "Refund" payment method id (or use 1 as fallback)
  const [pmRows] = await connection.query(
    `SELECT payment_method_id FROM dbo.PaymentMethods WHERE method_name = N'Refund' AND is_active = 1`
  );
  const refundMethodId = pmRows.length > 0 ? pmRows[0].payment_method_id : 1;

  // 2. Insert Payments row with status = 'Refunded'
  const [insertResult] = await connection.query(
    `INSERT INTO dbo.Payments
       (reservation_id, payment_method_id, amount_paid, change_given, payment_status, notes, processed_by, created_at)
     VALUES
       (?, ?, ?, 0, N'Refunded', ?, ?, SYSDATETIME())`,
    [reservationId, refundMethodId, amount, reason || 'Deposit refund — cancel approved', managerId]
  );
  const paymentId = insertResult.insertId;

  // 3. Audit log
  await connection.query(
    `INSERT INTO dbo.AuditLogs
       (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
     VALUES
       (?, N'DEPOSIT_REFUNDED', N'Payments', ?, NULL, ?, ?, SYSDATETIME())`,
    [
      managerId,
      paymentId,
      JSON.stringify({ reservation_id: reservationId, amount, reason }),
      callerIp || null,
    ]
  );

  return { paymentId };
}

/**
 * Emit a customer-facing Socket.IO notification about a refund.
 * Called AFTER the transaction commits (fire-and-forget).
 */
export function emitRefundNotification({ customerId, reservationId, amount, decision }) {
  try {
    const io = getIO();
    if (!io) return;

    // To the customer's personal room (if logged-in customer)
    if (customerId) {
      io.to(`room:user:${customerId}`).emit("reservation:refund_processed", {
        reservation_id: reservationId,
        amount,
        decision,
        timestamp: new Date().toISOString(),
      });
    }

    // Also broadcast to Manager room for live dashboard update
    io.to("room:manager").emit("reservation:request_resolved", {
      reservation_id: reservationId,
      request_type: "cancel",
      decision,
    });
  } catch (err) {
    console.error("[emitRefundNotification] Socket emit failed:", err?.message);
  }
}
