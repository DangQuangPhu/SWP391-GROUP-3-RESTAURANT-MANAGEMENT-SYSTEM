import { query } from '../config/db.js';

let _shiftCache   = null;
let _cacheExpiry  = 0;
const CACHE_TTL   = 10 * 60 * 1000;

async function getAllShifts() {
  if (_shiftCache && Date.now() < _cacheExpiry) return _shiftCache;

  const rows = await query(
    `SELECT shift_id, shift_name,
            CONVERT(VARCHAR(5), start_time, 108) AS start_time,
            CONVERT(VARCHAR(5), end_time,   108) AS end_time
     FROM dbo.Shifts
     WHERE is_active = 1
     ORDER BY start_time ASC`
  );

  if (rows.length === 0) throw new Error('No active shifts found in dbo.Shifts.');

  _shiftCache  = rows;
  _cacheExpiry = Date.now() + CACHE_TTL;
  return rows;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) throw new Error(`Invalid time format: "${hhmm}"`);
  return h * 60 + m;
}

export async function resolveShift(reservationStartAt) {
  const shifts = await getAllShifts();
  const d      = new Date(reservationStartAt);

  if (isNaN(d.getTime())) {
    throw new Error(`resolveShift: invalid date "${reservationStartAt}"`);
  }

  const totalMinutes = d.getHours() * 60 + d.getMinutes();

  for (const shift of shifts) {
    const shiftStart = toMinutes(shift.start_time);
    const shiftEnd   = toMinutes(shift.end_time);

    if (shiftEnd < shiftStart) {
      if (totalMinutes >= shiftStart || totalMinutes < shiftEnd) return shift;
    } else {
      if (totalMinutes >= shiftStart && totalMinutes < shiftEnd) return shift;
    }
  }

  console.warn(`[ShiftResolver] No shift matched for time ${totalMinutes} min. Falling back to shift[0].`);
  return shifts[0];
}

export async function getShiftStaff(shiftId, date) {
  const dateStr = (date instanceof Date)
    ? date.toISOString().split('T')[0]
    : String(date).split('T')[0];

  const rows = await query(
    `SELECT ss.user_id, ua.full_name, ua.email
     FROM dbo.StaffSchedules ss
     JOIN dbo.UserAccounts ua ON ss.user_id = ua.user_id
     WHERE ss.shift_id          = @ShiftId
       AND ss.work_date         = @Date
       AND ss.attendance_status IN (N'Scheduled', N'Present')
       AND ua.is_active         = 1`,
    { ShiftId: shiftId, Date: dateStr }
  );

  if (rows.length > 0) return rows;

  console.warn(`[ShiftResolver] No staff scheduled for shift ${shiftId} on ${dateStr}. Using fallback.`);
  return query(
    `SELECT user_id, full_name, email
     FROM dbo.UserAccounts
     WHERE role_id = 2 AND is_active = 1`
  );
}
