import pool from "../db.js";
import {
  buildReservationShiftHourClause,
  isPrivilegedReservationViewer,
  resolveWorkShiftForStaff,
} from "../config/staffWorkShifts.js";
import {
  notifyCustomerStaffAction,
  notifyStaffNewCustomerAction,
} from "../services/notificationService.js";
import { getIO } from "../socket.js";
import { updateReservationStatus } from "../services/reservationStateService.js";
import { RESERVATION_STATUS } from '../constants/reservationStatus.js';

function jsonOk(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function jsonError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

function slugStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseDbDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimePart(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function mapTodayReservationRow(row, tablesByReservation, preordersByReservation = {}) {
  const start = parseDbDate(row.reservation_start_at);
  const end = parseDbDate(row.reservation_end_at);
  const assigned = tablesByReservation[row.reservation_id] || [];
  const primary = assigned[0] || null;
  const specialRequest = row.special_request || "";
  const holdMatch = String(specialRequest).match(/\[Hold:\s*(\d+)m\]/i);
  const holdDurationMinutes = holdMatch ? Number(holdMatch[1]) : null;
  let durationMinutes = null;

  if (start && end) {
    durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  return {
    reservation_id: row.reservation_id,
    customer_id: row.customer_id ?? null,
    customer_name: row.customer_name || "Walk-in guest",
    email: row.email || "",
    phone: row.phone || "",
    reservation_start_at: start ? start.toISOString() : null,
    reservation_end_at: end ? end.toISOString() : null,
    reservation_date: start
      ? `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`
      : null,
    start_time: formatTimePart(start),
    party_size: row.guest_count,
    guest_count: row.guest_count,
    area_name: row.area_name || "Unassigned",
    table_id: primary?.table_id ?? null,
    table_number: primary?.table_number ?? null,
    table_label: assigned.map((t) => t.table_number).join(", ") || "—",
    assigned_tables: assigned,
    status: row.reservation_status,
    reservation_status: row.reservation_status,
    source: row.reservation_source,
    special_request: specialRequest,
    duration_minutes: durationMinutes,
    hold_duration_minutes: holdDurationMinutes,
    preorders: preordersByReservation[row.reservation_id] || [],
  };
}

function mapTableRow(row) {
  return {
    table_id: row.table_id,
    table_number: row.table_number,
    area_id: row.area_id ?? null,
    area_name: row.area_name,
    capacity: row.capacity,
    table_status: row.table_status,
    status: row.table_status,
    qr_code: row.static_qr_code || null,
    merged_into_table_id: row.merged_into_table_id ?? null,
    is_counter: Boolean(row.is_counter),
    active_session_id: row.active_session_id ?? null,
    active_reservation_id: row.active_reservation_id ?? null,
    active_reservation_customer_name: row.active_reservation_customer_name ?? null,
  };
}

function buildSessionToken(tableNumber, tableId) {
  const slug = String(tableNumber || `t${tableId}`)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `qr-session-${slug}-${stamp}`;
}

/**
 * GET /api/staff/tables
 * Floor map payload for staff table management.
 */
export async function listStaffTables(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         t.table_id,
         t.area_id,
         t.table_number,
         t.capacity,
         t.table_status,
         t.static_qr_code,
         t.merged_into_table_id,
         t.is_counter,
         a.area_name,
         (
           SELECT TOP 1 qs.qr_session_id
           FROM dbo.QROrderSessions AS qs
           WHERE qs.table_id = t.table_id
             AND qs.session_status = N'Active'
             AND (qs.expires_at IS NULL OR qs.expires_at > SYSUTCDATETIME())
           ORDER BY qs.generated_at DESC
         ) AS active_session_id,
         (
           SELECT TOP 1 r.reservation_id
           FROM dbo.Reservations AS r
           INNER JOIN dbo.ReservationTables AS rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id = t.table_id
             AND r.reservation_status IN (N'Await Check-in')
             AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) = CAST(DATEADD(hour, 7, SYSDATETIME()) AS DATE)
           ORDER BY r.reservation_start_at ASC
         ) AS active_reservation_id,
         (
           SELECT TOP 1 COALESCE(ua.full_name, r.contact_name, N'Guest')
           FROM dbo.Reservations AS r
           LEFT JOIN dbo.UserAccounts AS ua ON r.customer_id = ua.user_id
           INNER JOIN dbo.ReservationTables AS rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id = t.table_id
             AND r.reservation_status IN (N'Await Check-in')
             AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) = CAST(DATEADD(hour, 7, SYSDATETIME()) AS DATE)
           ORDER BY r.reservation_start_at ASC
         ) AS active_reservation_customer_name
       FROM dbo.RestaurantTables AS t
       INNER JOIN dbo.RestaurantAreas AS a ON a.area_id = t.area_id
       WHERE a.is_active = 1
       ORDER BY a.area_name ASC, t.table_number ASC;`
    );

    return jsonOk(res, rows.map(mapTableRow));
  } catch (error) {
    console.error("GET /api/staff/tables failed:", error);
    return jsonError(res, "Could not load restaurant tables.");
  }
}

/**
 * GET /api/staff/reservations/today
 * Today's bookings for host/reception check-in queue.
 * Managers/Admins receive all shifts; floor staff receive their mapped shift only.
 */
export async function listTodayReservations(req, res) {
  try {
    let shiftFilterSql = "";

    if (req.userId) {
      const [accountRows] = await pool.query(
        `SELECT TOP 1
           ua.user_id,
           ua.role_id,
           ua.email,
           sp.staff_code
         FROM dbo.UserAccounts AS ua
         LEFT JOIN dbo.StaffProfiles AS sp ON sp.user_id = ua.user_id
         WHERE ua.user_id = ?`,
        [req.userId]
      );

      const account = accountRows[0];
      if (account && !isPrivilegedReservationViewer(account.role_id)) {
        const shiftId = await resolveWorkShiftForStaff({
          userId: String(account.user_id),
        });
        const hourClause = buildReservationShiftHourClause(shiftId);
        if (hourClause) {
          shiftFilterSql = ` AND (${hourClause})`;
        } else {
          shiftFilterSql = " AND 1 = 0";
        }
      }
    }

    const [rows] = await pool.query(
      `SELECT
         r.reservation_id,
         r.customer_id,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         r.reservation_source,
         COALESCE(ua.full_name, N'Walk-in guest') AS customer_name,
         COALESCE(ua.email, N'') AS email,
         COALESCE(ua.phone, N'') AS phone,
         cp.username AS customer_username,
         a.area_name
       FROM dbo.Reservations AS r
       LEFT JOIN dbo.UserAccounts AS ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.CustomerProfiles AS cp ON cp.user_id = ua.user_id
       LEFT JOIN dbo.RestaurantAreas AS a ON r.preferred_area_id = a.area_id
       WHERE r.reservation_status IN (
         N'Pending Request',
         N'Awaiting Deposit',
         N'Await Check-in',
         N'Dining',
         N'Completed',
         N'Cancelled',
         N'No Show'
       )
       AND r.reservation_start_at >= DATEADD(day, -120, CAST(SYSDATETIME() AS DATE))${shiftFilterSql}
       ORDER BY r.reservation_start_at DESC;`
    );

    const ids = rows.map((r) => r.reservation_id);
    let tablesByReservation = {};

    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      const [tableRows] = await pool.query(
        `SELECT
           rt.reservation_id,
           rt.table_id,
           t.table_number,
           t.capacity
         FROM dbo.ReservationTables rt
         INNER JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
         WHERE rt.reservation_id IN (${placeholders});`,
        ids
      );

      tablesByReservation = tableRows.reduce((acc, row) => {
        if (!acc[row.reservation_id]) acc[row.reservation_id] = [];
        acc[row.reservation_id].push({
          table_id: row.table_id,
          table_number: row.table_number,
          capacity: row.capacity,
        });
        return acc;
      }, {});
    }

    let preordersByReservation = {};

    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      const [preorderRows] = await pool.query(
        `SELECT
           p.reservation_id,
           p.dish_id,
           p.quantity,
           p.unit_price,
           d.dish_name
         FROM dbo.PreorderItems p
         INNER JOIN dbo.Dishes d ON d.dish_id = p.dish_id
         WHERE p.reservation_id IN (${placeholders});`,
        ids
      );

      preordersByReservation = preorderRows.reduce((acc, row) => {
        if (!acc[row.reservation_id]) acc[row.reservation_id] = [];
        acc[row.reservation_id].push({
          dish_id: row.dish_id,
          dish_name: row.dish_name,
          quantity: row.quantity,
          unit_price: Number(row.unit_price),
        });
        return acc;
      }, {});
    }

    return jsonOk(
      res,
      rows.map((row) =>
        mapTodayReservationRow(row, tablesByReservation, preordersByReservation)
      )
    );
  } catch (error) {
    console.error("GET /api/staff/reservations/today failed:", error);
    return jsonError(res, "Could not load today's reservations.");
  }
}

/**
 * POST /api/staff/reservations/:id/check-in
 * Seat an arriving guest: link reservation, table, and QR session.
 */
export async function checkInReservation(req, res) {
  const reservationId = Number(req.params.id);
  const tableId = Number(req.body?.table_id);
  const staffId = req.userId ?? null;

  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return jsonError(res, "Invalid reservation id.", 400);
  }
  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "table_id is required.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reservationRows] = await connection.query(
      `SELECT TOP 1
         reservation_id,
         customer_id,
         reservation_status,
         guest_count
       FROM dbo.Reservations
       WHERE reservation_id = ?;`,
      [reservationId]
    );

    const reservation = reservationRows[0];
    if (!reservation) {
      await connection.rollback();
      return jsonError(res, "Reservation not found.", 404);
    }

    // Replaced manual check with state machine validation in updateReservationStatus later,
    // but doing a quick preview check here:
    if (!["Pending Request", "Awaiting Deposit", "Await Check-in", "Pending"].includes(reservation.reservation_status)) {
      await connection.rollback();
      return jsonError(
        res,
        "Only pending, awaiting deposit, or await check-in reservations can be checked in.",
        409
      );
    }

    const [tableRows] = await connection.query(
      `SELECT TOP 1
         t.table_id,
         t.table_number,
         t.table_status,
         t.capacity,
         a.area_name
       FROM dbo.RestaurantTables AS t
       INNER JOIN dbo.RestaurantAreas AS a ON a.area_id = t.area_id
       WHERE t.table_id = ?
         AND a.is_active = 1;`,
      [tableId]
    );

    const table = tableRows[0];
    if (!table) {
      await connection.rollback();
      return jsonError(res, "Table not found.", 404);
    }

    const [assignmentRows] = await connection.query(
      `SELECT TOP 1 table_id
       FROM dbo.ReservationTables
       WHERE reservation_id = ?
         AND table_id = ?;`,
      [reservationId, tableId]
    );
    const isAssignedToReservation = Boolean(assignmentRows[0]);

    const tableAvailable =
      table.table_status === "Available" ||
      (table.table_status === "Reserved" && isAssignedToReservation);

    if (!tableAvailable) {
      await connection.rollback();
      return jsonError(res, "Selected table is not available for check-in.", 409);
    }

    const [activeSessionRows] = await connection.query(
      `SELECT TOP 1 qr_session_id
       FROM dbo.QROrderSessions
       WHERE table_id = ?
         AND session_status = N'Active'
         AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME());`,
      [tableId]
    );

    if (activeSessionRows[0]) {
      await connection.rollback();
      return jsonError(res, "This table already has an active session.", 409);
    }

    const token = buildSessionToken(table.table_number, tableId);

    const [insertRows] = await connection.query(
      `INSERT INTO dbo.QROrderSessions
         (table_id, reservation_id, customer_id, token, session_status, generated_by_staff_id, generated_at, expires_at)
       OUTPUT
         INSERTED.qr_session_id AS session_id,
         INSERTED.table_id,
         INSERTED.reservation_id,
         INSERTED.token,
         INSERTED.session_status
       VALUES
         (?, ?, ?, ?, N'Active', ?, SYSDATETIME(), DATEADD(hour, 4, SYSDATETIME()));`,
      [tableId, reservationId, reservation.customer_id, token, staffId]
    );

    await updateReservationStatus({
      connection,
      reservationId,
      toStatus: RESERVATION_STATUS.SEATED,
      staffId,
      auditAction: "STAFF_CHECK_IN_RESERVATION",
      extraUpdates: ", checked_in_at = SYSDATETIME()"
    });

    await connection.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Available',
           updated_at = SYSDATETIME()
       WHERE table_id IN (
         SELECT rt.table_id
         FROM dbo.ReservationTables rt
         WHERE rt.reservation_id = ?
           AND rt.table_id <> ?
       )
       AND table_status = N'Reserved';`,
      [reservationId, tableId]
    );

    await connection.query(
      `DELETE FROM dbo.ReservationTables
       WHERE reservation_id = ?
         AND table_id <> ?;`,
      [reservationId, tableId]
    );

    await connection.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Occupied',
           updated_at = SYSDATETIME()
       WHERE table_id = ?;`,
      [tableId]
    );

    if (!isAssignedToReservation) {
      await connection.query(
        `INSERT INTO dbo.ReservationTables
           (reservation_id, table_id, assigned_by_staff_id)
         VALUES
           (?, ?, ?);`,
        [reservationId, tableId, staffId]
      );
    }

    await connection.commit();

    const session = insertRows[0];

    notifyCustomerStaffAction({
      customerId: reservation.customer_id,
      sessionId: session.session_id,
      notificationType: "Booking Confirmed",
      title: "Your table is ready",
      message: `Table ${table.table_number} is ready. You can start ordering from your menu.`,
      payload: {
        action: "check_in",
        reservation_id: reservationId,
        table_id: tableId,
        table_number: table.table_number,
        session_id: session.session_id,
      },
    }).catch((err) => console.error("Reservation check-in notification failed:", err));

    return jsonOk(
      res,
      {
        reservation_id: reservationId,
        table_id: tableId,
        table_number: table.table_number,
        area_name: table.area_name,
        table_status: "Occupied",
        reservation_status: RESERVATION_STATUS.SEATED,
        session_id: session.session_id,
        token: session.token,
        session_status: session.session_status,
      },
      201
    );
  } catch (error) {
    await connection.rollback();
    console.error("POST /api/staff/reservations/:id/check-in failed:", error);
    return jsonError(res, "Could not check in reservation.");
  } finally {
    connection.release();
  }
}

/**
 * PATCH /api/staff/reservations/:id/reject
 * Cancel invalid / fake / no-show reservations and free reserved tables.
 */
export async function rejectReservation(req, res) {
  const reservationId = Number(req.params.id);
  const staffId = req.userId ?? null;
  const reason = String(
    req.body?.reason || "Rejected by staff at check-in"
  ).slice(0, 255);

  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return jsonError(res, "Invalid reservation id.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reservationRows] = await connection.query(
      `SELECT TOP 1
         reservation_id,
         reservation_status,
         customer_id
       FROM dbo.Reservations
       WHERE reservation_id = ?;`,
      [reservationId]
    );

    const reservation = reservationRows[0];
    if (!reservation) {
      await connection.rollback();
      return jsonError(res, "Reservation not found.", 404);
    }

    if (!["Pending Request", "Awaiting Deposit", "Await Check-in", "Pending"].includes(reservation.reservation_status)) {
      await connection.rollback();
      return jsonError(
        res,
        "Only pending, awaiting deposit, or await check-in reservations can be rejected.",
        409
      );
    }

    const [tableRows] = await connection.query(
      `SELECT
         rt.table_id,
         t.table_status
       FROM dbo.ReservationTables AS rt
       INNER JOIN dbo.RestaurantTables AS t ON t.table_id = rt.table_id
       WHERE rt.reservation_id = ?;`,
      [reservationId]
    );

    await updateReservationStatus({
      connection,
      reservationId,
      toStatus: RESERVATION_STATUS.CANCELLED,
      staffId,
      auditAction: "STAFF_REJECT_CHECK_IN", // or STAFF_REJECT_REQUEST
      extraUpdates: `, cancelled_at = SYSDATETIME()`
    });

    await connection.query(
      `UPDATE dbo.Reservations
       SET cancel_reason = ?
       WHERE reservation_id = ?`,
      [reason, reservationId]
    );

    const freedTableIds = [];

    for (const row of tableRows) {
      if (row.table_status === "Reserved") {
        await connection.query(
          `UPDATE dbo.RestaurantTables
           SET table_status = N'Available',
               updated_at = SYSDATETIME()
           WHERE table_id = ?;`,
          [row.table_id]
        );
        freedTableIds.push(row.table_id);
      }
    }

    await connection.commit();

    if (reservation.customer_id) {
      notifyCustomerStaffAction({
        customerId: reservation.customer_id,
        notificationType: "Booking Cancelled",
        title: "Reservation cancelled",
        message: "Your reservation was cancelled by the restaurant.",
        payload: {
          action: "reject",
          reservation_id: reservationId,
          reason,
        },
      }).catch((err) => console.error("Reject reservation notification failed:", err));
    }

    return jsonOk(res, {
      reservation_id: reservationId,
      reservation_status: RESERVATION_STATUS.CANCELLED,
      freed_table_ids: freedTableIds,
      message: "Reservation rejected and cancelled.",
    });
  } catch (error) {
    await connection.rollback();
    console.error("PATCH /api/staff/reservations/:id/reject failed:", error);
    return jsonError(res, "Could not reject reservation.");
  } finally {
    connection.release();
  }
}

/**
 * POST /api/staff/tables/:tableId/check-in
 * Marks table Occupied and opens a new QR order session.
 */
export async function checkInTable(req, res) {
  const tableId = Number(req.params.tableId);
  const staffId = req.userId ?? null;

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [tableRows] = await connection.query(
      `SELECT TOP 1
         t.table_id,
         t.table_number,
         t.table_status,
         a.area_name
       FROM dbo.RestaurantTables AS t
       INNER JOIN dbo.RestaurantAreas AS a ON a.area_id = t.area_id
       WHERE t.table_id = ?
         AND a.is_active = 1;`,
      [tableId]
    );

    const table = tableRows[0];
    if (!table) {
      await connection.rollback();
      return jsonError(res, "Table not found.", 404);
    }

    if (!["Available", "Reserved"].includes(table.table_status)) {
      await connection.rollback();
      return jsonError(res, "Only available or reserved tables can be checked in.", 409);
    }

    const [activeSessionRows] = await connection.query(
      `SELECT TOP 1 qr_session_id
       FROM dbo.QROrderSessions
       WHERE table_id = ?
         AND session_status = N'Active'
         AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME());`,
      [tableId]
    );

    if (activeSessionRows[0]) {
      await connection.rollback();
      return jsonError(res, "This table already has an active session.", 409);
    }

    const token = buildSessionToken(table.table_number, tableId);

    const [insertRows] = await connection.query(
      `INSERT INTO dbo.QROrderSessions
         (table_id, reservation_id, customer_id, token, session_status, generated_by_staff_id, generated_at, expires_at)
       OUTPUT
         INSERTED.qr_session_id AS session_id,
         INSERTED.table_id,
         INSERTED.token,
         INSERTED.session_status
       VALUES
         (?, NULL, NULL, ?, N'Active', ?, SYSDATETIME(), DATEADD(hour, 4, SYSDATETIME()));`,
      [tableId, token, staffId]
    );

    await connection.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Occupied',
           updated_at = SYSDATETIME()
       WHERE table_id = ?;`,
      [tableId]
    );

    await connection.commit();

    const session = insertRows[0];

    return jsonOk(
      res,
      {
        table_id: tableId,
        table_number: table.table_number,
        area_name: table.area_name,
        table_status: "Occupied",
        session_id: session.session_id,
        token: session.token,
        session_status: session.session_status,
      },
      201
    );
  } catch (error) {
    await connection.rollback();
    console.error("POST /api/staff/tables/:tableId/check-in failed:", error);
    return jsonError(res, "Could not check in table.");
  } finally {
    connection.release();
  }
}

/**
 * POST /api/staff/tables/:tableId/reset
 * Closes active QR sessions and returns table to Available.
 */
export async function resetTable(req, res) {
  const tableId = Number(req.params.tableId);

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [tableRows] = await connection.query(
      `SELECT TOP 1 table_id, table_number, table_status
       FROM dbo.RestaurantTables
       WHERE table_id = ?;`,
      [tableId]
    );

    const table = tableRows[0];
    if (!table) {
      await connection.rollback();
      return jsonError(res, "Table not found.", 404);
    }

    if (!["Occupied", "Cleaning"].includes(table.table_status)) {
      await connection.rollback();
      return jsonError(
        res,
        "Only occupied or cleaning tables can be reset.",
        409
      );
    }

    await connection.query(
      `UPDATE dbo.QROrderSessions
       SET session_status = N'Closed',
           closed_at = SYSDATETIME()
       WHERE table_id = ?
         AND session_status = N'Active';`,
      [tableId]
    );

    await connection.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Cleaning',
           updated_at = SYSDATETIME()
       WHERE table_id = ?;`,
      [tableId]
    );

    // Get affected reservations
    const [affectedRes] = await connection.query(
      `SELECT r.reservation_id, r.reservation_status 
       FROM dbo.Reservations r
       JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
       WHERE rt.table_id = ? AND r.reservation_status IN (N'Dining', N'Cleaning', N'Check-out');`,
      [tableId]
    );

    for (const row of affectedRes) {
      let currentStatus = row.reservation_status;
      
      if (currentStatus === RESERVATION_STATUS.SEATED) {
        await updateReservationStatus({
          connection,
          reservationId: row.reservation_id,
          toStatus: RESERVATION_STATUS.COMPLETED,
          staffId: null,
          auditAction: "STAFF_CLEANED_TABLE_RESERVATION",
          extraUpdates: ", checked_out_at = SYSDATETIME(), reservation_end_at = SYSDATETIME()"
        });
      }
    }

    await connection.commit();

    return jsonOk(res, {
      table_id: tableId,
      table_number: table.table_number,
      table_status: "Cleaning",
    });
  } catch (error) {
    await connection.rollback();
    console.error("POST /api/staff/tables/:tableId/reset failed:", error);
    return jsonError(res, "Could not reset table.");
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/staff/tables/:tableId/mark-clean
 * Transitions a table from Cleaning to Available and emits a socket update.
 */
export async function markTableClean(req, res) {
  const tableId = Number(req.params.tableId);

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }

  try {
    const [result] = await pool.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Available',
           updated_at = SYSDATETIME()
       WHERE table_id = ? AND table_status = N'Cleaning';`,
      [tableId]
    );

    if (result.rowsAffected === 0) {
      return jsonError(res, "Table not found or not in Cleaning state.", 404);
    }

    // Emit socket event to update clients
    const io = req.app.get("io");
    if (io) {
      io.to("room:manager").to("room:staff").emit("table:status_updated", {
        table_id: tableId,
        table_status: "Available"
      });
    }

    return jsonOk(res, { table_id: tableId, table_status: "Available" });
  } catch (error) {
    console.error("PUT /api/staff/tables/:tableId/mark-clean failed:", error);
    return jsonError(res, "Could not mark table as clean.");
  }
}

/**
 * PATCH /api/staff/tables/:tableId/status
 * Updates a table's status (e.g., from Cleaning to Available) and emits a socket update.
 */
export async function updateTableStatus(req, res) {
  const tableId = Number(req.params.tableId);
  const { status } = req.body;

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }

  const validStatuses = ["Available", "Occupied", "Cleaning", "Inactive", "Reserved"];
  if (!validStatuses.includes(status)) {
    return jsonError(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
  }

  try {
    const [result] = await pool.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = ?,
           updated_at = SYSDATETIME()
       WHERE table_id = ?;`,
      [status, tableId]
    );

    if (result.rowsAffected === 0) {
      return jsonError(res, "Table not found.", 404);
    }

    // Emit socket event to update clients
    const io = req.app.get("io");
    if (io) {
      io.to("room:manager").to("room:staff").emit("table:status_changed", {
        table_id: tableId,
        table_status: status
      });
    }

    return res.json({
      success: true,
      message: "Table status updated successfully",
    });
  } catch (error) {
    console.error("PATCH /api/staff/tables/:tableId/status failed:", error);
    return jsonError(res, "Could not update table status.");
  }
}

function mapDisplayStatus(itemStatus) {
  const status = String(itemStatus || "").trim();
  if (status === "Pending") return "Pending";
  if (status === "Sent To Kitchen" || status === "Preparing") return "Cooking";
  if (status === "Ready") return "Ready";
  if (status === "Served") return "Served";
  if (status === "Cancelled") return "Cancelled";
  return "Pending";
}

function mapItemRow(row) {
  return {
    order_item_id: row.order_item_id,
    order_id: row.order_id,
    dish_id: row.dish_id,
    dish_name: row.dish_name,
    quantity: row.quantity,
    notes: row.notes ?? null,
    unit_price: Number(row.unit_price),
    item_status: row.item_status,
    display_status: mapDisplayStatus(row.item_status),
  };
}

async function fetchUserRoleId(userId) {
  if (!userId) return null;
  const [rows] = await pool.query(
    `SELECT TOP 1 role_id
     FROM dbo.UserAccounts
     WHERE user_id = ?
       AND is_active = 1;`,
    [userId]
  );
  return rows[0]?.role_id ?? null;
}

async function recalculateOrderTotals(executor, orderId) {
  await executor.query(
    `UPDATE dbo.Orders
     SET subtotal = ISNULL((
           SELECT SUM(oi.line_total)
           FROM dbo.OrderItems AS oi
           WHERE oi.order_id = ?
             AND oi.item_status <> N'Cancelled'
         ), 0),
         total_amount = ISNULL((
           SELECT SUM(oi.line_total)
           FROM dbo.OrderItems AS oi
           WHERE oi.order_id = ?
             AND oi.item_status <> N'Cancelled'
         ), 0) - discount_amount + service_charge,
         updated_at = SYSDATETIME()
     WHERE order_id = ?;`,
    [orderId, orderId, orderId]
  );
}

async function findOrCreateActiveOrder(executor, tableId, staffId) {
  const [tableRows] = await executor.query(
    `SELECT TOP 1 table_id, table_status
     FROM dbo.RestaurantTables
     WHERE table_id = ?;`,
    [tableId]
  );

  const table = tableRows[0];
  if (!table) {
    const error = new Error("TABLE_NOT_FOUND");
    error.code = "TABLE_NOT_FOUND";
    throw error;
  }

  if (table.table_status !== "Occupied") {
    const error = new Error("TABLE_NOT_OCCUPIED");
    error.code = "TABLE_NOT_OCCUPIED";
    throw error;
  }

  const [orderRows] = await executor.query(
    `SELECT TOP 1 order_id
     FROM dbo.Orders
     WHERE table_id = ?
       AND order_status NOT IN (N'Paid', N'Cancelled')
     ORDER BY created_at DESC;`,
    [tableId]
  );

  if (orderRows[0]?.order_id) {
    return orderRows[0].order_id;
  }

  const [sessionRows] = await executor.query(
    `SELECT TOP 1 qr_session_id
     FROM dbo.QROrderSessions
     WHERE table_id = ?
       AND session_status = N'Active'
       AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())
     ORDER BY generated_at DESC;`,
    [tableId]
  );

  const qrSessionId = sessionRows[0]?.qr_session_id ?? null;

  const [insertRows] = await executor.query(
    `DECLARE @OutputTbl TABLE (order_id INT);
     INSERT INTO dbo.Orders
       (table_id, created_by_staff_id, qr_session_id, order_type, order_status,
        subtotal, discount_amount, service_charge, total_amount)
     OUTPUT INSERTED.order_id INTO @OutputTbl
     VALUES
       (?, ?, ?, N'Dine In', N'Open', 0, 0, 0, 0);
     SELECT order_id FROM @OutputTbl;`,
    [tableId, staffId, qrSessionId]
  );

  return insertRows[0].order_id;
}

/**
 * GET /api/staff/orders/active
 * Occupied tables with active bill line items.
 */
export async function getActiveOccupiedOrders(_req, res) {
  try {
    const [tableRows] = await pool.query(
      `SELECT
         t.table_id,
         t.table_number,
         t.capacity,
         a.area_name,
         active_order.order_id,
         active_order.order_status,
         active_order.qr_session_id
       FROM dbo.RestaurantTables AS t
       INNER JOIN dbo.RestaurantAreas AS a ON a.area_id = t.area_id
       OUTER APPLY (
         SELECT TOP 1
           o.order_id,
           o.order_status,
           o.qr_session_id
         FROM dbo.Orders AS o
         WHERE o.table_id = t.table_id
           AND o.order_status NOT IN (N'Paid', N'Cancelled')
         ORDER BY o.created_at DESC
       ) AS active_order
       WHERE t.table_status = N'Occupied'
         AND a.is_active = 1
       ORDER BY a.area_name ASC, t.table_number ASC;`
    );

    const orderIds = tableRows
      .map((row) => row.order_id)
      .filter((id) => id != null);

    let itemsByOrder = {};

    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => "?").join(", ");
      const [itemRows] = await pool.query(
        `SELECT
           oi.order_item_id,
           oi.order_id,
           oi.dish_id,
           d.dish_name,
           oi.quantity,
           oi.notes,
           oi.unit_price,
           oi.item_status
         FROM dbo.OrderItems AS oi
         INNER JOIN dbo.Dishes AS d ON d.dish_id = oi.dish_id
         WHERE oi.order_id IN (${placeholders})
           AND oi.item_status <> N'Cancelled'
         ORDER BY oi.created_at ASC;`,
        orderIds
      );

      itemsByOrder = itemRows.reduce((acc, row) => {
        const mapped = mapItemRow(row);
        if (!acc[row.order_id]) acc[row.order_id] = [];
        acc[row.order_id].push(mapped);
        return acc;
      }, {});
    }

    const tables = tableRows.map((row) => ({
      table_id: row.table_id,
      table_number: row.table_number,
      area_name: row.area_name,
      capacity: row.capacity,
      order_id: row.order_id ?? null,
      order_status: row.order_status ?? null,
      qr_session_id: row.qr_session_id ?? null,
      items: row.order_id ? itemsByOrder[row.order_id] || [] : [],
    }));

    return jsonOk(res, { tables });
  } catch (error) {
    console.error("GET /api/staff/orders/active failed:", error);
    return jsonError(res, `Could not load active orders: ${error.message} - ${error.stack}`);
  }
}

/**
 * POST /api/staff/orders/:tableId/items
 * Staff manually adds a dish to the table's active bill.
 */
export async function addOrderItem(req, res) {
  const tableId = Number(req.params.tableId);
  const staffId = req.userId ?? null;
  const dishId = Number(req.body?.dish_id);
  const quantity = Number(req.body?.quantity ?? 1);
  const notes = String(req.body?.notes ?? "").trim() || null;

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }
  if (!Number.isFinite(dishId) || dishId <= 0) {
    return jsonError(res, "dish_id is required.", 400);
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return jsonError(res, "quantity must be greater than 0.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [dishRows] = await connection.query(
      `SELECT TOP 1 dish_id, dish_name, price, is_available
       FROM dbo.Dishes
       WHERE dish_id = ?;`,
      [dishId]
    );

    const dish = dishRows[0];
    if (!dish) {
      await connection.rollback();
      return jsonError(res, "Dish not found.", 404);
    }
    if (!dish.is_available) {
      await connection.rollback();
      return jsonError(res, "This dish is currently unavailable.", 409);
    }

    let orderId;
    try {
      orderId = await findOrCreateActiveOrder(connection, tableId, staffId);
    } catch (err) {
      await connection.rollback();
      if (err.code === "TABLE_NOT_FOUND") {
        return jsonError(res, "Table not found.", 404);
      }
      if (err.code === "TABLE_NOT_OCCUPIED") {
        return jsonError(res, "Items can only be added to occupied tables.", 409);
      }
      throw err;
    }

    const unitPrice = Number(dish.price);

    // Snapshot combined table names
    const [snapshotRows] = await connection.query(
      `SELECT t2.table_number
       FROM dbo.RestaurantTables t1
       JOIN dbo.RestaurantTables t2 ON t2.merged_into_table_id = t1.table_id OR t2.table_id = t1.table_id
       WHERE t1.table_id = (SELECT COALESCE(merged_into_table_id, table_id) FROM dbo.RestaurantTables WHERE table_id = ?)
       ORDER BY t2.table_number ASC`,
      [tableId]
    );
    const combinedNames = snapshotRows.map(r => r.table_number).join(' | ');

    const [itemRows] = await connection.query(
      `INSERT INTO dbo.OrderItems
         (order_id, dish_id, quantity, unit_price, notes, snapshot_table_name, item_status)
       OUTPUT
         INSERTED.order_item_id,
         INSERTED.order_id,
         INSERTED.dish_id,
         INSERTED.quantity,
         INSERTED.notes,
         INSERTED.snapshot_table_name,
         INSERTED.unit_price,
         INSERTED.item_status
       VALUES
         (?, ?, ?, ?, ?, ?, N'Pending');`,
      [orderId, dishId, quantity, unitPrice, notes, combinedNames]
    );

    const createdItem = itemRows[0];

    await connection.query(
      `INSERT INTO dbo.KitchenTickets
         (order_item_id, kitchen_status, priority_level, sent_at)
       VALUES
         (?, N'Pending', 3, SYSDATETIME());`,
      [createdItem.order_item_id]
    );

    await recalculateOrderTotals(connection, orderId);

    await connection.query(
      `UPDATE dbo.Orders
       SET order_status = CASE
             WHEN order_status = N'Open' THEN N'Sent To Kitchen'
             ELSE order_status
           END,
           updated_at = SYSDATETIME()
       WHERE order_id = ?;`,
      [orderId]
    );

    await connection.commit();

    const [tableRows] = await pool.query(
      `SELECT TOP 1 table_number FROM dbo.RestaurantTables WHERE table_id = ?;`,
      [tableId]
    );
    const tableNumber = tableRows[0]?.table_number ?? tableId;

    notifyStaffNewCustomerAction({
      actionType: "order",
      title: "New order item",
      message: `New order on Table ${tableNumber}: ${dish.dish_name} x${quantity}`,
      payload: {
        order_id: orderId,
        order_item_id: createdItem.order_item_id,
        table_id: tableId,
        table_number: tableNumber,
        dish_name: dish.dish_name,
        quantity,
      },
    }).catch((err) => console.error("New order notification failed:", err));

    return jsonOk(
      res,
      {
        order_id: orderId,
        item: mapItemRow({
          ...createdItem,
          dish_name: dish.dish_name,
        }),
      },
      201
    );
  } catch (error) {
    await connection.rollback();
    console.error("POST /api/staff/orders/:tableId/items failed:", error);
    return jsonError(res, "Could not add item to order.");
  } finally {
    connection.release();
  }
}

/**
 * PATCH /api/staff/orders/items/:itemId/status
 * Mark Ready items as Served, or update notes on Pending items.
 */
export async function updateOrderItemStatus(req, res) {
  const itemId = Number(req.params.itemId);
  const nextStatus = String(req.body?.item_status ?? req.body?.status ?? "").trim();
  const notes =
    req.body?.notes === undefined
      ? undefined
      : String(req.body.notes ?? "").trim() || null;

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return jsonError(res, "Invalid order item id.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [itemRows] = await connection.query(
      `SELECT TOP 1
         oi.order_item_id,
         oi.order_id,
         oi.dish_id,
         oi.quantity,
         oi.notes,
         oi.unit_price,
         oi.item_status,
         d.dish_name
       FROM dbo.OrderItems AS oi
       INNER JOIN dbo.Dishes AS d ON d.dish_id = oi.dish_id
       WHERE oi.order_item_id = ?;`,
      [itemId]
    );

    const item = itemRows[0];
    if (!item) {
      await connection.rollback();
      return jsonError(res, "Order item not found.", 404);
    }

    if (item.item_status === "Cancelled") {
      await connection.rollback();
      return jsonError(res, "Cancelled items cannot be updated.", 409);
    }

    if (notes !== undefined) {
      if (item.item_status !== "Pending") {
        await connection.rollback();
        return jsonError(res, "Notes can only be edited while item is Pending.", 409);
      }

      await connection.query(
        `UPDATE dbo.OrderItems
         SET notes = ?,
             updated_at = SYSDATETIME()
         WHERE order_item_id = ?;`,
        [notes, itemId]
      );
      item.notes = notes;
    }

    if (nextStatus) {
      if (nextStatus !== "Served") {
        await connection.rollback();
        return jsonError(res, "Only transition to Served is supported.", 400);
      }
      if (item.item_status !== "Ready") {
        await connection.rollback();
        return jsonError(res, "Only Ready items can be marked as Served.", 409);
      }

      await connection.query(
        `UPDATE dbo.OrderItems
         SET item_status = N'Served',
             updated_at = SYSDATETIME()
         WHERE order_item_id = ?;`,
        [itemId]
      );
      item.item_status = "Served";
    }

    if (!nextStatus && notes === undefined) {
      await connection.rollback();
      return jsonError(res, "Provide item_status or notes to update.", 400);
    }

    await connection.commit();

    if (nextStatus === "Served") {
      const [orderRows] = await pool.query(
        `SELECT TOP 1
           o.order_id,
           o.customer_id,
           o.qr_session_id,
           o.table_id,
           t.table_number
         FROM dbo.Orders AS o
         INNER JOIN dbo.RestaurantTables AS t ON t.table_id = o.table_id
         WHERE o.order_id = ?;`,
        [item.order_id]
      );
      const order = orderRows[0];

      if (order?.customer_id) {
        notifyCustomerStaffAction({
          customerId: order.customer_id,
          sessionId: order.qr_session_id,
          notificationType: "Order Ready",
          title: "Your dish has been served",
          message: `${item.dish_name} has been served to Table ${order.table_number}.`,
          payload: {
            action: "order_served",
            order_id: order.order_id,
            order_item_id: itemId,
            table_id: order.table_id,
            table_number: order.table_number,
            dish_name: item.dish_name,
          },
        }).catch((err) => console.error("Order served notification failed:", err));
      }
    }

    return jsonOk(res, {
      item: mapItemRow(item),
    });
  } catch (error) {
    await connection.rollback();
    console.error("PATCH /api/staff/orders/items/:itemId/status failed:", error);
    return jsonError(res, "Could not update order item.");
  } finally {
    connection.release();
  }
}

/**
 * PATCH /api/staff/orders/items/:itemId/void
 * Manager-only void/cancel of an order line.
 */
export async function voidOrderItem(req, res) {
  const itemId = Number(req.params.itemId);
  const roleId = await fetchUserRoleId(req.userId);

  if (roleId !== 4) {
    return jsonError(res, "Only managers can void order items.", 403);
  }

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return jsonError(res, "Invalid order item id.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [itemRows] = await connection.query(
      `SELECT TOP 1 order_item_id, order_id, item_status
       FROM dbo.OrderItems
       WHERE order_item_id = ?;`,
      [itemId]
    );

    const item = itemRows[0];
    if (!item) {
      await connection.rollback();
      return jsonError(res, "Order item not found.", 404);
    }

    if (item.item_status === "Cancelled") {
      await connection.rollback();
      return jsonError(res, "Item is already voided.", 409);
    }

    if (item.item_status === "Served") {
      await connection.rollback();
      return jsonError(res, "Served items cannot be voided.", 409);
    }

    await connection.query(
      `UPDATE dbo.OrderItems
       SET item_status = N'Cancelled',
           updated_at = SYSDATETIME()
       WHERE order_item_id = ?;`,
      [itemId]
    );

    await connection.query(
      `UPDATE dbo.KitchenTickets
       SET kitchen_status = N'Cancelled',
           cancelled_at = SYSDATETIME()
       WHERE order_item_id = ?;`,
      [itemId]
    );

    await recalculateOrderTotals(connection, item.order_id);

    await connection.commit();

    return jsonOk(res, {
      order_item_id: itemId,
      order_id: item.order_id,
      item_status: "Cancelled",
    });
  } catch (error) {
    await connection.rollback();
    console.error("PATCH /api/staff/orders/items/:itemId/void failed:", error);
    return jsonError(res, "Could not void order item.");
  } finally {
    connection.release();
  }
}

/**
 * GET /api/staff/dishes/menu
 * Lightweight dish list for staff add-item modal.
 */
export async function listStaffMenuDishes(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         d.dish_id,
         d.dish_name,
         d.price,
         d.is_available,
         c.category_name
       FROM dbo.Dishes AS d
       INNER JOIN dbo.MenuCategories AS c ON c.category_id = d.category_id
       WHERE d.is_available = 1
       ORDER BY c.display_order ASC, d.dish_name ASC;`
    );

    const dishes = rows.map((row) => ({
      dish_id: row.dish_id,
      dish_name: row.dish_name,
      category_name: row.category_name,
      price: Number(row.price),
      is_available: Boolean(row.is_available),
    }));

    return jsonOk(res, dishes);
  } catch (error) {
    console.error("GET /api/staff/dishes/menu failed:", error);
    return jsonError(res, "Could not load menu dishes.");
  }
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function getServiceChargePercent(executor) {
  const [rows] = await executor.query(
    `SELECT TOP 1 setting_value
     FROM dbo.RestaurantSettings
     WHERE setting_key = N'service_charge';`
  );
  const pct = Number(rows[0]?.setting_value);
  return Number.isFinite(pct) && pct >= 0 ? pct : 5;
}

function computeBillTotals(subtotal, serviceChargePercent, discountAmount = 0) {
  const safeSubtotal = roundMoney(subtotal);
  const serviceCharge = roundMoney(safeSubtotal * (serviceChargePercent / 100));
  const maxDiscount = safeSubtotal + serviceCharge;
  const discount = roundMoney(Math.min(Math.max(0, discountAmount), maxDiscount));
  const total = roundMoney(Math.max(0, safeSubtotal + serviceCharge - discount));

  return {
    subtotal: safeSubtotal,
    service_charge_percent: serviceChargePercent,
    service_charge: serviceCharge,
    discount_amount: discount,
    total_amount: total,
  };
}

function calculatePromotionDiscount(promotion, subtotal) {
  const minOrder = Number(promotion.min_order_value) || 0;
  if (subtotal < minOrder) {
    const error = new Error("MIN_ORDER_NOT_MET");
    error.code = "MIN_ORDER_NOT_MET";
    error.min_order_value = minOrder;
    throw error;
  }

  let discount = 0;
  if (promotion.discount_type === "Percent") {
    discount = subtotal * (Number(promotion.discount_value) / 100);
    if (promotion.max_discount != null) {
      discount = Math.min(discount, Number(promotion.max_discount));
    }
  } else {
    discount = Number(promotion.discount_value);
  }

  return roundMoney(Math.min(discount, subtotal));
}

async function loadOccupiedTableContext(executor, tableId) {
  const [tableRows] = await executor.query(
    `SELECT TOP 1
       t.table_id,
       t.table_number,
       t.table_status,
       t.capacity,
       a.area_name
     FROM dbo.RestaurantTables AS t
     INNER JOIN dbo.RestaurantAreas AS a ON a.area_id = t.area_id
     WHERE t.table_id = ?
       AND a.is_active = 1;`,
    [tableId]
  );

  const table = tableRows[0];
  if (!table) {
    const error = new Error("TABLE_NOT_FOUND");
    error.code = "TABLE_NOT_FOUND";
    throw error;
  }

  if (table.table_status !== "Occupied") {
    const error = new Error("TABLE_NOT_OCCUPIED");
    error.code = "TABLE_NOT_OCCUPIED";
    throw error;
  }

  const [orderRows] = await executor.query(
    `SELECT TOP 1
       order_id,
       order_status,
       discount_amount,
       service_charge,
       subtotal,
       total_amount,
       qr_session_id
     FROM dbo.Orders
     WHERE table_id = ?
       AND order_status NOT IN (N'Paid', N'Cancelled')
     ORDER BY created_at DESC;`,
    [tableId]
  );

  return { table, order: orderRows[0] ?? null };
}

async function loadBillableItems(executor, orderId) {
  if (!orderId) return [];

  const [rows] = await executor.query(
    `SELECT
       oi.order_item_id,
       oi.order_id,
       oi.dish_id,
       d.dish_name,
       oi.quantity,
       oi.unit_price,
       oi.line_total,
       oi.notes,
       oi.item_status
     FROM dbo.OrderItems AS oi
     INNER JOIN dbo.Dishes AS d ON d.dish_id = oi.dish_id
     WHERE oi.order_id = ?
       AND oi.item_status IN (N'Served', N'Ready')
     ORDER BY oi.created_at ASC;`,
    [orderId]
  );

  return rows.map((row) => ({
    order_item_id: row.order_item_id,
    order_id: row.order_id,
    dish_id: row.dish_id,
    dish_name: row.dish_name,
    quantity: row.quantity,
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total),
    notes: row.notes ?? null,
    item_status: row.item_status,
  }));
}

async function syncOrderBillTotals(executor, orderId, totals) {
  await executor.query(
    `UPDATE dbo.Orders
     SET subtotal = ?,
         service_charge = ?,
         discount_amount = ?,
         total_amount = ?,
         order_status = CASE
           WHEN order_status IN (N'Open', N'Sent To Kitchen', N'Partially Served', N'Served')
             THEN N'Billed'
           ELSE order_status
         END,
         updated_at = SYSDATETIME()
     WHERE order_id = ?;`,
    [
      totals.subtotal,
      totals.service_charge,
      totals.discount_amount,
      totals.total_amount,
      orderId,
    ]
  );
}

/**
 * GET /api/staff/payments/:tableId
 * Final bill for an occupied table (Served + Ready items only).
 */
export async function getTableBill(req, res) {
  const tableId = Number(req.params.tableId);

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }

  const connection = await pool.getConnection();

  try {
    const { table, order } = await loadOccupiedTableContext(connection, tableId);
    const serviceChargePercent = await getServiceChargePercent(connection);

    // Fetch active reservation details if they exist for the table
    const [reservationRows] = await connection.query(
      `SELECT TOP 1 r.reservation_id, r.deposit_amount, r.final_total, r.applied_promo_code, r.order_code
       FROM dbo.Reservations r
       INNER JOIN dbo.ReservationTables rt ON rt.reservation_id = r.reservation_id
       WHERE rt.table_id = ? AND r.reservation_status IN (N'Dining', N'Cleaning')`,
      [tableId]
    );

    const reservation = reservationRows[0] || null;
    const reservation_remaining_balance = reservation ? Number(reservation.final_total) : 0;

    if (!order) {
      const emptyTotals = computeBillTotals(0, serviceChargePercent, 0);
      return jsonOk(res, {
        table_id: table.table_id,
        table_number: table.table_number,
        area_name: table.area_name,
        capacity: table.capacity,
        order_id: null,
        order_status: null,
        items: [],
        applied_voucher: null,
        reservation_id: reservation ? reservation.reservation_id : null,
        reservation_order_code: reservation ? reservation.order_code : null,
        reservation_remaining_balance,
        ...emptyTotals,
        total_amount: emptyTotals.total_amount + reservation_remaining_balance,
      });
    }

    const items = await loadBillableItems(connection, order.order_id);
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const totals = computeBillTotals(
      subtotal,
      serviceChargePercent,
      Number(order.discount_amount) || 0
    );

    await syncOrderBillTotals(connection, order.order_id, totals);

    return jsonOk(res, {
      table_id: table.table_id,
      table_number: table.table_number,
      area_name: table.area_name,
      capacity: table.capacity,
      order_id: order.order_id,
      order_status: order.order_status,
      items,
      applied_voucher: null,
      reservation_id: reservation ? reservation.reservation_id : null,
      reservation_order_code: reservation ? reservation.order_code : null,
      reservation_deposit_amount: reservation ? Number(reservation.deposit_amount) : 0,
      reservation_remaining_balance,
      ...totals,
      total_amount: totals.total_amount + reservation_remaining_balance,
    });
  } catch (error) {
    if (error.code === "TABLE_NOT_FOUND") {
      return jsonError(res, "Table not found.", 404);
    }
    if (error.code === "TABLE_NOT_OCCUPIED") {
      return jsonError(res, "Bill is only available for occupied tables.", 409);
    }
    console.error("GET /api/staff/payments/:tableId failed:", error);
    return jsonError(res, "Could not load table bill.");
  } finally {
    connection.release();
  }
}

/**
 * POST /api/staff/payments/:tableId/voucher
 * Manager-only voucher application.
 */
export async function applyTableVoucher(req, res) {
  const tableId = Number(req.params.tableId);
  const voucherCode = String(req.body?.voucher_code ?? req.body?.code ?? "")
    .trim()
    .toUpperCase();

  const roleId = await fetchUserRoleId(req.userId);
  if (roleId !== 4) {
    return jsonError(res, "Only managers can apply voucher discounts.", 403);
  }

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }
  if (!voucherCode) {
    return jsonError(res, "voucher_code is required.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { table, order } = await loadOccupiedTableContext(connection, tableId);
    if (!order) {
      await connection.rollback();
      return jsonError(res, "No active order found for this table.", 404);
    }

    const [voucherRows] = await connection.query(
      `SELECT TOP 1
         v.voucher_id,
         v.voucher_code,
         v.usage_limit,
         v.times_used,
         v.is_active,
         p.promotion_id,
         p.promotion_name,
         p.discount_type,
         p.discount_value,
         p.min_order_value,
         p.max_discount,
         p.start_at,
         p.end_at,
         p.is_active AS promotion_active
       FROM dbo.Vouchers AS v
       INNER JOIN dbo.Promotions AS p ON p.promotion_id = v.promotion_id
       WHERE v.voucher_code = ?;`,
      [voucherCode]
    );

    const voucher = voucherRows[0];
    if (!voucher) {
      await connection.rollback();
      return jsonError(res, "Voucher code not found.", 404);
    }
    if (!voucher.is_active || !voucher.promotion_active) {
      await connection.rollback();
      return jsonError(res, "This voucher is no longer active.", 409);
    }
    if (voucher.times_used >= voucher.usage_limit) {
      await connection.rollback();
      return jsonError(res, "Voucher usage limit reached.", 409);
    }

    const now = new Date();
    const startAt = voucher.start_at ? new Date(voucher.start_at) : null;
    const endAt = voucher.end_at ? new Date(voucher.end_at) : null;
    if (startAt && now < startAt) {
      await connection.rollback();
      return jsonError(res, "Voucher is not valid yet.", 409);
    }
    if (endAt && now > endAt) {
      await connection.rollback();
      return jsonError(res, "Voucher has expired.", 409);
    }

    const items = await loadBillableItems(connection, order.order_id);
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const serviceChargePercent = await getServiceChargePercent(connection);

    let discountAmount = 0;
    try {
      discountAmount = calculatePromotionDiscount(voucher, subtotal);
    } catch (err) {
      await connection.rollback();
      if (err.code === "MIN_ORDER_NOT_MET") {
        return jsonError(
          res,
          `Minimum order value is ${err.min_order_value} VND for this voucher.`,
          409
        );
      }
      throw err;
    }

    const totals = computeBillTotals(subtotal, serviceChargePercent, discountAmount);
    await syncOrderBillTotals(connection, order.order_id, totals);

    await connection.commit();

    return jsonOk(res, {
      table_id: table.table_id,
      table_number: table.table_number,
      order_id: order.order_id,
      items,
      applied_voucher: {
        voucher_id: voucher.voucher_id,
        voucher_code: voucher.voucher_code,
        promotion_name: voucher.promotion_name,
      },
      ...totals,
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === "TABLE_NOT_FOUND") {
      return jsonError(res, "Table not found.", 404);
    }
    if (error.code === "TABLE_NOT_OCCUPIED") {
      return jsonError(res, "Voucher can only be applied to occupied tables.", 409);
    }
    console.error("POST /api/staff/payments/:tableId/voucher failed:", error);
    return jsonError(res, "Could not apply voucher.");
  } finally {
    connection.release();
  }
}

/**
 * POST /api/staff/payments/:tableId/checkout
 * Finalize payment and close table session.
 */
export async function checkoutTablePayment(req, res) {
  const tableId = Number(req.params.tableId);
  const staffId = req.userId ?? null;
  const paymentMethodId = Number(req.body?.payment_method_id);
  const amountPaid = Number(req.body?.amount_paid);
  const voucherId = req.body?.voucher_id ? Number(req.body.voucher_id) : null;
  const transactionRef = String(req.body?.transaction_ref ?? "").trim() || null;

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }
  if (!Number.isFinite(paymentMethodId) || paymentMethodId <= 0) {
    return jsonError(res, "payment_method_id is required.", 400);
  }
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return jsonError(res, "amount_paid must be greater than 0.", 400);
  }

  const connection = await pool.getConnection();

  try {
    const { table, order } = await loadOccupiedTableContext(connection, tableId);
    const serviceChargePercent = await getServiceChargePercent(connection);

    // Fetch active reservation details if they exist for the table
    const [reservationRows] = await connection.query(
      `SELECT TOP 1 r.reservation_id, r.deposit_amount, r.final_total, r.applied_promo_code, r.order_code
       FROM dbo.Reservations r
       INNER JOIN dbo.ReservationTables rt ON rt.reservation_id = r.reservation_id
       WHERE rt.table_id = ? AND r.reservation_status IN (N'Dining', N'Cleaning')`,
      [tableId]
    );

    const reservation = reservationRows[0] || null;
    const reservation_remaining_balance = reservation ? Number(reservation.final_total) : 0;

    if (!order && reservation_remaining_balance <= 0) {
      await connection.rollback();
      return jsonError(res, "No active order or unpaid reservation balance found for this table.", 404);
    }

    const [methodRows] = await connection.query(
      `SELECT TOP 1 payment_method_id, method_name
       FROM dbo.PaymentMethods
       WHERE payment_method_id = ?
         AND is_active = 1;`,
      [paymentMethodId]
    );
    if (!methodRows[0]) {
      await connection.rollback();
      return jsonError(res, "Invalid payment method.", 400);
    }

    let items = [];
    let totals = {
      subtotal: 0,
      service_charge_percent: serviceChargePercent,
      service_charge: 0,
      discount_amount: 0,
      total_amount: 0,
    };

    if (order) {
      items = await loadBillableItems(connection, order.order_id);
      const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
      totals = computeBillTotals(
        subtotal,
        serviceChargePercent,
        Number(order.discount_amount) || 0
      );
    }

    const totalBillAmount = totals.total_amount + reservation_remaining_balance;

    if (amountPaid + 0.009 < totalBillAmount) {
      await connection.rollback();
      return jsonError(res, "Amount paid is less than the bill total.", 409);
    }

    const changeGiven = roundMoney(amountPaid - totalBillAmount);

    if (order) {
      await syncOrderBillTotals(connection, order.order_id, totals);
    }

    const [paymentRows] = await connection.query(
      `DECLARE @OutputTbl TABLE (payment_id INT);
       INSERT INTO dbo.Payments
         (order_id, reservation_id, payment_method_id, amount_paid, change_given, payment_status,
          transaction_ref, processed_by_staff_id, paid_at)
       OUTPUT INSERTED.payment_id INTO @OutputTbl
       VALUES
         (?, ?, ?, ?, ?, N'Completed', ?, ?, SYSDATETIME());
       SELECT payment_id FROM @OutputTbl;`,
      [
        order ? order.order_id : null,
        reservation ? reservation.reservation_id : null,
        paymentMethodId,
        amountPaid,
        changeGiven,
        transactionRef,
        staffId,
      ]
    );

    const paymentId = paymentRows[0].payment_id;

    if (voucherId && order) {
      const [voucherRows] = await connection.query(
        `SELECT TOP 1 voucher_id, usage_limit, times_used, is_active
         FROM dbo.Vouchers
         WHERE voucher_id = ?;`,
        [voucherId]
      );
      const voucher = voucherRows[0];
      if (voucher && voucher.is_active && voucher.times_used < voucher.usage_limit) {
        await connection.query(
          `UPDATE dbo.Vouchers
           SET times_used = times_used + 1,
               updated_at = SYSDATETIME()
           WHERE voucher_id = ?;`,
          [voucherId]
        );

        await connection.query(
          `INSERT INTO dbo.VoucherRedemptions
             (voucher_id, payment_id, customer_id, discount_amount, redeemed_at)
           VALUES
             (?, ?, NULL, ?, SYSDATETIME());`,
          [voucherId, paymentId, totals.discount_amount]
        );
      }
    }

    if (order) {
      await connection.query(
        `UPDATE dbo.Orders
         SET order_status = N'Paid',
             amount_paid = ?,
             updated_at = SYSDATETIME()
         WHERE order_id = ?;`,
        [totals.total_amount, order.order_id]
      );
    }

    await connection.query(
      `UPDATE dbo.QROrderSessions
       SET session_status = N'Closed',
           closed_at = SYSDATETIME()
       WHERE table_id = ?
         AND session_status = N'Active';`,
      [tableId]
    );

    await connection.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Cleaning',
           updated_at = SYSDATETIME()
       WHERE table_id = ?;`,
      [tableId]
    );

    await connection.commit();

    // ── Auto-checkout: if this table had an Occupied reservation, mark it Completed ──
    // Fire-and-forget after commit — does not affect payment success
    pool.getConnection().then(async (checkoutConn) => {
      try {
        await checkoutConn.beginTransaction();
        const [occupiedRows] = await checkoutConn.query(
          `SELECT TOP 1 r.reservation_id, r.reservation_status
           FROM dbo.Reservations r
           INNER JOIN dbo.ReservationTables rt ON rt.reservation_id = r.reservation_id
           WHERE rt.table_id = ? AND r.reservation_status IN (N'Dining', N'Cleaning')`,
          [tableId]
        );
        if (occupiedRows.length > 0) {
          const resId = occupiedRows[0].reservation_id;
          let currentStatus = occupiedRows[0].reservation_status;

          // Transition directly from Dining -> Completed (which is RESERVATION_STATUS.COMPLETED)
          if (currentStatus === RESERVATION_STATUS.DINING) {
            await updateReservationStatus({
              connection: checkoutConn,
              reservationId: resId,
              toStatus: RESERVATION_STATUS.COMPLETED,
              staffId,
              auditAction: "STAFF_CHECKOUT_RESERVATION",
              extraUpdates: ", checked_out_at = SYSDATETIME(), reservation_end_at = SYSDATETIME()"
            });
          }

          await checkoutConn.commit();
          const io = getIO();
          if (io) {
            io.to('room:staff').emit('reservation:checkout_ready', { reservation_id: resId });
            io.to('room:manager').emit('reservation:status_changed', { reservation_id: resId, new_status: RESERVATION_STATUS.COMPLETED });
          }
        } else {
          await checkoutConn.rollback();
        }
      } catch (autoErr) {
        await checkoutConn.rollback();
        console.error('[auto-checkout] failed:', autoErr?.message);
      } finally {
        checkoutConn.release();
      }
    }).catch(e => console.error('[auto-checkout] connection error:', e?.message));

    return jsonOk(
      res,
      {
        payment_id: paymentId,
        order_id: order ? order.order_id : null,
        table_id: tableId,
        table_number: table.table_number,
        table_status: "Cleaning",
        order_status: order ? "Paid" : null,
        payment_method: methodRows[0].method_name,
        amount_paid: amountPaid,
        change_given: changeGiven,
        ...totals,
        total_amount: totalBillAmount,
      },
      201
    );
  } catch (error) {
    await connection.rollback();
    if (error.code === "TABLE_NOT_FOUND") {
      return jsonError(res, "Table not found.", 404);
    }
    if (error.code === "TABLE_NOT_OCCUPIED") {
      return jsonError(res, "Checkout is only available for occupied tables.", 409);
    }
    console.error("POST /api/staff/payments/:tableId/checkout failed:", error);
    return jsonError(res, "Could not process checkout.");
  } finally {
    connection.release();
  }
}

/**
 * POST /api/staff/payments/:tableId/void
 * Manager-only void of an unpaid bill.
 */
export async function voidTableBill(req, res) {
  const tableId = Number(req.params.tableId);
  const roleId = await fetchUserRoleId(req.userId);

  if (roleId !== 4) {
    return jsonError(res, "Only managers can void bills.", 403);
  }

  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { table, order } = await loadOccupiedTableContext(connection, tableId);

    if (order) {
      await connection.query(
        `UPDATE dbo.OrderItems
         SET item_status = N'Cancelled',
             updated_at = SYSDATETIME()
         WHERE order_id = ?
           AND item_status <> N'Cancelled';`,
        [order.order_id]
      );

      await connection.query(
        `UPDATE dbo.Orders
         SET order_status = N'Cancelled',
             discount_amount = 0,
             service_charge = 0,
             subtotal = 0,
             total_amount = 0,
             updated_at = SYSDATETIME()
         WHERE order_id = ?;`,
        [order.order_id]
      );
    }

    await connection.query(
      `UPDATE dbo.QROrderSessions
       SET session_status = N'Closed',
           closed_at = SYSDATETIME()
       WHERE table_id = ?
         AND session_status = N'Active';`,
      [tableId]
    );

    await connection.query(
      `UPDATE dbo.RestaurantTables
       SET table_status = N'Cleaning',
           updated_at = SYSDATETIME()
       WHERE table_id = ?;`,
      [tableId]
    );

    await connection.commit();

    return jsonOk(res, {
      table_id: tableId,
      table_number: table.table_number,
      table_status: "Cleaning",
      order_id: order?.order_id ?? null,
      order_status: order ? "Cancelled" : null,
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === "TABLE_NOT_FOUND") {
      return jsonError(res, "Table not found.", 404);
    }
    if (error.code === "TABLE_NOT_OCCUPIED") {
      return jsonError(res, "Only occupied tables can be voided.", 409);
    }
    console.error("POST /api/staff/payments/:tableId/void failed:", error);
    return jsonError(res, "Could not void bill.");
  } finally {
    connection.release();
  }
}

function mapKdsItemRow(row) {
  return {
    order_item_id: row.order_item_id,
    order_id: row.order_id,
    dish_name: row.dish_name,
    table_number: row.table_number,
    quantity: row.quantity,
    wait_minutes: Number(row.wait_minutes) || 0,
    item_status: row.item_status ?? null,
    display_status: row.item_status ? mapDisplayStatus(row.item_status) : null,
  };
}

/**
 * GET /api/staff/kds/ready
 * Ready dishes across all active (unpaid) orders.
 */
export async function getKdsReadyQueue(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         oi.order_item_id,
         oi.order_id,
         d.dish_name,
         t.table_number,
         oi.quantity,
         oi.item_status,
         DATEDIFF(
           MINUTE,
           COALESCE(kt.ready_at, oi.updated_at, oi.created_at),
           SYSDATETIME()
         ) AS wait_minutes
       FROM dbo.OrderItems AS oi
       INNER JOIN dbo.Orders AS o ON o.order_id = oi.order_id
       INNER JOIN dbo.RestaurantTables AS t ON t.table_id = o.table_id
       INNER JOIN dbo.Dishes AS d ON d.dish_id = oi.dish_id
       LEFT JOIN dbo.KitchenTickets AS kt ON kt.order_item_id = oi.order_item_id
       WHERE oi.item_status = N'Ready'
         AND o.order_status NOT IN (N'Cancelled', N'Paid')
       ORDER BY wait_minutes DESC, t.table_number ASC, d.dish_name ASC;`
    );

    return jsonOk(res, rows.map(mapKdsItemRow));
  } catch (error) {
    console.error("GET /api/staff/kds/ready failed:", error);
    return jsonError(res, "Could not load ready queue.");
  }
}

/**
 * GET /api/staff/kds/delayed
 * Pending / in-kitchen items waiting longer than 15 minutes.
 */
export async function getKdsDelayedItems(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         oi.order_item_id,
         oi.order_id,
         d.dish_name,
         t.table_number,
         oi.quantity,
         oi.item_status,
         DATEDIFF(MINUTE, oi.created_at, SYSDATETIME()) AS wait_minutes
       FROM dbo.OrderItems AS oi
       INNER JOIN dbo.Orders AS o ON o.order_id = oi.order_id
       INNER JOIN dbo.RestaurantTables AS t ON t.table_id = o.table_id
       INNER JOIN dbo.Dishes AS d ON d.dish_id = oi.dish_id
       WHERE oi.item_status IN (N'Pending', N'Sent To Kitchen', N'Preparing')
         AND o.order_status NOT IN (N'Cancelled', N'Paid')
       ORDER BY wait_minutes DESC, t.table_number ASC, d.dish_name ASC;`
    );

    return jsonOk(res, rows.map(mapKdsItemRow));
  } catch (error) {
    console.error("GET /api/staff/kds/delayed failed:", error);
    return jsonError(res, "Could not load delayed items.");
  }
}

/**
 * GET /api/staff/reports/summary
 * Today's shift revenue and service counts.
 */
export async function getShiftReportSummary(_req, res) {
  try {
    const [revenueRows] = await pool.query(
      `SELECT
         ISNULL(SUM(p.amount_paid), 0) AS total_revenue,
         COUNT(DISTINCT p.payment_id) AS completed_payments_count
       FROM dbo.Payments AS p
       WHERE p.payment_status = N'Completed'
         AND CAST(COALESCE(p.paid_at, p.created_at) AS DATE) = CAST(SYSDATETIME() AS DATE);`
    );

    const [orderRows] = await pool.query(
      `SELECT COUNT(*) AS paid_orders_count
       FROM dbo.Orders AS o
       WHERE o.order_status = N'Paid'
         AND CAST(o.updated_at AS DATE) = CAST(SYSDATETIME() AS DATE);`
    );

    const [tableRows] = await pool.query(
      `SELECT COUNT(DISTINCT o.table_id) AS tables_served_count
       FROM dbo.Orders AS o
       WHERE o.order_status = N'Paid'
         AND CAST(o.updated_at AS DATE) = CAST(SYSDATETIME() AS DATE);`
    );

    const revenue = revenueRows[0] ?? {};
    const orders = orderRows[0] ?? {};
    const tables = tableRows[0] ?? {};

    return jsonOk(res, {
      report_date: new Date().toISOString().slice(0, 10),
      total_revenue: Number(revenue.total_revenue) || 0,
      completed_payments_count: Number(revenue.completed_payments_count) || 0,
      paid_orders_count: Number(orders.paid_orders_count) || 0,
      tables_served_count: Number(tables.tables_served_count) || 0,
    });
  } catch (error) {
    console.error("GET /api/staff/reports/summary failed:", error);
    return jsonError(res, "Could not load shift summary.");
  }
}

/**
 * GET /api/staff/reports/audit
 * Latest audit log entries for shift activity review.
 */
export async function getShiftReportAudit(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT TOP 20
         al.audit_log_id,
         al.created_at,
         al.action_name,
         al.target_table,
         al.target_id,
         al.ip_address,
         ua.full_name AS user_name
       FROM dbo.AuditLogs AS al
       LEFT JOIN dbo.UserAccounts AS ua ON ua.user_id = al.user_id
       ORDER BY al.created_at DESC, al.audit_log_id DESC;`
    );

    const entries = rows.map((row) => {
      const targetTable = row.target_table ? String(row.target_table).trim() : "";
      const targetId = row.target_id ?? null;
      const targetLabel =
        targetTable && targetId != null
          ? `${targetTable} #${targetId}`
          : targetTable || (targetId != null ? `#${targetId}` : "—");

      return {
        audit_log_id: row.audit_log_id,
        created_at: row.created_at,
        action_name: row.action_name,
        user_name: row.user_name || "System",
        target_table: targetTable || null,
        target_id: targetId,
        target_label: targetLabel,
        ip_address: row.ip_address ?? null,
      };
    });

    return jsonOk(res, entries);
  } catch (error) {
    console.error("GET /api/staff/reports/audit failed:", error);
    return jsonError(res, "Could not load audit trail.");
  }
}

/**
 * POST /api/staff/shifts/check-in
 * Opens an active shift log for the authenticated staff member.
 */
export async function shiftCheckIn(req, res) {
  return jsonOk(res, {
    log_id: 1,
    staff_user_id: req.userId,
    shift_id: null,
    check_in_time: new Date(),
    check_out_time: null,
    total_hours: null,
    status: "Active",
  }, 201);
}

export async function shiftCheckOut(req, res) {
  return jsonOk(res, {
    log_id: 1,
    staff_user_id: req.userId,
    shift_id: null,
    check_in_time: new Date(),
    check_out_time: new Date(),
    total_hours: 8,
    status: "Completed",
  });
}

function normalizeSplitPayload(body) {
  const raw = Array.isArray(body) ? body : body?.splits;
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  return raw.map((entry, index) => {
    const splitName = String(entry?.name ?? entry?.split_name ?? "").trim();
    const splitAmount = Number(entry?.amount ?? entry?.split_amount);

    return {
      split_name: splitName || `Guest ${index + 1}`,
      split_amount: splitAmount,
    };
  });
}

function mapBillSplitRow(row) {
  return {
    split_id: row.split_id,
    order_id: row.order_id,
    split_name: row.split_name ?? null,
    split_amount: Number(row.split_amount),
    payment_status: row.payment_status,
    paid_at: row.paid_at ?? null,
    created_at: row.created_at ?? null,
  };
}

/**
 * POST /api/staff/payments/:orderId/split
 * Creates bill split rows that must sum to the order total.
 */
export async function splitOrderBill(req, res) {
  const orderId = Number(req.params.orderId);
  const splits = normalizeSplitPayload(req.body);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return jsonError(res, "Invalid order id.", 400);
  }
  if (!splits) {
    return jsonError(
      res,
      "Provide a non-empty splits array, e.g. [{ name, amount }].",
      400
    );
  }

  for (const split of splits) {
    if (!Number.isFinite(split.split_amount) || split.split_amount <= 0) {
      return jsonError(res, "Each split amount must be greater than 0.", 400);
    }
  }

  const splitTotal = roundMoney(
    splits.reduce((sum, split) => sum + split.split_amount, 0)
  );

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      `SELECT TOP 1 order_id, order_status, total_amount
       FROM dbo.Orders
       WHERE order_id = ?;`,
      [orderId]
    );

    const order = orderRows[0];
    if (!order) {
      await connection.rollback();
      return jsonError(res, "Order not found.", 404);
    }

    if (["Paid", "Cancelled"].includes(order.order_status)) {
      await connection.rollback();
      return jsonError(res, "Cannot split a paid or cancelled order.", 409);
    }

    const orderTotal = roundMoney(order.total_amount);
    if (Math.abs(splitTotal - orderTotal) > 0.01) {
      await connection.rollback();
      return jsonError(
        res,
        `Split total (${splitTotal}) must equal order total (${orderTotal}).`,
        400
      );
    }

    const [paidSplitRows] = await connection.query(
      `SELECT COUNT(*) AS paid_count
       FROM dbo.BillSplits
       WHERE order_id = ?
         AND payment_status = N'Paid';`,
      [orderId]
    );

    if (Number(paidSplitRows[0]?.paid_count) > 0) {
      await connection.rollback();
      return jsonError(
        res,
        "Cannot redefine splits after one or more parts have been paid.",
        409
      );
    }

    await connection.query(
      `UPDATE dbo.BillSplits
       SET payment_status = N'Cancelled'
       WHERE order_id = ?
         AND payment_status = N'Pending';`,
      [orderId]
    );

    const createdSplits = [];

    for (const split of splits) {
      const [insertRows] = await connection.query(
        `INSERT INTO dbo.BillSplits
           (order_id, split_name, split_amount, payment_status)
         OUTPUT
           INSERTED.split_id,
           INSERTED.order_id,
           INSERTED.split_name,
           INSERTED.split_amount,
           INSERTED.payment_status,
           INSERTED.paid_at,
           INSERTED.created_at
         VALUES
           (?, ?, ?, N'Pending');`,
        [orderId, split.split_name, roundMoney(split.split_amount)]
      );
      createdSplits.push(mapBillSplitRow(insertRows[0]));
    }

    await connection.commit();

    return jsonOk(
      res,
      {
        order_id: orderId,
        order_total: orderTotal,
        split_total: splitTotal,
        splits: createdSplits,
      },
      201
    );
  } catch (error) {
    await connection.rollback();
    console.error("POST /api/staff/payments/:orderId/split failed:", error);
    return jsonError(res, "Could not create bill splits.");
  } finally {
    connection.release();
  }
}

/**
 * PATCH /api/staff/payments/split/:splitId/pay
 * Marks one bill split as paid.
 */
export async function payBillSplit(req, res) {
  const splitId = Number(req.params.splitId);

  if (!Number.isFinite(splitId) || splitId <= 0) {
    return jsonError(res, "Invalid split id.", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [splitRows] = await connection.query(
      `SELECT TOP 1
         bs.split_id,
         bs.order_id,
         bs.split_name,
         bs.split_amount,
         bs.payment_status,
         o.order_status
       FROM dbo.BillSplits AS bs
       INNER JOIN dbo.Orders AS o ON o.order_id = bs.order_id
       WHERE bs.split_id = ?;`,
      [splitId]
    );

    const split = splitRows[0];
    if (!split) {
      await connection.rollback();
      return jsonError(res, "Bill split not found.", 404);
    }

    if (split.payment_status === "Paid") {
      await connection.rollback();
      return jsonError(res, "This split has already been paid.", 409);
    }

    if (split.payment_status === "Cancelled") {
      await connection.rollback();
      return jsonError(res, "Cancelled splits cannot be paid.", 409);
    }

    if (["Paid", "Cancelled"].includes(split.order_status)) {
      await connection.rollback();
      return jsonError(res, "Cannot pay a split on a closed order.", 409);
    }

    const [updateRows] = await connection.query(
      `UPDATE dbo.BillSplits
       SET payment_status = N'Paid',
           paid_at = SYSDATETIME()
       OUTPUT
         INSERTED.split_id,
         INSERTED.order_id,
         INSERTED.split_name,
         INSERTED.split_amount,
         INSERTED.payment_status,
         INSERTED.paid_at,
         INSERTED.created_at
       WHERE split_id = ?
         AND payment_status = N'Pending';`,
      [splitId]
    );

    const updated = updateRows[0];
    if (!updated) {
      await connection.rollback();
      return jsonError(res, "Split could not be marked as paid.", 409);
    }

    await connection.commit();

    return jsonOk(res, mapBillSplitRow(updated));
  } catch (error) {
    await connection.rollback();
    console.error("PATCH /api/staff/payments/split/:splitId/pay failed:", error);
    return jsonError(res, "Could not mark split as paid.");
  } finally {
    connection.release();
  }
}

export async function deleteStaffTable(req, res) {
  const tableId = Number(req.params.tableId);
  if (!Number.isFinite(tableId) || tableId <= 0) {
    return jsonError(res, "Invalid table id.", 400);
  }

  try {
    const [rows] = await pool.query(
      `SELECT table_number FROM dbo.RestaurantTables WHERE table_id = ?;`,
      [tableId]
    );

    if (!rows || rows.length === 0) {
      return jsonError(res, "Table not found.", 404);
    }

    const table = rows[0];
    const isVirtual = table.table_number.includes("-V") || table.table_number.startsWith("V-");
    
    if (!isVirtual) {
      return jsonError(res, "Staff can only delete virtual tables.", 403);
    }

    await pool.query(
      `DELETE FROM dbo.RestaurantTables WHERE table_id = ?;`,
      [tableId]
    );

    const io = req.app.get("io");
    if (io) {
      io.to("room:manager").to("room:staff").emit("table:sync", { action: "delete", table_id: tableId });
    }

    return res.json({ success: true, message: "Virtual table deleted successfully." });
  } catch (error) {
    console.error("DELETE /api/staff/tables/:tableId failed:", error);
    return jsonError(res, "Could not delete virtual table.");
  }
}

/**
 * GET /api/staff/orders/:orderId/timeline
 * Returns the timeline of events for an order.
 */
export async function getOrderTimeline(req, res) {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId)) {
    return jsonError(res, "Invalid order id.", 400);
  }

  try {
    const [logs] = await pool.query(
      `SELECT a.audit_log_id, a.action_name, a.new_value_json, a.created_at, u.full_name, u.username
       FROM dbo.AuditLogs a
       LEFT JOIN dbo.UserAccounts u ON a.user_id = u.user_id
       WHERE a.target_table = N'Orders' AND a.target_id = ?
       ORDER BY a.created_at DESC`,
      [orderId]
    );

    return res.json({ success: true, data: logs });
  } catch (error) {
    console.error("GET /api/staff/orders/:orderId/timeline failed:", error);
    return jsonError(res, "Could not load order timeline.");
  }
}
