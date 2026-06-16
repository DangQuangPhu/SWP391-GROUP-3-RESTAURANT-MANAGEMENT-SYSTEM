import pool from "../db.js";

/**
 * Resolves the shift for a given reservation start time.
 * @param {Date|string} reservationStartAt
 * @returns {Promise<Object>} the shift object (shift_id, shift_name, start_time, end_time)
 */
export async function resolveShift(reservationStartAt) {
  try {
    const [shifts] = await pool.query(
      `SELECT shift_id, shift_name, start_time, end_time
       FROM dbo.Shifts
       WHERE is_active = 1
       ORDER BY start_time ASC`
    );

    if (shifts.length === 0) {
      console.warn("No active shifts found in database.");
      return null;
    }

    const dateObj = new Date(reservationStartAt);
    if (isNaN(dateObj.getTime())) {
      console.error("Invalid date passed to resolveShift:", reservationStartAt);
      return shifts[0];
    }

    const hour = dateObj.getHours();
    const minute = dateObj.getMinutes();
    const totalMinutes = hour * 60 + minute;

    for (const shift of shifts) {
      // e.g. "06:30:00" string from database (Time datatype)
      // sometimes string representation is just "06:30"
      const startTimeStr = String(shift.start_time).substring(0, 5);
      const endTimeStr = String(shift.end_time).substring(0, 5);

      const [sh, sm] = startTimeStr.split(':').map(Number);
      const [eh, em] = endTimeStr.split(':').map(Number);
      const shiftStart = sh * 60 + sm;
      const shiftEnd = eh * 60 + em;

      if (shiftEnd < shiftStart) {
        // Overnight shift (e.g. Night Shift 16:30 -> 00:30)
        if (totalMinutes >= shiftStart || totalMinutes < shiftEnd) {
          return shift;
        }
      } else {
        if (totalMinutes >= shiftStart && totalMinutes < shiftEnd) {
          return shift;
        }
      }
    }

    // Default fallback to first shift
    return shifts[0];
  } catch (error) {
    console.error("Error in resolveShift:", error);
    return null;
  }
}
