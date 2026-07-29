import pool from "../db.js";
import { RESERVATION_STATUS } from '../constants/reservationStatus.js';
import { updateReservationStatus } from "./reservationStateService.js";
import { getIO } from "../socket.js";

async function releaseUnseatedReservationTables(reservationId) {
  const [tableRows] = await pool.query(
    `SELECT rt.table_id
     FROM dbo.ReservationTables rt
     INNER JOIN dbo.RestaurantTables t ON t.table_id = rt.table_id
     WHERE rt.reservation_id = ?
       AND t.table_status = N'Reserved'
       AND NOT EXISTS (
         SELECT 1
         FROM dbo.TableOccupancySessions tos
         WHERE tos.table_id = rt.table_id
           AND tos.released_at IS NULL
       );`,
    [reservationId]
  );

  if (!tableRows.length) return [];

  const tableIds = tableRows.map((row) => Number(row.table_id)).filter(Number.isFinite);
  if (!tableIds.length) return [];

  const placeholders = tableIds.map(() => "?").join(", ");
  await pool.query(
    `UPDATE t
     SET t.table_status = N'Available',
         t.updated_at = SYSDATETIME()
     FROM dbo.RestaurantTables t
     WHERE t.table_id IN (${placeholders})
       AND t.table_status = N'Reserved'
       AND NOT EXISTS (
         SELECT 1
         FROM dbo.TableOccupancySessions tos
         WHERE tos.table_id = t.table_id
           AND tos.released_at IS NULL
       );`,
    tableIds
  );

  const io = getIO();
  if (io) {
    for (const tableId of tableIds) {
      io.to("room:manager").to("room:staff").emit("table:status_changed", {
        table_id: tableId,
        table_status: "Available",
        reason: "no_show_release",
        reservation_id: reservationId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return tableIds;
}

export const sweepNoShows = async () => {
  try {
    // Look for reservations that are Await Check-in, Pending Request, Awaiting Deposit, or Confirmed
    const [rows] = await pool.query(`
      SELECT
        reservation_id,
        reservation_start_at,
        reservation_status,
        COALESCE(NULLIF(no_show_grace_minutes, 0), 20) AS no_show_grace_minutes
      FROM dbo.Reservations
      WHERE reservation_status IN (N'Await Check-in', N'Pending Request', N'Awaiting Deposit', N'Confirmed')
    `);

    if (!rows || rows.length === 0) return;

    const nowMs = Date.now();

    for (const r of rows) {
      if (!r.reservation_start_at) continue;
      const startMs = new Date(r.reservation_start_at).getTime();
      if (Number.isNaN(startMs)) continue;
      const graceMinutes = Number(r.no_show_grace_minutes) || 20;
      const graceThresholdMs = graceMinutes * 60 * 1000;

      // Only sweep if current time is beyond reservation_start_at + no-show grace.
      // This is not reservation_end_at/ERT. ERT must never kick out a seated guest.
      if (nowMs - startMs > graceThresholdMs) {
        try {
          let toStatus = RESERVATION_STATUS.NO_SHOW;
          if (r.reservation_status === 'Pending Request' || r.reservation_status === 'Awaiting Deposit') {
            toStatus = RESERVATION_STATUS.CANCELLED;
            await updateReservationStatus({
              connection: pool,
              reservationId: r.reservation_id,
              toStatus,
              staffId: null,
              auditAction: "SYSTEM_AUTO_CANCEL_EXPIRED"
            });
            console.log(`[Sweeper] Reservation ${r.reservation_id} marked as Cancelled after ${graceMinutes}m timeout.`);
          } else {
            await updateReservationStatus({
              connection: pool,
              reservationId: r.reservation_id,
              toStatus,
              staffId: null,
              auditAction: "SYSTEM_AUTO_NO_SHOW"
            });
            console.log(`[Sweeper] Reservation ${r.reservation_id} marked as No Show after ${graceMinutes}m timeout.`);
          }

          const releasedTableIds = await releaseUnseatedReservationTables(r.reservation_id);
          const io = getIO();
          if (io) {
            io.to("room:manager").to("room:staff").emit("reservation:status_changed", {
              reservation_id: r.reservation_id,
              reservation_status: toStatus,
              status: toStatus,
              released_table_ids: releasedTableIds,
              reason: "no_show_sweeper",
              timestamp: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error(`[Sweeper] Failed to mark ${r.reservation_id}:`, e.message);
        }
      }
    }
  } catch (error) {
    console.error("[Sweeper] Failed to sweep No Shows:", error.message);
  }
};
