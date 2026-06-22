import sql from 'mssql';
import { getRawPool } from './db.js';

async function testStateMachine() {
  try {
    const pool = await getRawPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Simulate Customer Submission
      console.log('--- 1. Customer Submission ---');
      const resResult = await transaction.request()
        .query(`
          INSERT INTO dbo.Reservations (
            order_code, contact_name, contact_phone, reservation_start_at, reservation_end_at, guest_count, deposit_amount, final_total, reservation_status, created_at, updated_at
          ) OUTPUT inserted.reservation_id
          VALUES (
            'TEST_ORDER_123', 'John Test', '0123456789', DATEADD(day, 1, SYSDATETIME()), DATEADD(day, 1, DATEADD(hour, 2, SYSDATETIME())), 2, 10000, 50000, 'Pending Payment', SYSDATETIME(), SYSDATETIME()
          )
        `);
      const reservationId = resResult.recordset[0].reservation_id;
      
      const safeValueJson1 = JSON.stringify({
        reservation_id: reservationId,
        reservation_status: 'Pending Payment',
        order_code: 'TEST_ORDER_123'
      });
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('val', sql.NVarChar(sql.MAX), safeValueJson1)
        .query(`
          INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
          VALUES (NULL, 'CUSTOMER_INITIATED_RESERVATION', 'Reservations', @resId, @val, SYSDATETIME())
        `);
      console.log('Customer submission logged.');

      // 2. Simulate Payment Webhook Success
      console.log('--- 2. Payment Webhook Success ---');
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .query(`UPDATE dbo.Reservations SET reservation_status = 'Await Check-in', updated_at = SYSDATETIME() WHERE reservation_id = @resId`);
        
      const safeValueJson2 = JSON.stringify({ reservation_status: 'Await Check-in', transactionRef: 'VNP12345' });
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('val', sql.NVarChar(sql.MAX), safeValueJson2)
        .query(`
          INSERT INTO dbo.AuditLogs (action_name, target_table, target_id, new_value_json, created_at)
          VALUES ('AUTOMATED_PAYMENT_SUCCESS', 'Reservations', @resId, @val, SYSDATETIME())
        `);
      console.log('Payment success logged.');

      // 3. Simulate Staff Quick Check-in
      console.log('--- 3. Staff Quick Check-in ---');
      const tableRes = await transaction.request().query(`
        INSERT INTO dbo.RestaurantTables (area_id, table_number, capacity, table_status)
        OUTPUT inserted.table_id
        VALUES (1, 'TEST-1', 4, 'Available')
      `);
      const tableId = tableRes.recordset[0].table_id;
      
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('tId', sql.Int, tableId)
        .query(`INSERT INTO dbo.ReservationTables (reservation_id, table_id) VALUES (@resId, @tId)`);

      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .query(`UPDATE dbo.Reservations SET reservation_status = 'Check-in', checked_in_at = SYSDATETIME() WHERE reservation_id = @resId`);
        
      await transaction.request()
        .input('tId', sql.Int, tableId)
        .query(`UPDATE dbo.RestaurantTables SET table_status = 'Occupied' WHERE table_id = @tId`);

      const safeValueJson3 = JSON.stringify({ reservation_status: 'Check-in' });
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('val', sql.NVarChar(sql.MAX), safeValueJson3)
        .query(`
          INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
          VALUES (NULL, 'STAFF_MANUAL_CHECKIN', 'Reservations', @resId, @val, SYSDATETIME())
        `);
      console.log('Staff manual checkin logged.');

      await transaction.commit();
      
      // 4. Query Timeline
      console.log('--- 4. Timeline Output ---');
      const timelineRes = await pool.request()
        .input('resId', sql.Int, reservationId)
        .query(`
          SELECT al.action_name, ISNULL(u.full_name, N'Hệ thống tự động') AS actor, al.new_value_json
          FROM dbo.AuditLogs al
          LEFT JOIN dbo.UserAccounts u ON al.user_id = u.user_id
          WHERE al.target_table = 'Reservations' AND al.target_id = @resId
          ORDER BY al.created_at ASC
        `);
      
      console.table(timelineRes.recordset);

      // Cleanup
      await pool.request()
        .input('resId', sql.Int, reservationId)
        .input('tId', sql.Int, tableId)
        .query(`
          DELETE FROM dbo.AuditLogs WHERE target_id = @resId AND target_table = 'Reservations';
          DELETE FROM dbo.ReservationTables WHERE reservation_id = @resId;
          DELETE FROM dbo.Reservations WHERE reservation_id = @resId;
          DELETE FROM dbo.RestaurantTables WHERE table_id = @tId;
        `);

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testStateMachine();
