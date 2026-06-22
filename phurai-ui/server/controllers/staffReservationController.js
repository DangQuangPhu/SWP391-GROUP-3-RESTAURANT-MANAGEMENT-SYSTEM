import pool from "../db.js";
import { getIO } from "../socket.js";
import { resolveShift } from "../services/shiftResolver.js";
import { sendBookingCheckedInEmail, sendBookingRejectedEmail } from "../email.js";
import { processPreordersToKds } from "../services/kdsIntegrationService.js";
import { RESERVATION_STATUS } from "../../src/shared/reservationStatus.js";

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/staff/reservations/today-shift
//
// Returns ONLY today's Confirmed/Checked-In reservations whose start time falls
// within the requesting staff member's currently scheduled shift.
//
// Security invariant: an INNER JOIN on StaffSchedules + Shifts guarantees that
// if the staff member has no schedule today, zero rows are returned — no data
// leaks to unscheduled staff members.
// ──────────────────────────────────────────────────────────────────────────────
export const getTodayShiftReservations = async (req, res) => {
  const staffId = req.userId;

  if (!staffId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: staff identity could not be resolved.",
    });
  }

  try {
        let dateCondition = "";
        const queryParams = [staffId];

        // Ensure "all", "All Dates", or empty strings are ignored
        const isValidDate = (d) => d && typeof d === 'string' && d.toLowerCase() !== "all" && d.toLowerCase() !== "all dates" && d.trim() !== "";

        const sd = isValidDate(req.query.startDate) ? req.query.startDate : null;
        const ed = isValidDate(req.query.endDate) ? req.query.endDate : null;

        if (sd && ed) {
            dateCondition = "AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) BETWEEN ? AND ?";
            queryParams.push(sd, ed);
        } else if (sd) {
            dateCondition = "AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) >= ?";
            queryParams.push(sd);
        } else if (ed) {
            dateCondition = "AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) <= ?";
            queryParams.push(ed);
        }

        const [rows] = await pool.query(
            `SELECT
                r.reservation_id,
                COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
                COALESCE(ua.phone, r.contact_phone) AS customer_phone,
                COALESCE(ua.email, r.contact_email) AS customer_email,
                cp.username,
                cp.membership_tier,
                r.reservation_start_at,
                r.reservation_end_at,
                r.guest_count,
                r.special_request,
                r.reservation_status,
                CASE WHEN r.has_pending_request = 1
                     THEN N'Request'
                     ELSE r.reservation_status
                END AS display_status,
                r.created_at,
                r.checked_in_at,
                STRING_AGG(t.table_number, ', ') AS assigned_tables,
                sh.shift_name,
                sh.start_time       AS shift_start_time,
                sh.end_time         AS shift_end_time
             FROM dbo.Reservations r
             LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
             LEFT JOIN dbo.CustomerProfiles cp ON r.customer_id = cp.user_id
             LEFT JOIN dbo.ReservationTables res_t ON r.reservation_id = res_t.reservation_id
             LEFT JOIN dbo.RestaurantTables t ON res_t.table_id = t.table_id
             LEFT JOIN dbo.StaffSchedules ss ON ss.user_id = ? AND ss.work_date = CAST(r.reservation_start_at AS DATE)
             LEFT JOIN dbo.Shifts sh ON sh.shift_id = ss.shift_id AND sh.is_active = 1
             WHERE
                 r.reservation_status NOT IN (N'${RESERVATION_STATUS.PENDING_PAYMENT}', N'${RESERVATION_STATUS.PENDING_LEGACY}', N'${RESERVATION_STATUS.REJECT_REQUEST}', N'${RESERVATION_STATUS.REJECT_CHECK_IN}', N'${RESERVATION_STATUS.REJECT_CHECK_OUT}', N'${RESERVATION_STATUS.CANCELLED}')
                 ${dateCondition}
             GROUP BY
                 r.reservation_id, ua.full_name, r.contact_name, ua.phone, r.contact_phone,
                 ua.email, r.contact_email, cp.username, cp.membership_tier, r.reservation_start_at,
                 r.reservation_end_at, r.guest_count, r.special_request, r.reservation_status,
                 r.has_pending_request, r.created_at, r.checked_in_at, sh.shift_name, sh.start_time, sh.end_time
             ORDER BY 
                 CASE r.reservation_status
                     WHEN N'${RESERVATION_STATUS.AWAIT_CHECK_IN}' THEN 1
                     WHEN N'${RESERVATION_STATUS.CHECK_IN}' THEN 2
                     WHEN N'${RESERVATION_STATUS.OCCUPIED}' THEN 3
                     WHEN N'${RESERVATION_STATUS.COMPLETE_PAID}' THEN 4
                     WHEN N'${RESERVATION_STATUS.CHECK_OUT}' THEN 5
                     WHEN N'${RESERVATION_STATUS.PENDING_PAYMENT}' THEN 6
                     WHEN N'${RESERVATION_STATUS.REJECT_CHECK_IN}' THEN 7
                     ELSE 8
                 END ASC,
                 r.reservation_start_at ASC`,
            queryParams
        );

    return res.json({
      success: true,
      reservations: rows,
    });
  } catch (error) {
    console.error("[getTodayShiftReservations] Query failed:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching shift reservations.",
    });
  }
};



// GET /api/staff/reservations/:id
// Returns a single reservation with full detail + preorder items
export const getStaffReservationDetail = async (req, res) => {
  const reservationId = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT
          r.reservation_id,
          COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
          COALESCE(ua.phone, r.contact_phone) AS customer_phone,
          COALESCE(ua.email, r.contact_email) AS customer_email,
          cp.username, cp.membership_tier,
          r.reservation_start_at, r.reservation_end_at, r.guest_count,
          r.special_request, r.reservation_status, r.reservation_source,
          r.created_at, r.checked_in_at,
          STRING_AGG(t.table_number, ', ') AS assigned_tables,
          MAX(a.area_name) AS area_name
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.CustomerProfiles cp ON r.customer_id = cp.user_id
       LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
       LEFT JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
       LEFT JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
       WHERE r.reservation_id = ?
       GROUP BY r.reservation_id, ua.full_name, ua.phone, ua.email,
                r.contact_name, r.contact_phone, r.contact_email,
                cp.username, cp.membership_tier,
                r.reservation_start_at, r.reservation_end_at, r.guest_count,
                r.special_request, r.reservation_status, r.reservation_source,
                r.created_at, r.checked_in_at`,
      [reservationId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    const [preorderRows] = await pool.query(
      `SELECT pi.preorder_item_id, pi.dish_id, pi.quantity, pi.unit_price,
              pi.notes, pi.created_at,
              d.dish_name, d.price
       FROM dbo.PreorderItems pi
       LEFT JOIN dbo.Dishes d ON pi.dish_id = d.dish_id
       WHERE pi.reservation_id = ?
       ORDER BY pi.created_at ASC`,
      [reservationId]
    );

    return res.json({
      success: true,
      reservation: {
        ...rows[0],
        preorders: preorderRows,
      },
    });
  } catch (error) {
    console.error('[getStaffReservationDetail] error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// PATCH /api/staff/reservations/:id/checkin
export const checkinReservation = async (req, res) => {
  const reservationId = req.params.id;
  const staffUserId = req.userId;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Protocol #6: Stale-data guard — fetch current status for informative 409
    const [currentRows] = await connection.query(
      `SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    if (!currentRows || currentRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }
    const currentStatus = currentRows[0].reservation_status;

    // Fetch staff name for AuditLog
    const [staffRows] = await connection.query(
      `SELECT full_name FROM dbo.UserAccounts WHERE user_id = ?`,
      [staffUserId]
    );
    const staffName = staffRows[0]?.full_name || `Staff #${staffUserId}`;

    const [updateResult] = await connection.query(
      `DECLARE @OutputTbl TABLE (customer_id INT, checked_in_at DATETIME2);
       UPDATE dbo.Reservations
       SET reservation_status    = N'${RESERVATION_STATUS.OCCUPIED}',
           checked_in_at         = SYSDATETIME(),
           confirmed_by_staff_id = ?,
           updated_at            = SYSDATETIME()
       OUTPUT INSERTED.customer_id, INSERTED.checked_in_at INTO @OutputTbl
       WHERE reservation_id = ?
         AND reservation_status = N'${RESERVATION_STATUS.CONFIRMED}';
       SELECT customer_id, checked_in_at FROM @OutputTbl;`,
      [staffUserId, reservationId]
    );

    if (!updateResult || updateResult.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        success: false,
        message: `Conflict: reservation is currently '${currentStatus}', expected 'Confirmed'.`,
        current_status: currentStatus,
      });
    }

    const customerId = updateResult[0].customer_id;
    const checkedInAt = updateResult[0]?.checked_in_at || new Date().toISOString();

    // Update table status to Occupied
    await connection.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Occupied', updated_at = SYSDATETIME()
       WHERE table_id IN (
         SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = ?
       )`,
      [reservationId]
    );

    // Audit log
    await connection.query(
      `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'STAFF_CHECKIN_CONFIRMED', N'Reservations', ?, ?, ?, ?, SYSDATETIME())`,
      [
        staffUserId,
        reservationId,
        JSON.stringify({ reservation_status: RESERVATION_STATUS.CONFIRMED }),
        JSON.stringify({ reservation_status: RESERVATION_STATUS.OCCUPIED, staff_name: staffName, checked_in_at: checkedInAt }),
        req.ip
      ]
    );

    // Notify customer if customer_id is not NULL
    if (customerId) {
      await connection.query(
        `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
         VALUES (?, N'Booking Confirmed', N'Welcome to Phūrai!', N'Your reservation has been checked in. Enjoy your dining experience.', 0, SYSDATETIME())`,
        [customerId]
      );
    }

    // Feature 1: Process Preorders to KDS within the SAME transaction
    let kdsResult = null;
    try {
      kdsResult = await processPreordersToKds(reservationId, connection, staffUserId);
    } catch (kdsErr) {
      // Only throw if it's a critical error (e.g. no table assigned).
      console.error("Auto-KDS error during check-in:", kdsErr.message);
      if (kdsErr.message.includes("No table assigned")) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: "Cannot check in: Please assign a table first so preorders can be sent to the kitchen." 
        });
      }
      throw kdsErr; 
    }

    await connection.commit();
    connection.release();

    // =========================================================================
    // ISOLATED FIRE-AND-FORGET: SOCKET.IO
    // =========================================================================
    try {
      const io = getIO();
      if (io) {
        const statusPayload = {
          reservation_id: parseInt(reservationId),
          new_status: 'Occupied',
          staff_name: staffName,
          timestamp: checkedInAt,
        };
        io.to('room:manager').emit('reservation:status_changed', statusPayload);
        io.to('room:staff').emit('reservation:status_changed', statusPayload);

        if (kdsResult) {
          const kitchenPayload = {
            reservation_id: parseInt(reservationId, 10),
            order_id: kdsResult.orderId,
            item_count: kdsResult.itemCount,
            sent_by: staffUserId,
            timestamp: new Date().toISOString(),
          };
          io.to('room:kitchen').emit('kitchen:new_preorder', kitchenPayload);
          io.to('room:manager').emit('kitchen:new_preorder', kitchenPayload);
          io.to('room:staff').emit('reservation:kitchen_sent', {
            reservation_id: parseInt(reservationId, 10),
            item_count: kdsResult.itemCount,
          });
        }
      }
    } catch (socketErr) {
      console.error("[Socket.IO] Error emitting checkin status:", socketErr);
    }

    // =========================================================================
    // ISOLATED FIRE-AND-FORGET: EMAIL
    // =========================================================================
    try {
      // Ensure we run this async operation completely detached from the main flow
      setImmediate(async () => {
        try {
          const [rows] = await pool.query(
            `SELECT COALESCE(ua.email, r.contact_email, N'') AS customer_email,
                    COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
                    r.reservation_start_at
             FROM dbo.Reservations r
             LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
             WHERE r.reservation_id = ?`,
            [reservationId]
          );
          const row = rows[0];
          if (row?.customer_email) {
            const d = new Date(row.reservation_start_at);
            await sendBookingCheckedInEmail({
              toEmail: row.customer_email,
              customerName: row.customer_name,
              reservationId,
              reservationDate: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
              reservationTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
            });
          }
        } catch (emailInnerErr) {
          console.error("[checkin email query] Failed to send email:", emailInnerErr?.message || emailInnerErr);
        }
      });
    } catch (emailErr) {
      console.error("[Email Dispatch] Error kicking off email:", emailErr);
    }

    res.json({
      success: true,
      message: 'Check-in confirmed.',
      checked_in_at: checkedInAt,
      new_status: 'Occupied',
      staff_name: staffName,
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch (rollbackErr) {
        console.error("Error rolling back connection:", rollbackErr);
      }
    }
    console.error("Error checking in reservation:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// PATCH /api/staff/reservations/:id/reject
export const rejectReservation = async (req, res) => {
  const reservationId = req.params.id;
  const staffUserId = req.userId;
  const { reason, new_status } = req.body;

  if (new_status !== 'No Show' && new_status !== 'Cancelled' && new_status !== 'Check-in Rejected') {
    return res.status(400).json({ success: false, message: "new_status must be 'No Show', 'Cancelled', or 'Check-in Rejected'" });
  }

  try {
    const connection = await pool.getConnection();

    try {
      // Security Guardrail: Backend RBAC Enforcement
      const [roleRows] = await connection.query(
        `SELECT r.role_name FROM dbo.UserAccounts ua INNER JOIN dbo.Roles r ON ua.role_id = r.role_id WHERE ua.user_id = ?`,
        [staffUserId]
      );
      const roleName = roleRows[0]?.role_name;
      if (roleName === 'Restaurant Staff' && new_status !== RESERVATION_STATUS.NO_SHOW) {
        connection.release();
        return res.status(403).json({ success: false, message: "Forbidden: Staff are not allowed to manually reject or cancel reservations. Only No Show is permitted." });
      }

      await connection.beginTransaction();

      const [updateResult] = await connection.query(
        `DECLARE @OutputTbl TABLE (customer_id INT);
         UPDATE dbo.Reservations
         SET reservation_status = ?,
             cancelled_at       = SYSDATETIME(),
             cancel_reason      = ?,
             updated_at         = SYSDATETIME()
         OUTPUT INSERTED.customer_id INTO @OutputTbl
         WHERE reservation_id = ?
           AND reservation_status = N'Confirmed';
         SELECT customer_id FROM @OutputTbl;`,
        [new_status, reason, reservationId]
      );

      if (!updateResult || updateResult.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ success: false, message: "Reservation is not confirmed" });
      }

      const customerId = updateResult[0].customer_id;

      // Audit log
      await connection.query(
        `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
         VALUES (?, N'REJECT_RESERVATION', N'Reservations', ?, ?, ?, ?, SYSDATETIME())`,
        [
          staffUserId,
          reservationId,
          JSON.stringify({ reservation_status: RESERVATION_STATUS.CONFIRMED }),
          JSON.stringify({ reservation_status: new_status, cancel_reason: reason }),
          req.ip
        ]
      );



      // Notify customer if customer_id is not NULL
      if (customerId) {
        await connection.query(
          `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
           VALUES (?, N'Booking Rejected', N'Your reservation could not be verified', ?, 0, SYSDATETIME())`,
          [customerId, reason]
        );
      }

      await connection.commit();
      connection.release();

      const io = getIO();
      if (io) {
        const payload = { reservation_id: parseInt(reservationId), new_status, reason };
        io.to("room:manager").emit("reservation:rejected", payload);
        io.to("room:staff").emit("reservation:rejected", payload);
      }

      // Fire-and-forget: send rejection email
      pool.query(
        `SELECT COALESCE(ua.email, r.contact_email, N'') AS customer_email,
                COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name
         FROM dbo.Reservations r
         LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
         WHERE r.reservation_id = ?`,
        [reservationId]
      ).then(([rows]) => {
        const row = rows[0];
        if (row?.customer_email) {
          sendBookingRejectedEmail({
            toEmail: row.customer_email,
            customerName: row.customer_name,
            reservationId,
            reason: reason || undefined,
          }).catch(e => console.error("[rejectEmail]", e?.message));
        }
      }).catch(e => console.error("[reject email query]", e?.message));

      res.json({ success: true, message: `Reservation marked as ${new_status}` });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('Error rejecting reservation:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/staff/reservations/:id/checkout-confirm
// Staff manually confirms the checkout after payment auto-triggers CheckedOut.
// Inserts STAFF_CHECKOUT_CONFIRMED AuditLog row.
// ──────────────────────────────────────────────────────────────────────────────
export const confirmCheckout = async (req, res) => {
  const reservationId = req.params.id;
  const staffUserId = req.userId;

  try {
    const [staffRows] = await pool.query(
      `SELECT full_name FROM dbo.UserAccounts WHERE user_id = ?`,
      [staffUserId]
    );
    const staffName = staffRows[0]?.full_name || `Staff #${staffUserId}`;

    // Verify the reservation is in CheckedOut state
    const [resRows] = await pool.query(
      `SELECT reservation_status, checked_out_at FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    if (!resRows.length) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }
    if (resRows[0].reservation_status !== RESERVATION_STATUS.CHECK_OUT) {
      return res.status(409).json({
        success: false,
        message: `Reservation is '${resRows[0].reservation_status}', expected '${RESERVATION_STATUS.CHECK_OUT}'.`,
      });
    }

    const checkedOutAt = resRows[0].checked_out_at || new Date().toISOString();

    await pool.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, new_value_json, ip_address, created_at)
       VALUES (?, N'STAFF_CHECKOUT_CONFIRMED', N'Reservations', ?, ?, ?, SYSDATETIME())`,
      [
        staffUserId,
        reservationId,
        JSON.stringify({ status: RESERVATION_STATUS.CHECK_OUT, staff_name: staffName, checked_out_at: checkedOutAt }),
        req.ip,
      ]
    );

    res.json({
      success: true,
      message: 'Checkout confirmed.',
      checked_out_at: checkedOutAt,
      staff_name: staffName,
    });
  } catch (error) {
    console.error('Error confirming checkout:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/staff/reservations/:reservationId/send-cooking-queue
// ──────────────────────────────────────────────────────────────────────────────
import { createOrder } from "../services/orderService.js";

export const sendCookingQueue = async (req, res) => {
  const reservationId = req.params.reservationId;
  const staffUserId = req.userId;

  try {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [resRows] = await connection.query(
        `SELECT r.reservation_id, r.reservation_status, r.customer_id, rt.table_id 
         FROM dbo.Reservations r
         LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
         WHERE r.reservation_id = ?`,
        [reservationId]
      );

      if (resRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Reservation not found' });
      }

      const reservation = resRows[0];

      if (reservation.reservation_status !== RESERVATION_STATUS.OCCUPIED && reservation.reservation_status !== RESERVATION_STATUS.CHECK_IN) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({
          success: false,
          message: `Cannot send cooking queue: reservation status is '${reservation.reservation_status}', must be 'Occupied' or 'Checked In'`
        });
      }

      const kdsResult = await processPreordersToKds(reservationId, connection, staffUserId);

      if (!kdsResult) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({
          success: false,
          message: `No preorder items found, or cooking queue already sent. Cannot send twice.`
        });
      }

      const { orderId, itemCount } = kdsResult;

      // Note: processPreordersToKds already writes a system-auto AuditLog, but since this is manual,
      // we'll update that specific AuditLog to reflect manual action.
      await connection.query(
        `UPDATE dbo.AuditLogs 
         SET action_name = N'Staff Manual Send Cooking Queue',
             new_value_json = ? 
         WHERE user_id = ? AND target_id = ? AND target_table = N'Reservations' AND action_name = N'System Auto Send Cooking Queue' AND created_at >= DATEADD(minute, -1, SYSDATETIME())`,
        [JSON.stringify({ order_id: orderId, queued_items: itemCount, sent_by_staff: true }), staffUserId, reservationId]
      );

      await connection.commit();
      connection.release();

      const io = getIO();
      if (io) {
        const kitchenPayload = {
          reservation_id: parseInt(reservationId, 10),
          order_id: orderId,
          item_count: itemCount,
          sent_by: staffUserId,
          timestamp: new Date().toISOString(),
        };
        io.to('room:kitchen').emit('kitchen:new_preorder', kitchenPayload);
        io.to('room:manager').emit('kitchen:new_preorder', kitchenPayload);
        io.to('room:staff').emit('reservation:kitchen_sent', {
          reservation_id: parseInt(reservationId, 10),
          item_count: itemCount,
        });
      }

      res.json({
        success: true,
        message: `Sent ${itemCount} item(s) to kitchen queue as Order #${orderId}`,
        orderId
      });

    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('[staffReservationController] sendCookingQueue error:', error);
    res.status(500).json({ success: false, message: 'Failed to send cooking queue', error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/staff/reservations/:id/check-in
// ──────────────────────────────────────────────────────────────────────────────
export const staffCheckIn = async (req, res) => {
  const staffUserId = req.userId;
  const reservationId = parseInt(req.params.id, 10);

  if (isNaN(reservationId)) {
    return res.status(400).json({ success: false, message: 'Invalid reservation ID' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Ensure reservation exists and is ready for check-in
      const [resRows] = await connection.query(
        `SELECT reservation_status, table_ids = STUFF((SELECT ',' + CAST(table_id AS VARCHAR) FROM dbo.ReservationTables WHERE reservation_id = r.reservation_id FOR XML PATH('')), 1, 1, '')
         FROM dbo.Reservations r
         WHERE r.reservation_id = ? WITH (UPDLOCK, HOLDLOCK)`,
        [reservationId]
      );

      if (resRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Reservation not found' });
      }

      const reservation = resRows[0];

      if (!reservation.table_ids) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: 'Reservation has no assigned tables. Cannot check-in.' });
      }

      const allowedFrom = [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.AWAIT_CHECK_IN, RESERVATION_STATUS.RESERVED];
      if (!allowedFrom.includes(reservation.reservation_status)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: `Cannot check-in from status: ${reservation.reservation_status}` });
      }

      const tableIdList = reservation.table_ids.split(',').map(Number);

      // Update reservation status to Check-in
      await connection.query(
        `UPDATE dbo.Reservations 
         SET reservation_status = ?, checked_in_at = SYSDATETIME(), updated_at = SYSDATETIME()
         WHERE reservation_id = ?`,
        [RESERVATION_STATUS.CHECK_IN, reservationId]
      );

      // Update mapped tables to Occupied
      const placeholders = tableIdList.map(() => '?').join(',');
      await connection.query(
        `UPDATE dbo.RestaurantTables
         SET table_status = 'Occupied', updated_at = SYSDATETIME()
         WHERE table_id IN (${placeholders})`,
        [...tableIdList]
      );

      // Insert into AuditLogs
      const safeValueJson = JSON.stringify({ reservation_status: RESERVATION_STATUS.CHECK_IN });
      await connection.query(
        `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
         VALUES (?, 'STAFF_MANUAL_CHECKIN', 'Reservations', ?, ?, SYSDATETIME())`,
        [staffUserId, reservationId, safeValueJson]
      );

      await connection.commit();

      const io = getIO();
      if (io) {
        io.emit('RESERVATION_STATUS_CHANGED', { id: reservationId, status: RESERVATION_STATUS.CHECK_IN });
        tableIdList.forEach(tId => {
          io.emit('TABLE_STATUS_CHANGED', { tableId: tId, newStatus: 'Occupied' });
        });
      }

      connection.release();
      res.json({ success: true, message: 'Successfully checked in.' });

    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('[staffReservationController] staffCheckIn error:', error);
    res.status(500).json({ success: false, message: 'Failed to check in reservation' });
  }
};


