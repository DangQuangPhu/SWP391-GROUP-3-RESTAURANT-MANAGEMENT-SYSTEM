/**
 * shiftMappingStore.js
 * Phūrai Restaurant Management System
 *
 * Bug Fix #3: Replaced JSON-file-based shift mapping with real SQL queries
 * against dbo.StaffSchedules JOIN dbo.Shifts.
 *
 * Source of truth: dbo.Shifts (shift_id, shift_name, start_time, end_time, is_active)
 * Assignment table: dbo.StaffSchedules (user_id, shift_id, work_date)
 *
 * Exports kept backward-compatible so callers (shiftMappingController.js,
 * staffReservationController.js) need minimal changes.
 */

import pool from "../db.js";

// ── Canonical shift label set ─────────────────────────────────────────────────
export const VALID_SHIFT_LABELS = new Set(["Morning", "Afternoon", "Night"]);

export function normalizeShiftLabel(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const canonical = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  if (VALID_SHIFT_LABELS.has(canonical)) return canonical;
  return null;
}

export function shiftLabelToId(label) {
  const normalized = normalizeShiftLabel(label);
  if (!normalized) return null;
  return normalized.toLowerCase();
}

// ── Short-lived in-memory cache (60 s TTL) ────────────────────────────────────
/** @type {{ data: import("mssql").IRecordSet<any>, ts: number } | null} */
let _shiftsCache = null;
const CACHE_TTL_MS = 60_000;

/**
 * Load all active shifts from dbo.Shifts, with 60-second cache.
 * @returns {Promise<Array<{shift_id: number, shift_name: string, start_time: string, end_time: string}>>}
 */
export async function loadActiveShifts() {
  const now = Date.now();
  if (_shiftsCache && now - _shiftsCache.ts < CACHE_TTL_MS) {
    return _shiftsCache.data;
  }
  const [rows] = await pool.query(
    `SELECT shift_id, shift_name, start_time, end_time
     FROM dbo.Shifts
     WHERE is_active = 1
     ORDER BY start_time`
  );
  _shiftsCache = { data: rows, ts: now };
  return rows;
}

/** Invalidate the shifts cache (call after any Shifts write). */
export function invalidateShiftsCache() {
  _shiftsCache = null;
}

/**
 * Get shift boundaries for a specific staff member on a specific date.
 * Fixes Bug #3: queries dbo.StaffSchedules JOIN dbo.Shifts instead of a JSON file.
 * Also applies the overnight-boundary-safe predicate from Bug Fix #1.
 *
 * @param {number} userId
 * @param {string|Date} workDate - date string "YYYY-MM-DD" or a Date object
 * @returns {Promise<{shift_id, shift_name, start_time, end_time} | null>}
 */
export async function getShiftBoundariesForStaff(userId, workDate) {
  const dateStr =
    workDate instanceof Date
      ? workDate.toISOString().slice(0, 10)
      : String(workDate).slice(0, 10);

  const [rows] = await pool.query(
    `SELECT TOP 1
       sh.shift_id,
       sh.shift_name,
       CONVERT(VARCHAR(5), sh.start_time, 108) AS start_time,
       CONVERT(VARCHAR(5), sh.end_time,   108) AS end_time
     FROM dbo.StaffSchedules ss
     JOIN dbo.Shifts sh
       ON sh.shift_id = ss.shift_id
      AND sh.is_active = 1
     WHERE ss.user_id   = ?
       AND ss.work_date = ?`,
    [Number(userId), dateStr]
  );
  return rows[0] || null;
}

/**
 * Get all staff scheduled for today (or a given date) along with their shift info.
 * Used by the shift-mapping controller to build the real staff→shift map.
 *
 * @param {string|Date} [workDate] - Defaults to today
 * @returns {Promise<Array<{user_id, shift_id, shift_name, start_time, end_time}>>}
 */
export async function getStaffShiftMapForDate(workDate) {
  const dateStr = workDate
    ? (workDate instanceof Date
        ? workDate.toISOString().slice(0, 10)
        : String(workDate).slice(0, 10))
    : new Date().toISOString().slice(0, 10);

  const [rows] = await pool.query(
    `SELECT
       ss.user_id,
       sh.shift_id,
       sh.shift_name,
       CONVERT(VARCHAR(5), sh.start_time, 108) AS start_time,
       CONVERT(VARCHAR(5), sh.end_time,   108) AS end_time
     FROM dbo.StaffSchedules ss
     JOIN dbo.Shifts sh
       ON sh.shift_id = ss.shift_id
      AND sh.is_active = 1
     WHERE ss.work_date = ?`,
    [dateStr]
  );
  return rows;
}

/**
 * Get the shift name for a staff user on a given date.
 * Replaces the old getShiftLabelForUserId(userId, mapping) call.
 *
 * @param {number} userId
 * @param {string|Date} [workDate] - Defaults to today
 * @returns {Promise<string|null>} e.g. "Morning", "Night", or null
 */
export async function getShiftLabelForUserId(userId, workDate) {
  const shift = await getShiftBoundariesForStaff(
    userId,
    workDate || new Date().toISOString().slice(0, 10)
  );
  return shift ? shift.shift_name : null;
}

/**
 * @deprecated Legacy sync function — kept for backward compat with callers
 * that haven't migrated to the async version yet. Returns DEFAULT_MAPPING.
 * Remove once all callers use getShiftLabelForUserId().
 */
export function readShiftMapping() {
  console.warn(
    "[shiftMappingStore] readShiftMapping() is deprecated — use getStaffShiftMapForDate() instead."
  );
  return {};
}

/** @deprecated Use updateStaffShift() via schedule endpoint instead. */
export function writeShiftMapping() {
  console.warn(
    "[shiftMappingStore] writeShiftMapping() is deprecated — shift assignments are managed via dbo.StaffSchedules."
  );
}

/** @deprecated */
export function updateShiftForStaff() {
  throw new Error(
    "updateShiftForStaff() is removed. Use PATCH /api/manager/schedules/:id/status to manage shifts via SQL."
  );
}
