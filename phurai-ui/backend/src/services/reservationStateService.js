import { canTransition } from '../constants/reservationStatus.js';
import sql from 'mssql';
import { getIO } from '../socket.js';

/**
 * Validates and transitions a reservation to a new status securely using UPDLOCK.
 * Also logs the action to AuditLogs.
 * Requires an existing transaction connection to be passed in.
 */
export async function updateReservationStatus({ connection, reservationId, toStatus, staffId, auditAction, extraUpdates = "" }) {
  // Determine if it's the custom db.js wrapper or a raw mssql Transaction
  const isWrapper = typeof connection.query === 'function';

  async function execQuery(queryStr, paramsArr) {
    if (isWrapper) {
      return await connection.query(queryStr, paramsArr);
    } else {
      const req = new sql.Request(connection);
      if (paramsArr) {
        paramsArr.forEach((val, i) => {
          req.input(`p${i}`, val);
        });
        // Replace ? with @p0, @p1, etc.
        let i = 0;
        queryStr = queryStr.replace(/\?/g, () => `@p${i++}`);
      }
      const res = await req.query(queryStr);
      return [res.recordset || [], res];
    }
  }

  // 1. Lock the row and check current status
  const [rows] = await execQuery(
    `SELECT reservation_status FROM dbo.Reservations WITH (UPDLOCK, ROWLOCK) WHERE reservation_id = ?`,
    [reservationId]
  );

  if (!rows || rows.length === 0) {
    throw new Error(`Reservation #${reservationId} not found`);
  }

  const fromStatus = rows[0].reservation_status;

  // 2. State machine validation
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(`INVALID_TRANSITION: Cannot transition from '${fromStatus}' to '${toStatus}'`);
  }

  // 3. Update the status (and any extra fields like checked_in_at)
  await execQuery(
    `UPDATE dbo.Reservations 
     SET reservation_status = ?, updated_at = SYSDATETIME() ${extraUpdates}
     WHERE reservation_id = ?`,
    [toStatus, reservationId]
  );

  // 4. Log the audit action and Reservation Timelines
  if (auditAction && staffId) {
    await execQuery(
      `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json)
       VALUES (?, ?, N'Reservations', ?, ?, ?);
       
       INSERT INTO dbo.ReservationTimelines (reservation_id, event_type, performed_by, notes, created_at)
       VALUES (?, ?, ?, N'Status transitioned via system', SYSDATETIME());`,
      [
        staffId, 
        auditAction, 
        reservationId, 
        JSON.stringify({ reservation_status: fromStatus }),
        JSON.stringify({ reservation_status: toStatus }),
        reservationId,
        auditAction,
        staffId
      ]
    );
  }

  // 5. Emit Real-time Socket Event
  const io = getIO();
  if (io) {
    io.to("room:manager").to("room:staff").emit("RESERVATION_STATUS_CHANGED", {
      reservation_id: reservationId,
      old_status: fromStatus,
      new_status: toStatus,
      timestamp: new Date().toISOString()
    });
  }

  return { success: true, fromStatus, toStatus };
}
