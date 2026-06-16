import pool from "../db.js";
import { getIO } from "../socket.js";
import { resolveShift } from "../services/shiftResolver.js";

// GET /api/staff/reservations
export const getStaffReservations = async (req, res) => {
  const dateStr = req.query.date || new Date().toISOString().split('T')[0];
  const staffUserId = req.userId;

  try {
    const [rows] = await pool.query(
      `SELECT
          r.reservation_id,
          ua.full_name AS customer_name,
          ua.phone AS customer_phone,
          cp.username,
          cp.membership_tier,
          r.reservation_start_at,
          r.reservation_end_at,
          r.guest_count,
          r.special_request,
          r.reservation_status,
          r.checked_in_at,
          STRING_AGG(t.table_number, ', ') AS assigned_tables,
          MAX(CAST(ISNULL(n.is_read, 1) AS INT)) AS notification_read_inverted
      FROM dbo.Reservations r
      LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
      LEFT JOIN dbo.CustomerProfiles cp ON r.customer_id = cp.user_id
      LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
      LEFT JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
      LEFT JOIN dbo.Notifications n ON n.user_id = ?
          AND n.message_body LIKE CONCAT('%#', r.reservation_id, '%')
      WHERE CAST(r.reservation_start_at AS DATE) = ?
        AND r.reservation_status IN (N'Confirmed', N'Checked In', N'No Show', N'Completed')
      GROUP BY r.reservation_id, ua.full_name, ua.phone, cp.username, cp.membership_tier,
               r.reservation_start_at, r.reservation_end_at, r.guest_count,
               r.special_request, r.reservation_status, r.checked_in_at
      ORDER BY r.reservation_start_at ASC`,
      [staffUserId, dateStr]
    );

    // Note: Since we inverted `is_read` with MAX logic to get one row per reservation, 
    // a value of 0 means there's an unread notification. 1 means all read.
    const mappedRows = rows.map(r => ({
      ...r,
      notification_read: r.notification_read_inverted === 1
    }));

    res.json({ success: true, reservations: mappedRows });
  } catch (error) {
    console.error("Error fetching staff reservations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/staff/reservations/:id/checkin
export const checkinReservation = async (req, res) => {
  const reservationId = req.params.id;
  const staffUserId = req.userId;

  try {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [updateResult] = await connection.query(
        `UPDATE dbo.Reservations
         SET reservation_status = N'Checked In',
             checked_in_at      = SYSDATETIME(),
             updated_at         = SYSDATETIME()
         OUTPUT INSERTED.customer_id
         WHERE reservation_id = ?
           AND reservation_status = N'Confirmed'`,
        [reservationId]
      );

      if (!updateResult || updateResult.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ success: false, message: "Reservation is not confirmed or already checked in" });
      }

      const customerId = updateResult[0].customer_id;

      // Audit log
      await connection.query(
        `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
         VALUES (?, N'CHECK_IN_RESERVATION', N'Reservations', ?, ?, ?, ?, SYSDATETIME())`,
        [
          staffUserId,
          reservationId,
          JSON.stringify({ reservation_status: "Confirmed" }),
          JSON.stringify({ reservation_status: "Checked In" }),
          req.ip
        ]
      );

      // Reservation History
      await connection.query(
        `INSERT INTO dbo.ReservationHistory (reservation_id, action_name, actor_user_id, notes, created_at)
         VALUES (?, N'Staff Checked In', ?, N'Staff successfully checked in the reservation.', SYSDATETIME())`,
        [reservationId, staffUserId]
      );

      // Notify customer if customer_id is not NULL
      if (customerId) {
        await connection.query(
          `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
           VALUES (?, N'Booking Confirmed', N'Welcome to Phūrai!', N'Your reservation has been checked in. Enjoy your dining experience.', 0, SYSDATETIME())`,
          [customerId]
        );
      }

      await connection.commit();
      connection.release();

      const io = getIO();
      if (io) {
        io.to("room:manager").emit("reservation:checked_in", {
          reservation_id: parseInt(reservationId)
        });
      }

      res.json({ success: true, message: "Checked in successfully" });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error("Error checking in reservation:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
      await connection.beginTransaction();

      const [updateResult] = await connection.query(
        `UPDATE dbo.Reservations
         SET reservation_status = ?,
             cancelled_at       = SYSDATETIME(),
             cancel_reason      = ?,
             updated_at         = SYSDATETIME()
         OUTPUT INSERTED.customer_id
         WHERE reservation_id = ?
           AND reservation_status = N'Confirmed'`,
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
          JSON.stringify({ reservation_status: "Confirmed" }),
          JSON.stringify({ reservation_status: new_status, cancel_reason: reason }),
          req.ip
        ]
      );

      // Reservation History
      await connection.query(
        `INSERT INTO dbo.ReservationHistory (reservation_id, action_name, actor_user_id, notes, created_at)
         VALUES (?, N'Staff Rejected Check-in', ?, ?, SYSDATETIME())`,
        [reservationId, staffUserId, `Status: ${new_status}. Reason: ${reason}`]
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
        io.to("room:manager").emit("reservation:rejected", {
          reservation_id: parseInt(reservationId),
          new_status,
          reason
        });
      }

      res.json({ success: true, message: `Reservation marked as ${new_status}` });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error("Error rejecting reservation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
