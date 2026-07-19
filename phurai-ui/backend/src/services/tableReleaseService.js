/**
 * tableReleaseService.js
 *
 * Centralizes all logic for:
 *  - Computing EstimatedReleaseTime from guest count + optional staff override
 *  - Opening a new TableOccupancySession when a table becomes Occupied
 *  - Closing an active session when a table is released (payment / staff confirm)
 *
 * Party-size defaults (confirmed by business):
 *   1-2 guests → 60 min
 *   3-4 guests → 90 min
 *   5-6 guests → 105 min
 *   7+ guests  → 120 min
 * Buffer: 15 min (configurable via RestaurantSettings.cleaning_buffer_min)
 *
 * EstimatedReleaseTime = check_in_at + estimatedDurationMin + bufferMin
 * EstimatedReleaseTime is STATIC once set — not auto-updated when new orders arrive.
 */

import sql from 'mssql';
import { getRawPool } from '../db.js';

// Default buffer if the setting is missing from DB
const DEFAULT_BUFFER_MIN = 15;

/**
 * Returns the default estimated dining duration in minutes based on party size.
 * Only used when the guest/staff has not explicitly provided a duration input.
 * @param {number} guestCount
 * @returns {number} minutes
 */
export function getDefaultDurationMin(guestCount) {
  const count = Number(guestCount) || 1;
  if (count <= 2) return 60;
  if (count <= 4) return 90;
  if (count <= 6) return 105;
  return 120;
}

/**
 * Loads the cleaning buffer minutes from RestaurantSettings.
 * Falls back to DEFAULT_BUFFER_MIN if the setting is missing or invalid.
 * @param {import('mssql').ConnectionPool} pool
 * @returns {Promise<number>}
 */
export async function loadBufferMin(pool) {
  try {
    const result = await pool.request().query(
      `SELECT setting_value FROM dbo.RestaurantSettings WHERE setting_key = N'cleaning_buffer_min'`
    );
    const val = Number(result.recordset[0]?.setting_value);
    if (Number.isFinite(val) && val >= 0) return val;
  } catch (err) {
    console.warn('[tableReleaseService] Failed to load cleaning_buffer_min:', err.message);
  }
  return DEFAULT_BUFFER_MIN;
}

/**
 * Computes the estimated release datetime.
 * @param {Date} checkInAt - Moment the table became Occupied
 * @param {number} estimatedDurationMin - Duration of dining (not including buffer)
 * @param {number} bufferMin - Cleaning buffer
 * @returns {Date}
 */
export function computeEstimatedReleaseAt(checkInAt, estimatedDurationMin, bufferMin) {
  const totalMs = (estimatedDurationMin + bufferMin) * 60 * 1000;
  return new Date(checkInAt.getTime() + totalMs);
}

/**
 * Opens a new TableOccupancySession when a table transitions to Occupied.
 * Must be called inside an existing mssql Transaction.
 *
 * @param {object} params
 * @param {sql.Transaction} params.transaction - Active mssql transaction
 * @param {number}          params.tableId
 * @param {number|null}     params.reservationId
 * @param {number|null}     params.orderId
 * @param {number}          params.guestCount
 * @param {number|null}     params.inputDurationMin - Explicitly chosen by guest/staff; null = use default
 * @param {Date}            [params.checkInAt]      - Defaults to now
 * @returns {Promise<{sessionId: number, estimatedReleaseAt: Date, estimatedDurationMin: number, bufferMin: number}>}
 */
export async function openOccupancySession({
  transaction,
  tableId,
  reservationId = null,
  orderId = null,
  guestCount,
  inputDurationMin = null,
  checkInAt = null,
}) {
  const pool = await getRawPool();
  const bufferMin = await loadBufferMin(pool);
  const estimatedDurationMin = (Number(inputDurationMin) > 0)
    ? Number(inputDurationMin)
    : getDefaultDurationMin(guestCount);

  const now = checkInAt || new Date();
  const estimatedReleaseAt = computeEstimatedReleaseAt(now, estimatedDurationMin, bufferMin);

  const req = new sql.Request(transaction);
  req.input('tableId',             sql.SmallInt,   tableId);
  req.input('reservationId',       sql.Int,        reservationId);
  req.input('orderId',             sql.Int,        orderId);
  req.input('guestCount',          sql.TinyInt,    Math.min(guestCount, 255));
  req.input('estimatedDurationMin',sql.Int,        estimatedDurationMin);
  req.input('bufferMin',           sql.Int,        bufferMin);
  req.input('checkInAt',           sql.DateTime2,  now);
  req.input('estimatedReleaseAt',  sql.DateTime2,  estimatedReleaseAt);

  const result = await req.query(`
    DECLARE @SessionOut TABLE (session_id INT);
    INSERT INTO dbo.TableOccupancySessions
      (table_id, reservation_id, order_id, guest_count,
       estimated_duration_min, buffer_min, check_in_at, estimated_release_at)
    OUTPUT INSERTED.session_id INTO @SessionOut
    VALUES
      (@tableId, @reservationId, @orderId, @guestCount,
       @estimatedDurationMin, @bufferMin, @checkInAt, @estimatedReleaseAt);
    SELECT TOP 1 session_id FROM @SessionOut;
  `);

  const sessionId = result.recordset[0]?.session_id;

  console.log(
    `[tableReleaseService] Opened session #${sessionId} for table ${tableId}: ` +
    `${estimatedDurationMin}min dining + ${bufferMin}min buffer = release at ${estimatedReleaseAt.toISOString()}`
  );

  return { sessionId, estimatedReleaseAt, estimatedDurationMin, bufferMin };
}

/**
 * Opens a new TableOccupancySession using a direct pool connection (no transaction).
 * Use this in contexts where only a pool-wrapper connection is available (e.g., check-in flow).
 *
 * @param {object} params - Same as openOccupancySession except no transaction field
 */
export async function openOccupancySessionDirect({
  tableId,
  reservationId = null,
  orderId = null,
  guestCount,
  inputDurationMin = null,
  checkInAt = null,
}) {
  const pool = await getRawPool();
  const bufferMin = await loadBufferMin(pool);
  const estimatedDurationMin = (Number(inputDurationMin) > 0)
    ? Number(inputDurationMin)
    : getDefaultDurationMin(guestCount);

  const now = checkInAt || new Date();
  const estimatedReleaseAt = computeEstimatedReleaseAt(now, estimatedDurationMin, bufferMin);

  const req = pool.request();
  req.input('tableId',             sql.SmallInt,   tableId);
  req.input('reservationId',       sql.Int,        reservationId);
  req.input('orderId',             sql.Int,        orderId);
  req.input('guestCount',          sql.TinyInt,    Math.min(guestCount, 255));
  req.input('estimatedDurationMin',sql.Int,        estimatedDurationMin);
  req.input('bufferMin',           sql.Int,        bufferMin);
  req.input('checkInAt',           sql.DateTime2,  now);
  req.input('estimatedReleaseAt',  sql.DateTime2,  estimatedReleaseAt);

  const result = await req.query(`
    DECLARE @SessionOut TABLE (session_id INT);
    INSERT INTO dbo.TableOccupancySessions
      (table_id, reservation_id, order_id, guest_count,
       estimated_duration_min, buffer_min, check_in_at, estimated_release_at)
    OUTPUT INSERTED.session_id INTO @SessionOut
    VALUES
      (@tableId, @reservationId, @orderId, @guestCount,
       @estimatedDurationMin, @bufferMin, @checkInAt, @estimatedReleaseAt);
    SELECT TOP 1 session_id FROM @SessionOut;
  `);

  const sessionId = result.recordset[0]?.session_id;
  console.log(
    `[tableReleaseService] (Direct) Opened session #${sessionId} for table ${tableId}: ` +
    `${estimatedDurationMin}min + ${bufferMin}min buffer = release at ${estimatedReleaseAt.toISOString()}`
  );

  return { sessionId, estimatedReleaseAt, estimatedDurationMin, bufferMin };
}

/**
 * Closes the active TableOccupancySession for a table (on payment / staff confirm).
 * Must be called inside an existing mssql Transaction.
 *
 * @param {object} params
 * @param {sql.Transaction} params.transaction
 * @param {number}          params.tableId
 * @param {string}          params.releaseTrigger - 'OnlinePayment' | 'StaffCashConfirm' | 'ManualRelease'
 * @param {number|null}     params.releasedByStaffId
 * @returns {Promise<{sessionId: number|null}>}
 */
export async function closeOccupancySession({
  transaction,
  tableId,
  releaseTrigger,
  releasedByStaffId = null,
}) {
  const req = new sql.Request(transaction);
  req.input('tableId',          sql.SmallInt,  tableId);
  req.input('releaseTrigger',   sql.NVarChar(30), releaseTrigger);
  req.input('staffId',          sql.Int,       releasedByStaffId);

  const result = await req.query(`
    DECLARE @ClosedOut TABLE (session_id INT);
    UPDATE dbo.TableOccupancySessions
    SET released_at          = SYSDATETIME(),
        release_trigger      = @releaseTrigger,
        released_by_staff_id = @staffId,
        updated_at           = SYSDATETIME()
    OUTPUT INSERTED.session_id INTO @ClosedOut
    WHERE table_id   = @tableId
      AND released_at IS NULL;
    SELECT TOP 1 session_id FROM @ClosedOut;
  `);

  const sessionId = result.recordset[0]?.session_id ?? null;

  if (sessionId) {
    console.log(
      `[tableReleaseService] Closed session #${sessionId} for table ${tableId} via ${releaseTrigger}`
    );
  } else {
    console.warn(
      `[tableReleaseService] No open session found for table ${tableId} to close (trigger: ${releaseTrigger})`
    );
  }

  return { sessionId };
}

/**
 * Returns the active (unreleased) occupancy session for a given table, if any.
 * @param {import('mssql').ConnectionPool} pool
 * @param {number} tableId
 * @returns {Promise<object|null>}
 */
export async function getActiveSession(pool, tableId) {
  const result = await pool.request()
    .input('tableId', sql.SmallInt, tableId)
    .query(`
      SELECT TOP 1
        session_id, table_id, reservation_id, order_id, guest_count,
        estimated_duration_min, buffer_min, check_in_at, estimated_release_at,
        overrun_alerted
      FROM dbo.TableOccupancySessions
      WHERE table_id = @tableId
        AND released_at IS NULL
      ORDER BY check_in_at DESC
    `);
  return result.recordset[0] ?? null;
}
