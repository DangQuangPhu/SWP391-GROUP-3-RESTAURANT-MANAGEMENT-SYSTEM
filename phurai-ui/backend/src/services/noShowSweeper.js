import pool from "../db.js";
import { RESERVATION_STATUS } from "../../../frontend/src/shared/reservationStatus.js";
import { updateReservationStatus } from "./reservationStateService.js";

export const sweepNoShows = async () => {
  try {
    // Look for reservations that are Reserved, Confirmed, Pending Request, or Pending Payment
    // and whose start time was more than 30 minutes ago.
    const [rows] = await pool.query(`
      SELECT reservation_id, reservation_start_at, reservation_status
      FROM dbo.Reservations
      WHERE reservation_status IN (N'Reserved', N'Confirmed', N'Pending Request', N'Pending Payment')
        AND reservation_start_at < DATEADD(minute, -30, SYSDATETIME())
    `);

    if (rows.length === 0) return;

    for (const r of rows) {
      try {
        if (r.reservation_status === 'Pending Request' || r.reservation_status === 'Pending Payment') {
          await updateReservationStatus({
            connection: pool,
            reservationId: r.reservation_id,
            toStatus: RESERVATION_STATUS.CANCELLED,
            staffId: null,
            auditAction: "SYSTEM_AUTO_CANCEL_EXPIRED"
          });
          console.log(`[Sweeper] Reservation ${r.reservation_id} marked as Cancelled due to 30m timeout for ${r.reservation_status}.`);
        } else {
          await updateReservationStatus({
            connection: pool,
            reservationId: r.reservation_id,
            toStatus: RESERVATION_STATUS.NO_SHOW,
            staffId: null,
            auditAction: "SYSTEM_AUTO_NO_SHOW"
          });
          console.log(`[Sweeper] Reservation ${r.reservation_id} marked as No Show due to 30m timeout.`);
        }
      } catch (e) {
        console.error(`[Sweeper] Failed to mark ${r.reservation_id}:`, e.message);
      }
    }
  } catch (error) {
    console.error("[Sweeper] Failed to sweep No Shows:", error.message);
  }
};
