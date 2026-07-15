import pool from "../db.js";
import { sendReservationReminderEmail } from "../email.js";

/**
 * Run a cron job to send reservation reminders.
 * Finds 'Confirmed' reservations starting in the next 2 hours where reminder_sent = 0.
 */
export async function runReservationReminders() {
  try {
    const [rows] = await pool.query(`
      SELECT
        r.reservation_id,
        r.reservation_start_at,
        r.reservation_status,
        r.reminder_sent,
        COALESCE(ua.email, r.contact_email, '') AS recipient_email,
        COALESCE(ua.full_name, r.contact_name, N'Guest') AS recipient_name
      FROM dbo.Reservations r
      LEFT JOIN dbo.UserAccounts ua ON ua.user_id = r.customer_id
      WHERE r.reservation_status = 'Await Check-in'
        AND r.reminder_sent = 0
        AND r.reservation_start_at > SYSDATETIME()
        AND r.reservation_start_at <= DATEADD(hour, 2, SYSDATETIME())
    `);

    if (rows.length === 0) {
      return;
    }

    console.log(`[runReservationReminders] Found ${rows.length} reservations to remind.`);

    for (const r of rows) {
      if (!r.recipient_email) {
        console.warn(`[runReservationReminders] No email for reservation #${r.reservation_id}. Skipping.`);
        continue;
      }

      const dateObj = new Date(r.reservation_start_at);
      const reservationDate = dateObj.toLocaleDateString("en-GB"); // DD/MM/YYYY
      const reservationTime = dateObj.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

      try {
        await sendReservationReminderEmail({
          toEmail: r.recipient_email,
          customerName: r.recipient_name,
          reservationId: r.reservation_id,
          reservationDate,
          reservationTime,
        });

        // Mark as sent
        await pool.query(
          `UPDATE dbo.Reservations SET reminder_sent = 1 WHERE reservation_id = ?`,
          [r.reservation_id]
        );
      } catch (err) {
        console.error(`[runReservationReminders] Failed to remind reservation #${r.reservation_id}:`, err);
      }
    }
  } catch (err) {
    console.error("[runReservationReminders] Error running reminder cron:", err);
  }
}
