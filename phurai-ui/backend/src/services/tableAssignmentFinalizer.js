import sql from "mssql";
import { getRawPool } from "../db.js";
import { getIO } from "../socket.js";
import {
  CONFIRMED_ASSIGNMENT_WINDOW_HOURS,
  FINALIZATION_ALERT_THRESHOLD_MINUTES,
  parsePreferredTableTags,
} from "../utils/tableAssignmentPolicy.js";

const ACTIVE_RESERVATION_STATUSES = [
  "Awaiting Deposit",
  "Await Check-in",
  "Reserved",
  "Confirmed",
  "Paid",
];

function activeStatusSql() {
  return ACTIVE_RESERVATION_STATUSES.map((status) => `N'${status}'`).join(", ");
}

export async function sweepTableAssignmentFinalization() {
  const pool = await getRawPool();

  const pendingResult = await pool.request()
    .input("windowHours", sql.Int, CONFIRMED_ASSIGNMENT_WINDOW_HOURS)
    .query(`
      SELECT
        r.reservation_id,
        r.customer_id,
        r.reservation_start_at,
        r.reservation_end_at,
        r.guest_count,
        r.special_request,
        r.preferred_area_id,
        a.area_name
      FROM dbo.Reservations r
      LEFT JOIN dbo.RestaurantAreas a ON a.area_id = r.preferred_area_id
      WHERE r.reservation_status IN (${activeStatusSql()})
        AND r.reservation_start_at BETWEEN SYSDATETIME() AND DATEADD(hour, @windowHours, SYSDATETIME())
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.ReservationTables rt
          WHERE rt.reservation_id = r.reservation_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.AuditLogs al
          WHERE al.target_table = N'Reservations'
            AND al.target_id = r.reservation_id
            AND al.action_name = N'TABLE_ASSIGNMENT_FINALIZATION_NEEDED'
            AND al.created_at >= DATEADD(minute, -${FINALIZATION_ALERT_THRESHOLD_MINUTES}, SYSDATETIME())
        )
      ORDER BY r.reservation_start_at ASC
    `);

  const pending = pendingResult.recordset || [];
  if (!pending.length) return { processed: 0 };

  const staffResult = await pool.request().query(`
    SELECT user_id
    FROM dbo.UserAccounts
    WHERE role_id IN (2, 3, 4)
      AND is_active = 1
  `);
  const staffIds = staffResult.recordset.map((row) => row.user_id);

  let processed = 0;

  for (const reservation of pending) {
    const preferred = parsePreferredTableTags(reservation.special_request);
    const suggestionRequest = pool.request()
      .input("guestCount", sql.Int, Number(reservation.guest_count) || 1)
      .input("slotStart", sql.DateTime2, reservation.reservation_start_at)
      .input("slotEnd", sql.DateTime2, reservation.reservation_end_at);

    let areaPredicate = "";
    if (reservation.preferred_area_id) {
      suggestionRequest.input("areaId", sql.Int, reservation.preferred_area_id);
      areaPredicate = "AND t.area_id = @areaId";
    }
    if (preferred.preferred_table_id) {
      suggestionRequest.input("preferredTableId", sql.Int, preferred.preferred_table_id);
    }

    const suggestionResult = await suggestionRequest.query(`
      SELECT TOP 1
        t.table_id,
        t.table_number,
        t.capacity,
        a.area_name
      FROM dbo.RestaurantTables t
      INNER JOIN dbo.RestaurantAreas a ON a.area_id = t.area_id
      WHERE t.table_status NOT IN (N'Occupied', N'Cleaning', N'Inactive')
        AND t.capacity >= @guestCount
        ${areaPredicate}
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.ReservationTables rt
          INNER JOIN dbo.Reservations r2 ON r2.reservation_id = rt.reservation_id
          WHERE rt.table_id = t.table_id
            AND r2.reservation_status IN (${activeStatusSql()})
            AND r2.reservation_start_at < @slotEnd
            AND r2.reservation_end_at > @slotStart
        )
      ORDER BY
        CASE WHEN ${preferred.preferred_table_id ? "t.table_id = @preferredTableId" : "1 = 0"} THEN 0 ELSE 1 END,
        t.capacity ASC,
        t.table_number ASC
    `);

    const suggestion = suggestionResult.recordset[0] || null;
    const payload = {
      reservation_id: reservation.reservation_id,
      preferred_table_id: preferred.preferred_table_id,
      preferred_table_number: preferred.preferred_table_number,
      preferred_area_id: reservation.preferred_area_id,
      preferred_area_name: reservation.area_name,
      suggested_table_id: suggestion?.table_id || null,
      suggested_table_number: suggestion?.table_number || null,
      alert_threshold_minutes: FINALIZATION_ALERT_THRESHOLD_MINUTES,
    };

    await pool.request()
      .input("targetId", sql.Int, reservation.reservation_id)
      .input("newValue", sql.NVarChar(sql.MAX), JSON.stringify(payload))
      .query(`
        INSERT INTO dbo.AuditLogs (action_name, target_table, target_id, new_value_json, created_at)
        VALUES (N'TABLE_ASSIGNMENT_FINALIZATION_NEEDED', N'Reservations', @targetId, @newValue, SYSDATETIME())
      `);

    for (const staffId of staffIds) {
      await pool.request()
        .input("userId", sql.Int, staffId)
        .input("title", sql.NVarChar(200), "Table assignment needs review")
        .input(
          "message",
          sql.NVarChar(2000),
          suggestion
            ? `Reservation #${reservation.reservation_id} needs final table confirmation. Suggested table: ${suggestion.table_number}.`
            : `Reservation #${reservation.reservation_id} needs final table confirmation. No suitable table is currently available.`
        )
        .query(`
          INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
          VALUES (@userId, N'Table Assignment', @title, @message, 0, SYSDATETIME())
        `);
    }

    try {
      const io = getIO();
      if (io) {
        io.to("room:staff").to("room:manager").emit("reservation:assignment_review_needed", payload);
      }
    } catch (socketErr) {
      console.warn("[tableAssignmentFinalizer] Socket emit failed:", socketErr.message);
    }

    processed += 1;
  }

  return { processed };
}
