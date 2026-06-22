import sql from 'mssql';
import { getRawPool } from '../db.js';

let cronInterval = null;
let isRunning = false;

export const startCronJobs = () => {
  if (cronInterval) return;

  console.log('[CronService] Starting background jobs...');

  // Run every 1 minute
  cronInterval = setInterval(async () => {
    if (isRunning) {
       console.warn('[CronService] Previous interval still running. Skipping...');
       return;
    }
    isRunning = true;

    try {
      const pool = await getRawPool();
      
      // Find all Pending Payment reservations older than 15 minutes
      const selectResult = await pool.request().query(`
        SELECT reservation_id, order_code
        FROM dbo.Reservations
        WHERE reservation_status = 'Pending Payment'
          AND DATEDIFF(minute, created_at, SYSDATETIME()) >= 15
      `);

      const expiredReservations = selectResult.recordset;
      
      if (expiredReservations.length === 0) {
        // Safety Rule: Do not spam console if 0 records
        isRunning = false;
        return;
      }

      console.log(`[CronService] Found ${expiredReservations.length} expired reservations. Processing cleanup...`);

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // Extract IDs for batch operations
        const ids = expiredReservations.map(r => r.reservation_id);
        const idsString = ids.join(',');

        // 1. Batch Update Status
        await transaction.request().query(`
          UPDATE dbo.Reservations
          SET reservation_status = 'PaymentFailed',
              cancel_reason = 'Payment Expired',
              cancelled_at = SYSDATETIME(),
              updated_at = SYSDATETIME()
          WHERE reservation_id IN (${idsString})
        `);

        // 2. Batch Insert AuditLogs
        for (const res of expiredReservations) {
           await transaction.request()
             .input('actionName', sql.VarChar, 'PAYMENT_EXPIRED - Created by: System (Automated Cleanup)')
             .input('targetTable', sql.VarChar, 'Reservations')
             .input('targetId', sql.Int, res.reservation_id)
             .input('newValue', sql.VarChar, JSON.stringify({ reservation_status: 'PaymentFailed', order_code: res.order_code }))
             .query(`
               INSERT INTO dbo.AuditLogs (action_name, target_table, target_id, new_value_json, created_at)
               VALUES (@actionName, @targetTable, @targetId, @newValue, SYSDATETIME())
             `);
        }

        await transaction.commit();
        console.log(`[CronService] Successfully swept ${expiredReservations.length} expired orders.`);

      } catch (dbError) {
        await transaction.rollback();
        console.error('[CronService] Error during batch sweep transaction:', dbError);
      }

    } catch (error) {
      console.error('[CronService] Interval error:', error);
    } finally {
      isRunning = false;
    }
  }, 60 * 1000); // 60,000 ms = 1 minute
};

export const stopCronJobs = () => {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[CronService] Background jobs stopped.');
  }
};
