import pool, { getRawPool } from './server/db.js';
import sql from 'mssql';

async function run() {
  const reservationId = 9;
  const staffUserId = 1;

  try {
    const rawPool = await getRawPool();
    const transaction = new sql.Transaction(rawPool);
    await transaction.begin();
    
    try {
        const request = new sql.Request(transaction);
        request.input('id', sql.Int, reservationId);
        request.input('staffId', sql.Int, staffUserId); // Ensure this is not undefined

        // 1. Update status (canonical value is 'Check-in')
        await request.query(`UPDATE dbo.Reservations SET reservation_status = N'Check-in', checked_in_at = SYSDATETIME(), updated_at = SYSDATETIME() WHERE reservation_id = @id AND reservation_status = N'Confirmed'`);
        
        // 2. Insert Timeline
        await request.query(`INSERT INTO dbo.ReservationTimelines (reservation_id, event_type, performed_by, notes) VALUES (@id, N'GUEST_ARRIVED', @staffId, N'Guest arrived, waiting for table.')`);
        
        // 3. Insert AuditLog
        await request.query(`INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id) VALUES (@staffId, N'CHECK_IN', N'Reservations', @id)`);

        await transaction.commit();
        console.log("Success");
    } catch (error) {
        await transaction.rollback();
        console.error("🚨 CHECKIN CRASH ROOT CAUSE:", error);
    }
  } catch (dbErr) {
    console.error("🚨 DB CONNECTION CRASH:", dbErr);
  }
  process.exit(0);
}

run();
