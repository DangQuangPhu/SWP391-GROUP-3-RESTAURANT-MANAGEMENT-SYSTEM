import pool from "../db.js";
import { getIO } from "../socket.js";
import { resolveShift } from "../services/shiftResolver.js";

// GET /api/manager/reservations/pending
export const getPendingReservations = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.reservation_id,
         ua.full_name AS customer_name,
         ua.phone AS customer_phone,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         r.created_at,
         r.preferred_area_id,
         a.area_name AS preferred_area
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
       WHERE r.reservation_status = N'Pending'
       ORDER BY r.reservation_start_at ASC`
    );
    res.json({ success: true, reservations: rows });
  } catch (error) {
    console.error("Error fetching pending reservations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/manager/reservations/all
export const getAllReservations = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.reservation_id,
         ua.full_name AS customer_name,
         ua.phone AS customer_phone,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         r.created_at,
         r.confirmed_at,
         r.checked_in_at,
         r.cancelled_at,
         r.cancel_reason,
         STRING_AGG(t.table_number, ', ') AS assigned_tables
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
       LEFT JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
       GROUP BY r.reservation_id, ua.full_name, ua.phone, r.reservation_start_at,
                r.reservation_end_at, r.guest_count, r.special_request,
                r.reservation_status, r.created_at, r.confirmed_at,
                r.checked_in_at, r.cancelled_at, r.cancel_reason
       ORDER BY r.reservation_start_at DESC`
    );
    res.json({ success: true, reservations: rows });
  } catch (error) {
    console.error("Error fetching all reservations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/manager/reservations/:id/confirm
export const confirmReservation = async (req, res) => {
  const reservationId = req.params.id;
  const { table_ids } = req.body;
  const managerId = req.userId;

  try {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Step 1: Update Reservation
      const [updateResult] = await connection.query(
        `UPDATE dbo.Reservations
         SET reservation_status    = N'Confirmed',
             confirmed_by_staff_id = ?,
             confirmed_at          = SYSDATETIME(),
             updated_at            = SYSDATETIME()
         OUTPUT INSERTED.reservation_start_at, INSERTED.customer_id, INSERTED.guest_count, INSERTED.preferred_area_id, INSERTED.special_request
         WHERE reservation_id = ?
           AND reservation_status = N'Pending'`,
        [managerId, reservationId]
      );

      if (!updateResult || updateResult.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ success: false, message: "Reservation already confirmed or does not exist" });
      }

      const resData = updateResult[0];
      const reservationStartAt = resData.reservation_start_at;

      // Fetch Customer details
      let customerName = "Guest";
      let customerPhone = "";
      if (resData.customer_id) {
        const [custRows] = await connection.query(
          `SELECT full_name, phone FROM dbo.UserAccounts WHERE user_id = ?`,
          [resData.customer_id]
        );
        if (custRows.length > 0) {
          customerName = custRows[0].full_name;
          customerPhone = custRows[0].phone;
        }
      }
      
      let areaName = "General";
      if (resData.preferred_area_id) {
         const [areaRows] = await connection.query(
          `SELECT area_name FROM dbo.RestaurantAreas WHERE area_id = ?`,
          [resData.preferred_area_id]
        );
        if (areaRows.length > 0) {
          areaName = areaRows[0].area_name;
        }
      }

      // Step 2: Assign Tables
      const assignedTableNumbers = [];
      if (Array.isArray(table_ids) && table_ids.length > 0) {
        for (const tId of table_ids) {
          await connection.query(
            `INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id, assigned_at)
             VALUES (?, ?, ?, SYSDATETIME())`,
            [reservationId, tId, managerId]
          );
          await connection.query(
            `UPDATE dbo.RestaurantTables SET table_status = N'Reserved' WHERE table_id = ?`,
            [tId]
          );
          
          const [tRows] = await connection.query(`SELECT table_number FROM dbo.RestaurantTables WHERE table_id = ?`, [tId]);
          if(tRows.length > 0) assignedTableNumbers.push(tRows[0].table_number);
        }
      }

      // Step 3: Query Staff Users
      let staffUserIds = [];
      const [staffRows] = await connection.query(
        `SELECT u.user_id
         FROM dbo.UserAccounts u
         JOIN dbo.Roles r ON u.role_id = r.role_id
         WHERE r.role_name = N'Restaurant Staff'
           AND u.is_active = 1`
      );
      staffUserIds = staffRows.map(r => r.user_id);

      // Step 5: Insert Notifications
      // For Staff
      for (const sUserId of staffUserIds) {
        await connection.query(
          `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
           VALUES (?, N'Booking Confirmed', N'Reservation Confirmed — Check-in Required', ?, 0, SYSDATETIME())`,
          [sUserId, `Reservation #${reservationId} confirmed for ${customerName}, ${resData.guest_count} guests, arriving at ${new Date(reservationStartAt).toLocaleTimeString()}. Please verify upon walk-in.`]
        );
      }
      
      // For Manager
      await connection.query(
          `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
           VALUES (?, N'Booking Confirmed', N'You confirmed Reservation #${reservationId}', N'You have successfully confirmed the reservation.', 0, SYSDATETIME())`,
          [managerId]
      );

      // For Customer
      if (resData.customer_id) {
        await connection.query(
          `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
           VALUES (?, N'Booking Confirmed', N'Reservation Processed', N'Your reservation has been successfully processed.', 0, SYSDATETIME())`,
          [resData.customer_id]
        );
      }

      // Step 6: Insert into AuditLogs
      await connection.query(
        `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
         VALUES (?, N'CONFIRM_RESERVATION', N'Reservations', ?, ?, ?, ?, SYSDATETIME())`,
        [
          managerId, 
          reservationId, 
          JSON.stringify({ reservation_status: "Pending" }), 
          JSON.stringify({ reservation_status: "Confirmed", confirmed_by_staff_id: managerId }),
          req.ip
        ]
      );

      // Step 6b: Insert into ReservationHistory
      await connection.query(
        `INSERT INTO dbo.ReservationHistory (reservation_id, action_name, actor_user_id, notes, created_at)
         VALUES (?, N'Manager Confirmed', ?, N'Manager confirmed reservation and assigned tables.', SYSDATETIME())`,
        [reservationId, managerId]
      );

      await connection.commit();
      connection.release();

      // Step 7: Emit WebSockets
      const io = getIO();
      if (io) {
        // Event A -> Manager
        io.to("room:manager").emit("reservation:status_updated", {
          reservation_id: parseInt(reservationId),
          new_status: "Confirmed"
        });

        // Event B -> Staff
        io.to("room:staff").emit("reservation:confirmed", {
          reservation_id: parseInt(reservationId),
          customer_name: customerName,
          customer_phone: customerPhone,
          reservation_start_at: reservationStartAt,
          guest_count: resData.guest_count,
          preferred_area: areaName,
          assigned_tables: assignedTableNumbers,
          special_request: resData.special_request,
          message: "New reservation confirmed. Please verify customer upon walk-in."
        });

        // Event C -> Customer
        if (resData.customer_id) {
          io.to(`customer_${resData.customer_id}`).emit("reservation:processed", {
            reservation_id: parseInt(reservationId),
            message: "Your reservation has been successfully processed."
          });
        }
      }

      res.json({ success: true, message: "Reservation confirmed" });

    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error("Error confirming reservation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/manager/reservations/:id/history
export const getReservationHistory = async (req, res) => {
  const reservationId = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT
          rh.history_id,
          rh.action_name,
          rh.reservation_id,
          ua.full_name AS performed_by,
          rh.notes,
          rh.created_at
      FROM dbo.ReservationHistory rh
      LEFT JOIN dbo.UserAccounts ua ON rh.actor_user_id = ua.user_id
      WHERE rh.reservation_id = ?
      ORDER BY rh.created_at ASC`,
      [reservationId]
    );
    res.json({ success: true, history: rows });
  } catch (error) {
    console.error("Error fetching reservation history:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/manager/reservations/:id/reject
export const rejectReservation = async (req, res) => {
  const reservationId = req.params.id;
  const { reason } = req.body;
  const managerId = req.userId;

  try {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [updateResult] = await connection.query(
        `UPDATE dbo.Reservations
         SET reservation_status = N'Rejected',
             cancelled_at       = SYSDATETIME(),
             cancel_reason      = ?,
             updated_at         = SYSDATETIME()
         OUTPUT INSERTED.customer_id
         WHERE reservation_id = ? AND reservation_status = N'Pending'`,
        [reason, reservationId]
      );

      if (!updateResult || updateResult.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ success: false, message: "Reservation cannot be rejected or does not exist" });
      }

      await connection.query(
        `INSERT INTO dbo.ReservationHistory (reservation_id, action_name, actor_user_id, notes, created_at)
         VALUES (?, N'Manager Rejected', ?, ?, SYSDATETIME())`,
        [reservationId, managerId, reason]
      );

      const customerId = updateResult[0].customer_id;
      if (customerId) {
        await connection.query(
          `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
           VALUES (?, N'Booking Rejected', N'Reservation Update', N'Your reservation has been rejected. Reason: ' + ISNULL(?, ''), 0, SYSDATETIME())`,
          [customerId, reason]
        );
      }

      await connection.commit();
      connection.release();

      const io = getIO();
      if (io) {
        io.to("room:manager").emit("reservation:status_updated", {
          reservation_id: parseInt(reservationId),
          new_status: "Rejected"
        });
        if (customerId) {
          io.to(`customer_${customerId}`).emit("reservation:processed", {
            reservation_id: parseInt(reservationId),
            message: "Your reservation has been rejected."
          });
        }
      }

      res.json({ success: true, message: "Reservation rejected" });
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

// PATCH /api/manager/reservations/:id/cancel
export const cancelReservation = async (req, res) => {
  const reservationId = req.params.id;
  const { reason } = req.body;
  const managerId = req.userId;

  try {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [updateResult] = await connection.query(
        `UPDATE dbo.Reservations
         SET reservation_status = N'Cancelled',
             cancelled_at       = SYSDATETIME(),
             cancel_reason      = ?,
             updated_at         = SYSDATETIME()
         OUTPUT INSERTED.customer_id
         WHERE reservation_id = ? AND reservation_status IN (N'Pending', N'Confirmed')`,
        [reason, reservationId]
      );

      if (!updateResult || updateResult.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ success: false, message: "Reservation cannot be cancelled or does not exist" });
      }

      // Free up assigned tables if any
      await connection.query(
        `UPDATE dbo.RestaurantTables 
         SET table_status = N'Available' 
         WHERE table_id IN (
             SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = ?
         )`,
        [reservationId]
      );

      await connection.query(
        `INSERT INTO dbo.ReservationHistory (reservation_id, action_name, actor_user_id, notes, created_at)
         VALUES (?, N'Manager Cancelled', ?, ?, SYSDATETIME())`,
        [reservationId, managerId, reason]
      );

      const customerId = updateResult[0].customer_id;
      if (customerId) {
        await connection.query(
          `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
           VALUES (?, N'Booking Cancelled', N'Reservation Update', N'Your reservation has been cancelled. Reason: ' + ISNULL(?, ''), 0, SYSDATETIME())`,
          [customerId, reason]
        );
      }

      await connection.commit();
      connection.release();

      const io = getIO();
      if (io) {
        io.to("room:manager").emit("reservation:status_updated", {
          reservation_id: parseInt(reservationId),
          new_status: "Cancelled"
        });
        io.to("room:staff").emit("reservation:status_updated", {
          reservation_id: parseInt(reservationId),
          new_status: "Cancelled"
        });
        if (customerId) {
          io.to(`customer_${customerId}`).emit("reservation:processed", {
            reservation_id: parseInt(reservationId),
            message: "Your reservation has been cancelled."
          });
        }
      }

      res.json({ success: true, message: "Reservation cancelled" });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
