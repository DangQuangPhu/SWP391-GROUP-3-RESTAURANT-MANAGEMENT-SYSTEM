/**
 * managerReservationController.js
 * Phūrai Restaurant Management System — Manager Reservation Module
 *
 * Rules enforced:
 *  - NO OUTPUT INSERTED.* (SQL Server trigger conflict prevention)
 *  - All writes use sql.Transaction with explicit rollback on failure
 *  - External services (Socket.IO, Email) run in a SEPARATE try/catch AFTER commit()
 *  - COALESCE(ua.field, r.guest_field) is used everywhere for guest/member data
 *  - Column names match System_Restaurant.sql exactly:
 *    guest_name, guest_phone, guest_email, special_request, updated_at
 */

import pool, { getRawPool } from "../db.js";
import sql from "mssql";
import { getIO } from "../socket.js";
import { resolveShift } from "../services/shiftResolver.js";
import { sendBookingConfirmationEmail, sendBookingEditedEmail, sendManagerCancelledEmail, sendEditConfirmedEmail, sendEditRejectedEmail } from "../email.js";
import { updateReservationStatus } from "../services/reservationStateService.js";
import { RESERVATION_STATUS } from "../../../frontend/src/shared/reservationStatus.js";

// ============================================================================
// STATE MACHINE CONSTANTS (must match CK_Reservations_status in SQL)
// ============================================================================
// We import RESERVATION_STATUS from shared instead of defining it here.

export const TABLE_STATUS = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
};

// ============================================================================
// GET /api/manager/reservations/pending
// ============================================================================
export const getPendingReservations = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.reservation_id,
         COALESCE(ua.full_name, r.contact_name, N'Guest')   AS customer_name,
         COALESCE(ua.phone,    r.contact_phone, N'')         AS customer_phone,
         COALESCE(ua.email,    r.contact_email, N'')         AS customer_email,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         r.reservation_source,
         r.created_at,
         r.preferred_area_id,
         a.area_name AS preferred_area,
         STRING_AGG(t.table_number, ', ') AS assigned_tables
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
       LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
       LEFT JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
       WHERE r.reservation_status = N'Pending Request'
       GROUP BY
         r.reservation_id, ua.full_name, r.contact_name, ua.phone, r.contact_phone,
         ua.email, r.contact_email, r.reservation_start_at, r.reservation_end_at,
         r.guest_count, r.special_request, r.reservation_status, r.reservation_source,
         r.created_at, r.preferred_area_id, a.area_name
       ORDER BY r.reservation_start_at ASC`
    );
    res.json({ success: true, reservations: rows });
  } catch (error) {
    console.error("[CRITICAL BACKEND ERROR]: getPendingReservations:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// GET /api/manager/reservations/all
// ============================================================================
export const getAllReservations = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.reservation_id,
         r.customer_id,
         COALESCE(ua.full_name, r.contact_name, N'Guest')   AS customer_name,
         COALESCE(ua.phone,    r.contact_phone, N'')         AS customer_phone,
         COALESCE(ua.email,    r.contact_email, N'')         AS customer_email,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         CASE WHEN r.has_pending_request = 1
              THEN N'Request'
              ELSE r.reservation_status
         END AS display_status,
         r.has_pending_request,
         r.request_type,
         r.edit_used_count,
         r.pending_changes_json,
         r.reservation_source,
         r.created_at,
         r.confirmed_at,
         r.checked_in_at,
         r.cancelled_at,
         r.cancel_reason,
         r.resolved_at,
         a.area_name AS preferred_area,
         STRING_AGG(t.table_number, ', ') AS assigned_tables
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.CustomerProfiles cp ON r.customer_id = cp.user_id
       LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
       LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
       LEFT JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
       GROUP BY
         r.reservation_id, r.customer_id, ua.full_name, r.contact_name, ua.phone, r.contact_phone,
         ua.email, r.contact_email, r.reservation_start_at, r.reservation_end_at,
         r.guest_count, r.special_request, r.reservation_status, r.reservation_source,
         r.created_at, r.confirmed_at, r.checked_in_at, r.cancelled_at,
         r.cancel_reason, r.resolved_at, a.area_name,
         r.has_pending_request, r.request_type, r.edit_used_count, r.pending_changes_json
       ORDER BY 
         CASE r.reservation_status
           WHEN N'Pending Request' THEN 1
           WHEN N'Pending Payment' THEN 2
           WHEN N'Reserved' THEN 3
           WHEN N'Confirmed' THEN 4
           WHEN N'Dining' THEN 5
           WHEN N'Cleaning' THEN 6
           WHEN N'Check-out' THEN 7
           WHEN N'Reject Request' THEN 8
           ELSE 9
         END ASC,
         r.reservation_start_at ASC`
    );
    res.json({ success: true, reservations: rows });
  } catch (error) {
    console.error("[CRITICAL BACKEND ERROR]: getAllReservations:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// GET /api/manager/reservations/:id
// ============================================================================
export const getReservationDetails = async (req, res) => {
  const reservationId = req.params.id;
  try {
    // Main reservation row
    const [resRows] = await pool.query(
      `SELECT
         r.reservation_id,
         r.customer_id,
         COALESCE(ua.full_name, r.contact_name, N'Guest')   AS customer_name,
         COALESCE(ua.phone,    r.contact_phone, N'')         AS customer_phone,
         COALESCE(ua.email,    r.contact_email, N'')         AS customer_email,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         r.reservation_source,
         r.created_at,
         r.confirmed_at,
         r.checked_in_at,
         r.cancelled_at,
         r.cancel_reason,
         r.preferred_area_id,
         a.area_name AS preferred_area,
         a.area_type
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
       WHERE r.reservation_id = ?`,
      [reservationId]
    );

    if (resRows.length === 0) {
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }

    // Tables assigned to this reservation
    const [tableRows] = await pool.query(
      `SELECT t.table_id, t.table_number, t.capacity, t.table_status
       FROM dbo.ReservationTables rt
       JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
       WHERE rt.reservation_id = ?`,
      [reservationId]
    );

    // Preorder items
    const [preorderRows] = await pool.query(
      `SELECT p.preorder_item_id, p.dish_id, d.dish_name, p.quantity, p.unit_price, p.notes
       FROM dbo.PreorderItems p
       JOIN dbo.Dishes d ON p.dish_id = d.dish_id
       WHERE p.reservation_id = ?
       ORDER BY p.preorder_item_id`,
      [reservationId]
    );

    const reservation = resRows[0];
    res.json({
      success: true,
      data: {
        ...reservation,
        status: reservation.reservation_status || "",
        tables: tableRows,
        assigned_tables: tableRows.map(t => t.table_number).join(", "),
        preorder: preorderRows,
      },
    });
  } catch (error) {
    console.error("[CRITICAL BACKEND ERROR]: getReservationDetails:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// GET /api/manager/reservations/:id/history
// ============================================================================
export const getReservationHistory = async (req, res) => {
  const reservationId = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT
          history_id,
          action_name,
          reservation_id,
          performed_by,
          role_name,
          notes,
          created_at
       FROM (
           SELECT
              'AL-' + CAST(al.audit_log_id AS VARCHAR) AS history_id,
              al.action_name,
              al.target_id    AS reservation_id,
              COALESCE(ua.full_name, N'System') AS performed_by,
              r.role_name,
              al.new_value_json AS notes,
              al.created_at
           FROM dbo.AuditLogs al
           LEFT JOIN dbo.UserAccounts ua ON al.user_id = ua.user_id
           LEFT JOIN dbo.Roles r ON ua.role_id = r.role_id
           WHERE al.target_table = N'Reservations'
             AND al.target_id = ?

           UNION ALL

           SELECT
              'RT-' + CAST(rt.timeline_id AS VARCHAR) AS history_id,
              rt.event_type AS action_name,
              rt.reservation_id,
              COALESCE(ua.full_name, N'System') AS performed_by,
              r.role_name,
              rt.notes,
              rt.created_at
           FROM dbo.ReservationTimelines rt
           LEFT JOIN dbo.UserAccounts ua ON rt.performed_by = ua.user_id
           LEFT JOIN dbo.Roles r ON ua.role_id = r.role_id
           WHERE rt.reservation_id = ?
       ) AS CombinedHistory
       ORDER BY created_at ASC`,
      [reservationId, reservationId]
    );
    
    // Parse JSON
    const history = rows.map(row => {
      let parsedNotes = null;
      try {
        if (row.notes) {
          parsedNotes = JSON.parse(row.notes);
        }
      } catch (e) {
        parsedNotes = row.notes;
      }
      return {
        ...row,
        notes: parsedNotes
      };
    });

    res.json({ success: true, history });
  } catch (error) {
    console.error("[CRITICAL BACKEND ERROR]: getReservationHistory:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// PATCH /api/manager/reservations/:id/confirm
// — Bulletproof sql.Transaction pattern, NO OUTPUT INSERTED.*
// ============================================================================
export const confirmReservation = async (req, res) => {
  const reservationId = req.params.id;
  const { table_ids } = req.body;
  const managerId = req.userId;

  if (table_ids && !Array.isArray(table_ids)) {
    return res.status(400).json({ success: false, message: "table_ids must be an array." });
  }

  let transaction;
  try {
    const rawPool = await getRawPool();
    transaction = new sql.Transaction(rawPool);
    await transaction.begin();

    // 1. Lock and read the reservation
    const reqRes = new sql.Request(transaction);
    reqRes.input("resId", sql.Int, reservationId);
    const { recordset: resRows } = await reqRes.query(`
      SELECT r.reservation_id,
             r.reservation_status,
             r.customer_id,
             r.guest_count,
             r.special_request,
             r.preferred_area_id,
             r.reservation_start_at,
             COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
             COALESCE(ua.phone,    r.contact_phone, N'')       AS customer_phone,
             COALESCE(ua.email,    r.contact_email, N'')       AS customer_email,
             a.area_name AS preferred_area
      FROM dbo.Reservations r WITH (UPDLOCK, ROWLOCK)
      LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
      LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
      WHERE r.reservation_id = @resId
    `);

    if (resRows.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }

    const reservation = resRows[0];
    if (reservation.reservation_status !== RESERVATION_STATUS.PENDING_REQUEST) {
      await transaction.rollback();
      // If already confirmed, return 200 soft-success instead of 409 hard-error
      // This prevents the UI from flashing an error when a double-click occurs
      if (reservation.reservation_status === RESERVATION_STATUS.CONFIRMED) {
        return res.status(200).json({
          success: true,
          already_confirmed: true,
          message: `Reservation #${reservationId} was already confirmed.`,
          data: { reservation_id: reservationId, assigned_tables: [] },
        });
      }
      return res.status(409).json({
        success: false,
        message: `Cannot confirm: reservation is already '${reservation.reservation_status}'.`,
      });
    }


    // 2. Validate tables (if provided)
    let tableRows = [];
    if (table_ids && table_ids.length > 0) {
      const reqTables = new sql.Request(transaction);
      const placeholders = table_ids.map((id, i) => {
        reqTables.input(`t${i}`, sql.Int, id);
        return `@t${i}`;
      }).join(", ");

      const { recordset } = await reqTables.query(`
        SELECT table_id, table_number, table_status
        FROM dbo.RestaurantTables WITH (UPDLOCK, ROWLOCK)
        WHERE table_id IN (${placeholders})
      `);
      tableRows = recordset;

      if (tableRows.length !== table_ids.length) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "One or more requested tables do not exist." });
      }

      const unavailable = tableRows.filter(t => t.table_status !== TABLE_STATUS.AVAILABLE);
      if (unavailable.length > 0) {
        await transaction.rollback();
        const names = unavailable.map(t => `T${t.table_number} (${t.table_status})`).join(", ");
        return res.status(409).json({
          success: false,
          message: `Tables not available: ${names}.`,
        });
      }
    }

    // 3. UPDATE status
    await updateReservationStatus({
      connection: transaction,
      reservationId,
      toStatus: RESERVATION_STATUS.CONFIRMED,
      staffId: managerId,
      auditAction: "MANAGER_CONFIRM",
      extraUpdates: `, confirmed_by_staff_id = ${managerId}, confirmed_at = SYSDATETIME()`
    });

    // 4. Assign tables
    let finalTableIds = [];
    if (table_ids && Array.isArray(table_ids) && table_ids.length > 0) {
      finalTableIds = [table_ids[0]];
    } else {
      const reqAuto = new sql.Request(transaction);
      reqAuto.input("guestCount", sql.Int, reservation.guest_count);
      const autoRes = await reqAuto.query(`
        SELECT TOP 1 table_id, table_number
        FROM dbo.RestaurantTables WITH (UPDLOCK, ROWLOCK)
        WHERE table_status = N'Available'
          AND capacity >= @guestCount
        ORDER BY capacity ASC
      `);
      if (autoRes.recordset.length > 0) {
        finalTableIds = [autoRes.recordset[0].table_id];
      }
    }

    const assignedTableNumbers = [];
    if (finalTableIds.length > 0) {
      for (const tId of finalTableIds) {
        const reqAssign = new sql.Request(transaction);
        reqAssign.input("resId", sql.Int, reservationId);
        reqAssign.input("tId", sql.Int, tId);
        reqAssign.input("managerId", sql.Int, managerId);
        await reqAssign.query(`
          INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id, assigned_at)
          VALUES (@resId, @tId, @managerId, SYSDATETIME())
        `);

        const reqTbl = new sql.Request(transaction);
        reqTbl.input("tblStatus", sql.NVarChar, TABLE_STATUS.RESERVED);
        reqTbl.input("tId", sql.Int, tId);
        await reqTbl.query(`
          UPDATE dbo.RestaurantTables
          SET table_status = @tblStatus, updated_at = SYSDATETIME()
          WHERE table_id = @tId
        `);

        // Get table number for logging/notification
        const numRes = await reqTbl.query(`SELECT table_number FROM dbo.RestaurantTables WHERE table_id = @tId`);
        if (numRes.recordset.length > 0) assignedTableNumbers.push(numRes.recordset[0].table_number);
      }
    }


    // 5. In-DB Notifications
    const reqStaff = new sql.Request(transaction);
    const { recordset: staffRows } = await reqStaff.query(`
      SELECT u.user_id
      FROM dbo.UserAccounts u
      JOIN dbo.Roles r ON u.role_id = r.role_id
      WHERE r.role_name = N'Restaurant Staff' AND u.is_active = 1
    `);

    const arrivalTime = new Date(reservation.reservation_start_at).toLocaleTimeString("vi-VN", {
      hour: "2-digit", minute: "2-digit",
    });
    const staffMsg = `Reservation #${reservationId} confirmed for ${reservation.customer_name}, ${reservation.guest_count} guests at ${arrivalTime}.`;

    for (const { user_id } of staffRows) {
      const reqN = new sql.Request(transaction);
      reqN.input("userId", sql.Int, user_id);
      reqN.input("msg", sql.NVarChar, staffMsg);
      await reqN.query(`
        INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
        VALUES (@userId, N'Booking Confirmed', N'Reservation Confirmed', @msg, 0, SYSDATETIME())
      `);
    }

    if (reservation.customer_id) {
      const reqCN = new sql.Request(transaction);
      reqCN.input("custId", sql.Int, reservation.customer_id);
      await reqCN.query(`
        INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
        VALUES (@custId, N'Booking Confirmed', N'Reservation Processed',
                N'Your reservation has been confirmed.', 0, SYSDATETIME())
      `);
    }

    // AuditLog is now handled by updateReservationStatus

    // === COMMIT DATABASE TRANSACTION ===
    await transaction.commit();

    // === POST-COMMIT: External services in isolated try/catch ===
    try {
      const io = getIO();
      if (io) {
        io.emit("reservation:confirmed", { reservation_id: reservationId });
        io.to("room:manager").emit("reservation:status_updated", {
          reservation_id: reservationId,
          new_status: RESERVATION_STATUS.CONFIRMED,
        });
        io.to("room:staff").emit("reservation_updated", {
          reservation_id: reservationId,
          action: "CONFIRMED",
          message: `Reservation #${reservationId} was confirmed.`,
        });

        try {
          const shiftData = await resolveShift(reservation.reservation_start_at);
          if (shiftData?.shift_name) {
            io.to(`room:staff:${shiftData.shift_name}`).emit("shift_booking_update", {
              reservation_id: reservationId,
              customer_name: reservation.customer_name,
              customer_phone: reservation.customer_phone,
              reservation_start_at: reservation.reservation_start_at,
              guest_count: reservation.guest_count,
              preferred_area: reservation.preferred_area ?? "General",
              assigned_tables: assignedTableNumbers,
              special_request: reservation.special_request,
              shift_name: shiftData.shift_name,
            });
          }
        } catch (shiftErr) {
          console.error("[confirmReservation] resolveShift (non-fatal):", shiftErr.message);
        }

        if (reservation.customer_id) {
          io.to(`customer_${reservation.customer_id}`).emit("reservation:processed", {
            reservation_id: reservationId,
            message: "Your Reservation has been confirmed!",
            link: "/my-reservations",
          });
        }
      }

      // Email notification
      const freshPool = await getRawPool();
      const reqEmail = new sql.Request(freshPool);
      reqEmail.input("resId", sql.Int, reservationId);
      const { recordset: emailRows } = await reqEmail.query(`
        SELECT COALESCE(ua.full_name, r.contact_name, N'Quý khách') AS full_name,
               COALESCE(ua.email,    r.contact_email)                AS email,
               r.reservation_start_at
        FROM dbo.Reservations r
        LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
        WHERE r.reservation_id = @resId
      `);

      const emailData = emailRows?.[0];
      if (emailData?.email) {
        const startAt = new Date(emailData.reservation_start_at);
        const reservationDate = startAt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
        const reservationTime = startAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        await sendBookingConfirmationEmail({
          toEmail: emailData.email,
          customerName: emailData.full_name,
          reservationDate,
          reservationTime,
          reservationId,
        });
      }
    } catch (externalErr) {
      // Non-fatal: DB is already committed. Just log and return degraded success.
      console.error("[CRITICAL BACKEND ERROR]: Post-commit external services failed:", externalErr.message, externalErr.stack);
      return res.status(200).json({
        success: true,
        message: "Confirmed successfully, but notification/email failed",
        data: { reservation_id: reservationId, assigned_tables: assignedTableNumbers },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reservation confirmed.",
      data: { reservation_id: reservationId, assigned_tables: assignedTableNumbers },
    });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (rErr) {
        console.error("[CRITICAL BACKEND ERROR]: Rollback failed:", rErr.message);
      }
    }
    console.error("[CRITICAL BACKEND ERROR]: confirmReservation:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error during confirmation.", error: error.message });
  }
};

// ============================================================================
// PATCH /api/manager/reservations/:id/reject
// — Bulletproof sql.Transaction pattern, NO OUTPUT INSERTED.*
// ============================================================================
export const rejectReservation = async (req, res) => {
  const reservationId = req.params.id;
  const { reason } = req.body;
  const managerId = req.userId;

  let transaction;
  try {
    const rawPool = await getRawPool();
    transaction = new sql.Transaction(rawPool);
    await transaction.begin();

    // 1. UPDATE status
    await updateReservationStatus({
      connection: transaction,
      reservationId,
      toStatus: RESERVATION_STATUS.REJECT_REQUEST,
      staffId: managerId,
      auditAction: "REJECT_RESERVATION",
      extraUpdates: `, cancelled_at = SYSDATETIME(), cancel_reason = @reason`
    });

    // 2. Fetch customer_id (separate SELECT — no OUTPUT INSERTED.*)
    const reqCust = new sql.Request(transaction);
    reqCust.input("resId", sql.Int, reservationId);
    const { recordset: custRows } = await reqCust.query(
      `SELECT customer_id FROM dbo.Reservations WHERE reservation_id = @resId`
    );
    const customerId = custRows[0]?.customer_id ?? null;

    // 4. Customer notification (in-DB)
    if (customerId) {
      const reqNotif = new sql.Request(transaction);
      reqNotif.input("custId", sql.Int, customerId);
      reqNotif.input("reason", sql.NVarChar, reason || null);
      await reqNotif.query(`
        INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
        VALUES (@custId, N'Booking Rejected', N'Reservation Update',
                N'Your reservation has been rejected. Reason: ' + ISNULL(@reason, N''), 0, SYSDATETIME())
      `);
    }

    await transaction.commit();

    // === POST-COMMIT: Sockets ===
    try {
      const io = getIO();
      if (io) {
        io.to("room:manager").emit("reservation:status_updated", {
          reservation_id: parseInt(reservationId),
          new_status: RESERVATION_STATUS.REJECT_REQUEST,
        });
        if (customerId) {
          io.to(`customer_${customerId}`).emit("reservation:processed", {
            reservation_id: parseInt(reservationId),
            message: "Your reservation has been rejected.",
          });
        }
      }
    } catch (externalErr) {
      console.error("[CRITICAL BACKEND ERROR]: rejectReservation post-commit:", externalErr.message);
    }

    return res.json({ success: true, message: "Reservation rejected." });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (rErr) {
        console.error("[CRITICAL BACKEND ERROR]: Rollback failed:", rErr.message);
      }
    }
    console.error("[CRITICAL BACKEND ERROR]: rejectReservation:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// PATCH /api/manager/reservations/:id/cancel
// — Bulletproof sql.Transaction pattern, NO OUTPUT INSERTED.*
// ============================================================================
export const cancelReservation = async (req, res) => {
  const reservationId = req.params.id;
  const { reason } = req.body || {};
  const managerId = req.userId;

  // Validation: cancel reason is required and must be meaningful
  if (!reason || String(reason).trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: "cancel_reason is required (minimum 5 characters).",
    });
  }

  let transaction;
  try {
    const rawPool = await getRawPool();
    transaction = new sql.Transaction(rawPool);
    await transaction.begin();

    // 1. UPDATE status
    await updateReservationStatus({
      connection: transaction,
      reservationId,
      toStatus: RESERVATION_STATUS.CANCELLED,
      staffId: managerId,
      auditAction: "CANCEL_RESERVATION",
      extraUpdates: `, cancelled_at = SYSDATETIME(), cancel_reason = @reason`
    });

    // 2. Fetch customer_id
    const reqCust = new sql.Request(transaction);
    reqCust.input("resId", sql.Int, reservationId);
    const { recordset: custRows } = await reqCust.query(
      `SELECT customer_id FROM dbo.Reservations WHERE reservation_id = @resId`
    );
    const customerId = custRows[0]?.customer_id ?? null;

    // 3. Free up tables
    const reqTables = new sql.Request(transaction);
    reqTables.input("resId", sql.Int, reservationId);
    await reqTables.query(`
      UPDATE dbo.RestaurantTables
      SET table_status = N'Available', updated_at = SYSDATETIME()
      WHERE table_id IN (
        SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @resId
      )
    `);

    // 5. Customer notification
    if (customerId) {
      const reqNotif = new sql.Request(transaction);
      reqNotif.input("custId", sql.Int, customerId);
      reqNotif.input("reason", sql.NVarChar, reason || null);
      await reqNotif.query(`
        INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
        VALUES (@custId, N'Booking Cancelled', N'Reservation Update',
                N'Your reservation has been cancelled. Reason: ' + ISNULL(@reason, N''), 0, SYSDATETIME())
      `);
    }

    await transaction.commit();

    // === POST-COMMIT: Sockets ===
    try {
      const io = getIO();
      if (io) {
        io.to("room:manager").emit("reservation:status_updated", {
          reservation_id: parseInt(reservationId),
          new_status: RESERVATION_STATUS.CANCELLED,
        });
        io.to("room:staff").emit("reservation:status_updated", {
          reservation_id: parseInt(reservationId),
          new_status: RESERVATION_STATUS.CANCELLED,
        });
        if (customerId) {
          io.to(`customer_${customerId}`).emit("reservation:processed", {
            reservation_id: parseInt(reservationId),
            message: "Your reservation has been cancelled.",
          });
        }
      }
    } catch (externalErr) {
      console.error("[CRITICAL BACKEND ERROR]: cancelReservation post-commit:", externalErr.message);
    }

    return res.json({ success: true, message: "Reservation cancelled." });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (rErr) {
        console.error("[CRITICAL BACKEND ERROR]: Rollback failed:", rErr.message);
      }
    }
    console.error("[CRITICAL BACKEND ERROR]: cancelReservation:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// PATCH /api/manager/reservations/:id
// — Bulletproof sql.Transaction pattern (matches confirm/reject pattern)
// ============================================================================
export const updateReservation = async (req, res) => {
  const reservationId = req.params.id;
  const managerId = req.userId;
  const allowedFields = [
    "reservation_start_at", "reservation_end_at",
    "guest_count", "special_request", "reservation_status",
    "preferred_area_id", "table_id",
    "contact_name", "contact_phone", "contact_email"
  ];

  const fieldEntries = [];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      fieldEntries.push({ field, value: req.body[field] });
    }
  }

  if (fieldEntries.length === 0) {
    return res.status(400).json({ success: false, message: "No valid fields provided." });
  }

  let transaction;
  try {
    const rawPool = await getRawPool();
    transaction = new sql.Transaction(rawPool);
    await transaction.begin();

    // 0.5 OVERLAP VALIDATION (Blind Edit collision loophole fix)
    let newTableId = null;
    let oldTableIds = [];

    // We only care if we are editing time or table
    if (req.body.reservation_start_at || req.body.table_id) {
      const reqTbl = new sql.Request(transaction);
      reqTbl.input("resId", sql.Int, reservationId);
      const { recordset: assignedTables } = await reqTbl.query(`
          SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @resId
        `);
      oldTableIds = assignedTables.map(t => t.table_id);

      let tableIdsToCheck = oldTableIds;
      if (req.body.table_id) {
        newTableId = parseInt(req.body.table_id);
        if (!isNaN(newTableId) && newTableId > 0) {
          tableIdsToCheck = [newTableId];
        } else {
          tableIdsToCheck = []; // empty or clearing table
        }
      }

      if (tableIdsToCheck.length > 0) {
        // Get the time range to check (use new if provided, else existing)
        let checkStart = req.body.reservation_start_at;
        let checkEnd = req.body.reservation_end_at;

        if (!checkStart || !checkEnd) {
          const reqCurrTime = new sql.Request(transaction);
          reqCurrTime.input("resId", sql.Int, reservationId);
          const { recordset: currTime } = await reqCurrTime.query(`SELECT reservation_start_at, reservation_end_at FROM dbo.Reservations WHERE reservation_id = @resId`);
          if (currTime.length > 0) {
            if (!checkStart) checkStart = currTime[0].reservation_start_at;
            if (!checkEnd) checkEnd = currTime[0].reservation_end_at;
          }
        }

        if (checkStart && checkEnd) {
          const reqOverlap = new sql.Request(transaction);
          reqOverlap.input("newStart", sql.DateTimeOffset, new Date(checkStart).toISOString());
          reqOverlap.input("newEnd", sql.DateTimeOffset, new Date(checkEnd).toISOString());
          reqOverlap.input("resId", sql.Int, reservationId);

          // Overlap condition:
          // Existing booking starts BEFORE our expected end
          // Existing booking ends + 30m buffer AFTER our expected start
          const overlapQuery = `
                  SELECT TOP 1 r.reservation_id, rt.table_id
                  FROM dbo.Reservations r
                  JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
                  WHERE rt.table_id IN (${tableIdsToCheck.join(",")})
                    AND r.reservation_id != @resId
                    AND r.reservation_status NOT IN (N'Completed', N'Cancelled', N'No Show', N'Rejected')
                    AND (
                       (r.reservation_start_at < @newEnd)
                       AND
                       (DATEADD(MINUTE, 30, r.reservation_end_at) > @newStart)
                    )
                `;
          const { recordset: overlaps } = await reqOverlap.query(overlapQuery);

          if (overlaps.length > 0) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: "Collision detected: Table is already booked during this time.",
              error: "Collision detected: Table is already booked during this time."
            });
          }
        }
      }
    }

    // 1. Build and execute dynamic UPDATE for Reservations table
    // Remove table_id from fieldEntries since it's for ReservationTables
    const resFieldEntries = fieldEntries.filter(e => e.field !== "table_id" && e.field !== "reservation_status");
    const statusEntry = fieldEntries.find(e => e.field === "reservation_status");

    if (statusEntry) {
      await updateReservationStatus({
        connection: transaction,
        reservationId,
        toStatus: statusEntry.value,
        staffId: managerId,
        auditAction: "MANAGER_UPDATE_STATUS",
      });
    }

    if (resFieldEntries.length > 0) {
      const setClauses = resFieldEntries.map((e, i) => `${e.field} = @f${i}`).join(", ");
      const reqUpdate = new sql.Request(transaction);
      resFieldEntries.forEach((e, i) => {
        const sqlType = e.field.includes("_at") ? sql.DateTimeOffset
          : e.field === "guest_count" || e.field === "preferred_area_id" ? sql.Int
            : sql.NVarChar;
        reqUpdate.input(`f${i}`, sqlType, e.value);
      });
      reqUpdate.input("resId", sql.Int, reservationId);
      const updateResult = await reqUpdate.query(`
          UPDATE dbo.Reservations
          SET ${setClauses}, updated_at = SYSDATETIME()
          WHERE reservation_id = @resId
        `);

      if (updateResult.rowsAffected[0] === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Reservation not found." });
      }
    }

    // 1.5 Update ReservationTables if table_id was provided
    if (req.body.table_id !== undefined) {
      const reqDel = new sql.Request(transaction);
      reqDel.input("resId", sql.Int, reservationId);
      await reqDel.query(`DELETE FROM dbo.ReservationTables WHERE reservation_id = @resId`);

      if (newTableId) {
        const reqIns = new sql.Request(transaction);
        reqIns.input("resId", sql.Int, reservationId);
        reqIns.input("tId", sql.Int, newTableId);
        await reqIns.query(`INSERT INTO dbo.ReservationTables (reservation_id, table_id) VALUES (@resId, @tId)`);
      }
    }

    // 2. Fetch customer info for email (while still in transaction for consistency)
    const reqCust = new sql.Request(transaction);
    reqCust.input("resId", sql.Int, reservationId);
    const { recordset: custRows } = await reqCust.query(`
      SELECT COALESCE(ua.email, r.contact_email, N'') AS customer_email,
             COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
             r.customer_id
      FROM dbo.Reservations r
      LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
      WHERE r.reservation_id = @resId
    `);
    const custData = custRows[0] || {};

    // 3. Audit log — Protocol #4: NEVER stringify raw req.body; use sanitized fieldEntries only
    const sanitizedChanges = {};
    for (const { field, value } of fieldEntries) {
      sanitizedChanges[field] = value;
    }

    const reqAudit = new sql.Request(transaction);
    reqAudit.input("managerId", sql.Int, managerId);
    reqAudit.input("resId", sql.Int, reservationId);
    reqAudit.input("newVal", sql.NVarChar, JSON.stringify(sanitizedChanges));
    reqAudit.input("ip", sql.VarChar, req.ip || null);
    await reqAudit.query(`
      INSERT INTO dbo.AuditLogs
        (user_id, action_name, target_table, target_id, new_value_json, ip_address, created_at)
      VALUES (@managerId, N'MANAGER_EDIT_RESERVATION', N'Reservations', @resId, @newVal, @ip, SYSDATETIME())
    `);

    // 4. Handle Request → Confirmed transition:
    //    If the reservation was in 'Request' status (customer change-request),
    //    resolve it back to 'Confirmed' and log the resolution.
    const reqCheckStatus = new sql.Request(transaction);
    reqCheckStatus.input("resId", sql.Int, reservationId);
    const { recordset: statusRows } = await reqCheckStatus.query(`
      SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = @resId
    `);
    const currentStatus = statusRows[0]?.reservation_status;

    if (currentStatus === 'Request') {
      const reqResolve = new sql.Request(transaction);
      reqResolve.input("resId", sql.Int, reservationId);
      await reqResolve.query(`
        UPDATE dbo.Reservations
        SET reservation_status = N'Confirmed', updated_at = SYSDATETIME()
        WHERE reservation_id = @resId
      `);

      // Additional audit entry for the status transition
      const reqResolveAudit = new sql.Request(transaction);
      reqResolveAudit.input("managerId", sql.Int, managerId);
      reqResolveAudit.input("resId", sql.Int, reservationId);
      reqResolveAudit.input("oldVal", sql.NVarChar, JSON.stringify({ reservation_status: "Request" }));
      reqResolveAudit.input("newVal", sql.NVarChar, JSON.stringify({ reservation_status: "Confirmed" }));
      reqResolveAudit.input("ip", sql.VarChar, req.ip || null);
      await reqResolveAudit.query(`
        INSERT INTO dbo.AuditLogs
          (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
        VALUES (@managerId, N'MANAGER_RESOLVE_REQUEST', N'Reservations', @resId, @oldVal, @newVal, @ip, SYSDATETIME())
      `);
    }

    // === COMMIT ===
    await transaction.commit();

    // === POST-COMMIT: External services (non-fatal) ===
    try {
      // Email notification
      if (custData.customer_email) {
        const changesLabelled = {};
        if (req.body.guest_count) changesLabelled["Guests"] = req.body.guest_count;
        if (req.body.reservation_start_at) changesLabelled["Date & Time"] = new Date(req.body.reservation_start_at).toLocaleString("vi-VN");
        if (req.body.special_request !== undefined) changesLabelled["Special Request"] = req.body.special_request || "(cleared)";
        if (req.body.reservation_status) changesLabelled["Status"] = req.body.reservation_status;
        sendBookingEditedEmail({
          toEmail: custData.customer_email,
          customerName: custData.customer_name,
          reservationId,
          changes: changesLabelled,
        }).catch(e => console.error("[editEmail]", e?.message));
      }

      // Socket notifications
      const io = getIO();
      if (io) {
        io.to("room:manager").emit("reservation:status_updated", {
          reservation_id: parseInt(reservationId),
          action: "EDITED",
        });
        io.to("room:staff").emit("reservation_updated", {
          reservation_id: parseInt(reservationId),
          action: "EDITED",
          message: `Reservation #${reservationId} was edited by Manager.`,
        });
        if (custData.customer_id) {
          io.to(`customer_${custData.customer_id}`).emit("reservation:updated", {
            reservation_id: parseInt(reservationId),
            changes: req.body,
          });
        }
      }
    } catch (externalErr) {
      console.error("[updateReservation] Post-commit external services (non-fatal):", externalErr.message);
    }

    return res.json({ success: true, message: "Reservation updated.", status_transitioned: currentStatus === 'Request' ? 'Confirmed' : null });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (rErr) {
        console.error("[CRITICAL BACKEND ERROR]: updateReservation rollback failed:", rErr.message);
      }
    }
    console.error("[CRITICAL BACKEND ERROR]: updateReservation:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// PATCH /api/manager/reservations/:id/cancel
// Manager proactively cancels a confirmed reservation (before check-in).
// Requires body: { cancel_reason: string }
// ============================================================================
export const cancelReservationByManager = async (req, res) => {
  const reservationId = parseInt(req.params.id, 10);
  const managerId = req.managerId || req.userId;
  const { cancel_reason } = req.body;

  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid reservation ID." });
  }
  if (!cancel_reason || String(cancel_reason).trim().length < 5) {
    return res.status(400).json({ success: false, message: "cancel_reason is required (minimum 5 characters)." });
  }

  const rawPool = await getRawPool();
  let transaction = null;

  try {
    transaction = new sql.Transaction(rawPool);
    await transaction.begin();

    // 1. Fetch reservation — must be Confirmed to cancel
    const reqFetch = new sql.Request(transaction);
    reqFetch.input("resId", sql.Int, reservationId);
    const { recordset: resRows } = await reqFetch.query(`
      SELECT
        r.reservation_id, r.reservation_status, r.customer_id,
        COALESCE(ua.full_name,  r.contact_name,  N'Guest') AS customer_name,
        COALESCE(ua.email,      r.contact_email, N'')      AS customer_email
      FROM dbo.Reservations r
      LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
      WHERE r.reservation_id = @resId
    `);

    if (resRows.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }

    const reservation = resRows[0];
    const CANCELLABLE = [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PENDING_REQUEST, RESERVATION_STATUS.PENDING_PAYMENT, RESERVATION_STATUS.RESERVED];
    if (!CANCELLABLE.includes(reservation.reservation_status)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Cannot cancel a reservation with status '${reservation.reservation_status}'.`,
        current_status: reservation.reservation_status,
      });
    }

    // 2. Cancel the reservation
    await updateReservationStatus({
      connection: transaction,
      reservationId,
      toStatus: RESERVATION_STATUS.CANCELLED,
      staffId: managerId,
      auditAction: "MANAGER_CANCELLED_RESERVATION",
      extraUpdates: `, cancelled_at = SYSDATETIME(), has_pending_request = 0`
    });

    const reqUpdate = new sql.Request(transaction);
    reqUpdate.input("cancelReason", sql.NVarChar, String(cancel_reason).trim());
    reqUpdate.input("resId", sql.Int, reservationId);
    await reqUpdate.query(`
      UPDATE dbo.Reservations
      SET cancel_reason = @cancelReason
      WHERE reservation_id = @resId
    `);

    // 3. Release associated tables back to Available
    const reqTables = new sql.Request(transaction);
    reqTables.input("resId", sql.Int, reservationId);
    await reqTables.query(`
      UPDATE dbo.RestaurantTables
      SET table_status = N'Available', updated_at = SYSDATETIME()
      WHERE table_id IN (
        SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @resId
      )
    `);

    // 4. Audit Log
    // Handled by updateReservationStatus

    // 5. In-app notification to Customer (if exists)
    if (reservation.customer_id) {
      const reqNotif = new sql.Request(transaction);
      reqNotif.input("custId", sql.Int, reservation.customer_id);
      reqNotif.input("msg", sql.NVarChar, `Your reservation #${reservationId} has been cancelled by the restaurant. Reason: ${String(cancel_reason).trim()}`);
      await reqNotif.query(`
        INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
        VALUES (@custId, N'Booking Cancelled', N'Reservation Cancelled by Restaurant', @msg, 0, SYSDATETIME())
      `);
    }

    await transaction.commit();

    // 6. Socket.IO broadcast
    try {
      const io = getIO();
      if (io) {
        io.to('room:manager').to('room:staff').emit('reservation:cancelled', {
          reservation_id: reservationId,
          reservation_status: RESERVATION_STATUS.CANCELLED,
          cancelled_by: 'manager',
          cancel_reason: String(cancel_reason).trim(),
        });
      }
    } catch (_) { }

    // 7. Email Customer (non-blocking)
    if (reservation.customer_email) {
      sendManagerCancelledEmail({
        toEmail: reservation.customer_email,
        customerName: reservation.customer_name,
        reservationId,
        cancelReason: String(cancel_reason).trim(),
      }).catch(e => console.error("[cancelReservationByManager] Email failed:", e.message));
    }

    return res.json({
      success: true,
      message: `Reservation #${reservationId} has been cancelled successfully.`,
      reservation_id: reservationId,
      reservation_status: RESERVATION_STATUS.CANCELLED,
    });

  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { }
    }
    console.error("[CRITICAL BACKEND ERROR]: cancelReservationByManager:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// POST /api/manager/reservations/:id/resolve-edit
// Manager confirms or rejects a customer's Edit Request.
// Body: { decision: 'confirm'|'reject', reject_reason?: string }
// ============================================================================
export const resolveEditRequest = async (req, res) => {
  const reservationId = parseInt(req.params.id, 10);
  const managerId = req.managerId || req.userId;
  const { decision, reject_reason } = req.body || {};

  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid reservation ID." });
  }
  if (!["confirm", "reject"].includes(String(decision || "").toLowerCase())) {
    return res.status(400).json({ success: false, message: "decision must be 'confirm' or 'reject'." });
  }

  const rawPool = await getRawPool();
  let transaction = null;

  try {
    transaction = new sql.Transaction(rawPool);
    await transaction.begin();

    // 1. Fetch reservation with pending changes
    const reqFetch = new sql.Request(transaction);
    reqFetch.input("resId", sql.Int, reservationId);
    const { recordset: resRows } = await reqFetch.query(`
      SELECT
        r.reservation_id, r.reservation_status, r.has_pending_request,
        r.request_type, r.pending_changes_json,
        r.reservation_start_at, r.reservation_end_at, r.guest_count,
        r.special_request, r.cancel_reason,
        r.customer_id,
        COALESCE(ua.full_name,  r.contact_name,  N'Guest') AS customer_name,
        COALESCE(ua.email,      r.contact_email, N'')      AS customer_email,
        COALESCE(ua.phone,      r.contact_phone, N'')      AS customer_phone
      FROM dbo.Reservations r
      LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
      WHERE r.reservation_id = @resId
    `);

    if (resRows.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }

    const reservation = resRows[0];
    if (!reservation.has_pending_request) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "No pending edit request on this reservation." });
    }

    // Parse the pending changes JSON
    let pendingChanges = {};
    try { pendingChanges = JSON.parse(reservation.pending_changes_json || "{}"); } catch (_) { }

    const isConfirm = decision.toLowerCase() === "confirm";

    if (isConfirm) {
      // ── CONFIRM: apply changes ────────────────────────────────────────────
      // Build UPDATE SET clauses from pendingChanges
      const allowedFields = ["guest_count", "reservation_start_at", "reservation_end_at", "special_request", "preferred_area_id"];
      const setClauses = [];
      const reqUpdate = new sql.Request(transaction);

      for (const [field, value] of Object.entries(pendingChanges)) {
        if (!allowedFields.includes(field)) continue;
        if (field === "guest_count") {
          reqUpdate.input("gc_new", sql.TinyInt, parseInt(value, 10));
          setClauses.push("guest_count = @gc_new");
        } else if (field === "reservation_start_at") {
          reqUpdate.input("rsa_new", sql.DateTime2, new Date(value));
          setClauses.push("reservation_start_at = @rsa_new");
        } else if (field === "reservation_end_at") {
          reqUpdate.input("rea_new", sql.DateTime2, new Date(value));
          setClauses.push("reservation_end_at = @rea_new");
        } else if (field === "special_request") {
          reqUpdate.input("sr_new", sql.NVarChar, String(value));
          setClauses.push("special_request = @sr_new");
        } else if (field === "preferred_area_id") {
          reqUpdate.input("area_new", sql.SmallInt, parseInt(value, 10));
          setClauses.push("preferred_area_id = @area_new");
        }
      }

      // Only call updateReservationStatus to revert back to CONFIRMED
      await updateReservationStatus({
        connection: transaction,
        reservationId,
        toStatus: RESERVATION_STATUS.CONFIRMED,
        staffId: managerId,
        auditAction: "MANAGER_RESOLVE_REQUEST",
        extraUpdates: `, has_pending_request = 0, pending_changes_json = NULL, request_type = NULL, resolved_at = SYSDATETIME(), resolved_by = ${managerId}`
      });

      // No need to add reservation_status or pending fields to setClauses since state machine handles it
      reqUpdate.input("managerId", sql.Int, managerId);
      reqUpdate.input("resId", sql.Int, reservationId);

      if (setClauses.length > 0) {
        await reqUpdate.query(`
          UPDATE dbo.Reservations SET ${setClauses.join(", ")}
          WHERE reservation_id = @resId
        `);
      }

      // Handle table swap if new table_ids requested
      const newTableIds = Array.isArray(pendingChanges.table_ids) ? pendingChanges.table_ids.map(Number) : null;
      let oldTableIds = [];

      if (newTableIds && newTableIds.length > 0) {
        // Get current tables
        const reqOldTables = new sql.Request(transaction);
        reqOldTables.input("resId", sql.Int, reservationId);
        const { recordset: oldTables } = await reqOldTables.query(`
          SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @resId
        `);
        oldTableIds = oldTables.map(t => t.table_id);

        // Release old tables
        if (oldTableIds.length > 0) {
          const reqRelease = new sql.Request(transaction);
          reqRelease.input("resId", sql.Int, reservationId);
          await reqRelease.query(`
            UPDATE dbo.RestaurantTables SET table_status = N'Available', updated_at = SYSDATETIME()
            WHERE table_id IN (SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @resId)
          `);
          await reqRelease.query(`
            DELETE FROM dbo.ReservationTables WHERE reservation_id = @resId
          `);
        }

        // Reserve new tables
        for (const tid of newTableIds) {
          const reqInsert = new sql.Request(transaction);
          reqInsert.input("resId", sql.Int, reservationId);
          reqInsert.input("tid", sql.Int, tid);
          await reqInsert.query(`
            INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_at)
            VALUES (@resId, @tid, SYSDATETIME())
          `);
          const reqLock = new sql.Request(transaction);
          reqLock.input("tid", sql.Int, tid);
          await reqLock.query(`
            UPDATE dbo.RestaurantTables SET table_status = N'Reserved', updated_at = SYSDATETIME()
            WHERE table_id = @tid
          `);
        }
      }

      // Audit log is already handled by updateReservationStatus

      await transaction.commit();

      // Post-commit: Email + Socket (non-fatal)
      try {
        const io = getIO();
        if (io) {
          const updatePayload = {
            reservation_id: reservationId,
            reservation_status: RESERVATION_STATUS.CONFIRMED,
            has_pending_request: false,
            pending_changes: pendingChanges,
            new_table_ids: newTableIds,
          };
          io.to("room:manager").to("room:staff").emit("reservation:edit_confirmed", updatePayload);
          console.log("[resolveEditRequest] Emitted reservation:edit_confirmed to room:manager + room:staff");
        }
      } catch (sockErr) {
        console.error("[resolveEditRequest] Socket emit failed (non-fatal):", sockErr.message);
      }

      // Email customer
      if (reservation.customer_email) {
        const oldInfo = {
          "Guest Count": reservation.guest_count,
          "Date": reservation.reservation_start_at ? new Date(reservation.reservation_start_at).toLocaleDateString("vi-VN") : "—",
          "Time": reservation.reservation_start_at ? new Date(reservation.reservation_start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—",
          "Notes": reservation.special_request || "None",
        };
        const newInfo = {
          "Guest Count": pendingChanges.guest_count || reservation.guest_count,
          "Date": pendingChanges.reservation_start_at ? new Date(pendingChanges.reservation_start_at).toLocaleDateString("vi-VN") : (reservation.reservation_start_at ? new Date(reservation.reservation_start_at).toLocaleDateString("vi-VN") : "—"),
          "Time": pendingChanges.reservation_start_at ? new Date(pendingChanges.reservation_start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : (reservation.reservation_start_at ? new Date(reservation.reservation_start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"),
          "Notes": pendingChanges.special_request || reservation.special_request || "None",
          ...(newTableIds ? { "Tables": newTableIds.join(", ") } : {}),
        };
        sendEditConfirmedEmail({
          toEmail: reservation.customer_email,
          customerName: reservation.customer_name,
          reservationId,
          oldInfo,
          newInfo,
        }).catch(e => console.error("[resolveEditRequest] Email failed:", e.message));
      }

      return res.json({
        success: true,
        decision: "confirm",
        message: `Edit request for reservation #${reservationId} has been confirmed.`,
        reservation_id: reservationId,
        reservation_status: RESERVATION_STATUS.CONFIRMED,
        applied_changes: pendingChanges,
      });

    } else {
      // ── REJECT: restore Confirmed, clear pending ───────────────────────────
      await updateReservationStatus({
        connection: transaction,
        reservationId,
        toStatus: RESERVATION_STATUS.CONFIRMED,
        staffId: managerId,
        auditAction: "MANAGER_RESOLVE_REQUEST",
        extraUpdates: `, has_pending_request = 0, pending_changes_json = NULL, request_type = NULL, rejected_at = SYSDATETIME(), rejected_by = ${managerId}`
      });

      // Audit log is already handled by updateReservationStatus
      const safeRejectReason = String(reject_reason || "Request could not be accommodated").trim();
      const reqAudit = new sql.Request(transaction);
      reqAudit.input("managerId", sql.Int, managerId);
      reqAudit.input("resId", sql.Int, reservationId);
      reqAudit.input("oldVal", sql.NVarChar, JSON.stringify({ reservation_status: "Request" }));
      reqAudit.input("newVal", sql.NVarChar, JSON.stringify({ reservation_status: RESERVATION_STATUS.CONFIRMED, reject_reason: safeRejectReason, rejected_by: managerId }));
      reqAudit.input("ip", sql.VarChar, req.ip || null);
      await reqAudit.query(`
        INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
        VALUES (@managerId, N'MANAGER_DECLINE_REQUEST', N'Reservations', @resId, @oldVal, @newVal, @ip, SYSDATETIME())
      `);

      await transaction.commit();

      // Post-commit: Email + Socket (non-fatal)
      try {
        const io = getIO();
        if (io) {
          io.to("room:manager").to("room:staff").emit("reservation:edit_rejected", {
            reservation_id: reservationId,
            reservation_status: RESERVATION_STATUS.CONFIRMED,
            has_pending_request: false,
            reject_reason: safeRejectReason,
          });
        }
      } catch (sockErr) {
        console.error("[resolveEditRequest] Socket emit failed (non-fatal):", sockErr.message);
      }

      // Email customer
      if (reservation.customer_email) {
        const currentInfo = {
          "Guest Count": reservation.guest_count,
          "Date": reservation.reservation_start_at ? new Date(reservation.reservation_start_at).toLocaleDateString("vi-VN") : "—",
          "Time": reservation.reservation_start_at ? new Date(reservation.reservation_start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—",
          "Notes": reservation.special_request || "None",
        };
        sendEditRejectedEmail({
          toEmail: reservation.customer_email,
          customerName: reservation.customer_name,
          reservationId,
          rejectReason: safeRejectReason,
          currentInfo,
        }).catch(e => console.error("[resolveEditRequest] Email failed:", e.message));
      }

      return res.json({
        success: true,
        decision: "reject",
        message: `Edit request for reservation #${reservationId} has been rejected.`,
        reservation_id: reservationId,
        reservation_status: RESERVATION_STATUS.CONFIRMED,
      });
    }

  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { }
    }
    console.error("[CRITICAL BACKEND ERROR]: resolveEditRequest:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// POST /api/manager/reservations/seed-test
// Manager adds realistic test reservations using real staff IDs for demo/testing
// ============================================================================
export const seedTestReservations = async (req, res) => {
  try {
    const managerId = req.user?.user_id || 2;

    // Real staff from System_Restaurant.sql:
    //   user_id=3 → Dang Quang Phu (STF001 - Receptionist)
    //   user_id=4 → Pham Thi Thuy  (STF002 - Waiter)
    //   user_id=14 → Le Huy Manh Tan (tanstaff)
    // Real customers: user_id 7-13

    const now = new Date();
    // Local Vietnam midnight of today
    const todayVN = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = todayVN.toISOString().slice(0, 10);
    const tomorrowStr = new Date(todayVN.getTime() + 86400000).toISOString().slice(0, 10);

    const testReservations = [
      { customer_id: 7, created_by_staff: 3, area_id: 1, table_id: 1, start_at: `${todayStr}T09:30:00`, end_at: `${todayStr}T11:00:00`, guests: 4, status: "Check-in", note: "High chair needed [TEST DATA]" },
      { customer_id: 8, created_by_staff: 4, area_id: 2, table_id: 7, start_at: `${todayStr}T10:15:00`, end_at: `${todayStr}T12:00:00`, guests: 2, status: "Reject Request", note: "Window seat if possible [TEST DATA]" },
      { customer_id: 9, created_by_staff: 14, area_id: 5, table_id: 20, start_at: `${todayStr}T11:00:00`, end_at: `${todayStr}T13:30:00`, guests: 6, status: "Pending Payment", note: "Business lunch [TEST DATA]" },
      { customer_id: 10, created_by_staff: 3, area_id: 1, table_id: 10, start_at: `${todayStr}T12:30:00`, end_at: `${todayStr}T14:30:00`, guests: 3, status: "Occupied", note: "[TEST DATA]" },
      { customer_id: 11, created_by_staff: 4, area_id: 3, table_id: 2, start_at: `${todayStr}T13:45:00`, end_at: `${todayStr}T15:30:00`, guests: 2, status: "Complete Paid", note: "[TEST DATA]" },
      { customer_id: 12, created_by_staff: 14, area_id: 4, table_id: 18, start_at: `${todayStr}T14:00:00`, end_at: `${todayStr}T16:30:00`, guests: 8, status: "Await Check-in", note: "Birthday party [TEST DATA]" },
      { customer_id: 13, created_by_staff: 3, area_id: 3, table_id: null, start_at: `${todayStr}T15:30:00`, end_at: `${todayStr}T17:00:00`, guests: 4, status: "Pending Payment", note: "[TEST DATA]" },
      { customer_id: 7, created_by_staff: 4, area_id: 3, table_id: null, start_at: `${todayStr}T18:00:00`, end_at: `${todayStr}T20:00:00`, guests: 2, status: "Await Check-in", note: "Anniversary [TEST DATA]" },
      { customer_id: 8, created_by_staff: 14, area_id: 2, table_id: 9, start_at: `${todayStr}T19:30:00`, end_at: `${todayStr}T21:30:00`, guests: 5, status: "Check-out", note: "[TEST DATA]" },
      { customer_id: 9, created_by_staff: 3, area_id: 1, table_id: null, start_at: `${todayStr}T20:15:00`, end_at: `${todayStr}T22:00:00`, guests: 2, status: "Reject Check-in", note: "Quiet table please [TEST DATA]" },
      { customer_id: 10, created_by_staff: 4, area_id: 5, table_id: 21, start_at: `${todayStr}T20:45:00`, end_at: `${todayStr}T23:00:00`, guests: 10, status: "Check-in", note: "Company dinner [TEST DATA]" },
      { customer_id: 11, created_by_staff: 14, area_id: 2, table_id: null, start_at: `${todayStr}T21:30:00`, end_at: `${todayStr}T23:30:00`, guests: 2, status: "Await Check-in", note: "Late night drinks [TEST DATA]" },
      { customer_id: 12, created_by_staff: 3, area_id: 3, table_id: 5, start_at: `${tomorrowStr}T18:15:00`, end_at: `${tomorrowStr}T20:15:00`, guests: 4, status: "Occupied", note: "Near window [TEST DATA]" },
      { customer_id: 13, created_by_staff: 4, area_id: 2, table_id: 11, start_at: `${tomorrowStr}T19:00:00`, end_at: `${tomorrowStr}T21:00:00`, guests: 2, status: "Reject Check-out", note: "[TEST DATA]" },
      { customer_id: 7, created_by_staff: 14, area_id: 4, table_id: 19, start_at: `${tomorrowStr}T19:45:00`, end_at: `${tomorrowStr}T22:00:00`, guests: 6, status: "Await Check-in", note: "Require child seat [TEST DATA]" },
      { customer_id: 8, created_by_staff: 3, area_id: 3, table_id: null, start_at: `${tomorrowStr}T20:00:00`, end_at: `${tomorrowStr}T22:00:00`, guests: 2, status: "Pending Payment", note: "Corner table [TEST DATA]" },
      { customer_id: 9, created_by_staff: 4, area_id: 1, table_id: 12, start_at: `${tomorrowStr}T20:30:00`, end_at: `${tomorrowStr}T22:30:00`, guests: 5, status: "Occupied", note: "[TEST DATA]" },
      { customer_id: 10, created_by_staff: 14, area_id: 3, table_id: 8, start_at: `${tomorrowStr}T21:00:00`, end_at: `${tomorrowStr}T23:00:00`, guests: 3, status: "Check-out", note: "[TEST DATA]" },
      { customer_id: 11, created_by_staff: 3, area_id: 2, table_id: 10, start_at: `${tomorrowStr}T18:45:00`, end_at: `${tomorrowStr}T20:45:00`, guests: 2, status: "Await Check-in", note: "Quiet area [TEST DATA]" },
      { customer_id: 12, created_by_staff: 4, area_id: 1, table_id: null, start_at: `${tomorrowStr}T20:00:00`, end_at: `${tomorrowStr}T22:00:00`, guests: 4, status: "Reject Request", note: "[TEST DATA]" }
    ];

    const createdIds = [];

    for (const r of testReservations) {
      // Insert reservation
      const [insertRes] = await pool.query(
        `INSERT INTO dbo.Reservations
           (customer_id, created_by_staff_id, preferred_area_id,
            reservation_start_at, reservation_end_at, guest_count,
            special_request, reservation_status, reservation_source,
            confirmed_by_staff_id, confirmed_at)
         OUTPUT INSERTED.reservation_id
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, N'Walk-in', ?, SYSDATETIME())`,
        [
          r.customer_id, r.created_by_staff, r.area_id,
          r.start_at, r.end_at, r.guests,
          r.note,
          r.status,
          r.status === "Confirmed" ? managerId : null,
        ]
      );
      const newId = insertRes[0].reservation_id;
      createdIds.push(newId);

      // Assign table if one exists and is explicitly a number
      if (typeof r.table_id === 'number') {
        console.log("Inserting table_id:", r.table_id, "type:", typeof r.table_id, "for res:", newId);
        await pool.query(
          `INSERT INTO dbo.ReservationTables
             (reservation_id, table_id, assigned_by_staff_id, assigned_at)
           VALUES (?, ?, ?, SYSDATETIME())`,
          [newId, r.table_id, r.created_by_staff]
        );
        if (r.status === "Confirmed" || r.status === "Await Check-in") {
          await pool.query(
            `UPDATE dbo.RestaurantTables SET table_status = N'Reserved', updated_at = SYSDATETIME() WHERE table_id = ?`,
            [r.table_id]
          );
        } else if (r.status === "Check-in" || r.status === "Occupied") {
          await pool.query(
            `UPDATE dbo.RestaurantTables SET table_status = N'Occupied', updated_at = SYSDATETIME() WHERE table_id = ?`,
            [r.table_id]
          );
        }
      }

      // Audit log
      await pool.query(
        `INSERT INTO dbo.AuditLogs
           (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address)
         VALUES (?, N'SEED_TEST_RESERVATION', N'Reservations', ?,
                 NULL,
                 ?,
                 ?)`,
        [
          managerId, newId,
          JSON.stringify({ reservation_status: r.status, customer_id: r.customer_id }),
          req.ip || "127.0.0.1",
        ]
      );
    }

    // Notify all connected clients so Staff dashboard refreshes in real time
    const io = getIO();
    if (io) {
      io.to("room:staff").to("room:manager").emit("reservation:batch_seeded", {
        created: createdIds.length,
        ids: createdIds,
        message: "Test reservations added — please refresh.",
      });
    }

    return res.json({
      success: true,
      created: createdIds.length,
      reservation_ids: createdIds,
    });
  } catch (error) {
    console.error("[CRITICAL BACKEND ERROR]: seedTestReservations:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============================================================================
// DELETE /api/manager/reservations/clear-test
// Manager clears test reservations created by seed-test
// ============================================================================
export const clearTestReservations = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(`
      SELECT reservation_id FROM dbo.Reservations
      WHERE special_request LIKE N'%[TEST DATA]%'
         OR (reservation_source = N'Walk-in' AND customer_id IN (7, 8, 9, 10, 11, 12, 13) AND created_by_staff_id IN (3, 4, 14) AND created_at >= CAST(GETDATE() AS DATE))
    `);

    const ids = rows.map(r => r.reservation_id);

    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');

      await connection.query(`DELETE FROM dbo.PreorderItems WHERE reservation_id IN (${placeholders})`, ids);
      await connection.query(`DELETE FROM dbo.AuditLogs WHERE target_table = N'Reservations' AND target_id IN (${placeholders})`, ids);
      await connection.query(`DELETE FROM dbo.ReservationTables WHERE reservation_id IN (${placeholders})`, ids);

      // Delete Orders and OrderItems to avoid FK constraint error
      // Note: order_id is needed to delete OrderItems
      const [orderRows] = await connection.query(`SELECT order_id FROM dbo.Orders WHERE reservation_id IN (${placeholders})`, ids);
      if (orderRows.length > 0) {
        const orderIds = orderRows.map(o => o.order_id);
        const orderPlaceholders = orderIds.map(() => '?').join(',');

        const [paymentRows] = await connection.query(`SELECT payment_id FROM dbo.Payments WHERE order_id IN (${orderPlaceholders})`, orderIds);
        if (paymentRows.length > 0) {
          const paymentIds = paymentRows.map(p => p.payment_id);
          const paymentPlaceholders = paymentIds.map(() => '?').join(',');
          await connection.query(`DELETE FROM dbo.VoucherRedemptions WHERE payment_id IN (${paymentPlaceholders})`, paymentIds);
        }

        await connection.query(`DELETE FROM dbo.CustomerReviews WHERE order_id IN (${orderPlaceholders})`, orderIds);
        await connection.query(`DELETE FROM dbo.Payments WHERE order_id IN (${orderPlaceholders})`, orderIds);
        await connection.query(`DELETE FROM dbo.OrderItems WHERE order_id IN (${orderPlaceholders})`, orderIds);
        await connection.query(`DELETE FROM dbo.Orders WHERE order_id IN (${orderPlaceholders})`, orderIds);
      }

      await connection.query(`DELETE FROM dbo.QROrderSessions WHERE reservation_id IN (${placeholders})`, ids);

      // Free tables if occupied
      await connection.query(`
        UPDATE t SET table_status = N'Available'
        FROM dbo.RestaurantTables t
        JOIN dbo.ReservationTables rt ON t.table_id = rt.table_id
        WHERE rt.reservation_id IN (${placeholders})
      `, ids);

      await connection.query(`DELETE FROM dbo.Reservations WHERE reservation_id IN (${placeholders})`, ids);
    }

    await connection.commit();

    const io = getIO();
    if (io) {
      io.to("room:staff").to("room:manager").emit("reservation:batch_seeded", {
        deleted: ids.length,
        message: "Test reservations cleared — please refresh.",
      });
    }

    return res.json({
      success: true,
      deleted: ids.length,
    });
  } catch (error) {
    try { await connection.rollback(); } catch (_) { }
    console.error("[CRITICAL BACKEND ERROR]: clearTestReservations:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  } finally {
    connection.release();
  }
};
