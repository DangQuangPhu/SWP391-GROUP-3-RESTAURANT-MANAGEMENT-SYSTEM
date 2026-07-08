import sql from 'mssql';
import { getRawPool } from '../db.js';

let cronInterval = null;
let isRunning = false;

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: SePay payment verification is handled purely via webhook push.
// SePay calls POST /api/payments/sepay-webhook whenever a transaction arrives.
// There is NO need to poll SePay API — doing so caused 401 spam in logs.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY SWEEP JOB — runs every 1 minute, cancels unpaid reservations
// ─────────────────────────────────────────────────────────────────────────────
export const startCronJobs = () => {
  if (cronInterval) return;

  console.log('[CronService] Starting background jobs...');
  console.log('[CronService] Payment verification: webhook-only mode (no SePay API polling).');

  // Run every 1 minute — sweep expired unpaid reservations
  cronInterval = setInterval(async () => {
    if (isRunning) {
       console.warn('[CronService] Previous interval still running. Skipping...');
       return;
    }
    isRunning = true;

    try {
      const pool = await getRawPool();
      
      // Sweep expired active customer vouchers
      try {
        const sweepVouchersResult = await pool.request().query(`
          UPDATE dbo.CustomerVouchers
          SET status = N'expired'
          WHERE status = N'active' AND expires_at <= SYSDATETIME()
        `);
        if (sweepVouchersResult.rowsAffected[0] > 0) {
          console.log(`[CronService] Swept ${sweepVouchersResult.rowsAffected[0]} expired vouchers.`);
        }
      } catch (voucherSweepErr) {
        console.error('[CronService] Error sweeping expired vouchers:', voucherSweepErr.message);
      }
      
      // Find all "Payment Pending" reservations older than 16 minutes (1 min buffer after 15 min window)
      const selectResult = await pool.request().query(`
        SELECT reservation_id, order_code
        FROM dbo.Reservations
        WHERE reservation_status = 'Payment Pending'
          AND DATEDIFF(minute, created_at, SYSDATETIME()) >= 16
      `);

      const expiredReservations = selectResult.recordset;
      
      if (expiredReservations.length === 0) {
        isRunning = false;
        return;
      }

      console.log(`[CronService] Found ${expiredReservations.length} expired reservations. Processing cleanup...`);

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const ids = expiredReservations.map(r => r.reservation_id);
        const idsString = ids.join(',');

        await transaction.request().query(`
          UPDATE dbo.Reservations
          SET reservation_status = 'Cancelled',
              cancel_reason = 'Payment Expired',
              cancelled_at = SYSDATETIME(),
              updated_at = SYSDATETIME()
          WHERE reservation_id IN (${idsString})
        `);

        for (const res of expiredReservations) {
           await transaction.request()
             .input('actionName', sql.VarChar, 'PAYMENT_EXPIRED - Created by: System (Automated Cleanup)')
             .input('targetTable', sql.VarChar, 'Reservations')
             .input('targetId', sql.Int, res.reservation_id)
             .input('newValue', sql.VarChar, JSON.stringify({ reservation_status: 'Cancelled', order_code: res.order_code }))
             .query(`
               INSERT INTO dbo.AuditLogs (action_name, target_table, target_id, new_value_json, created_at)
               VALUES (@actionName, @targetTable, @targetId, @newValue, SYSDATETIME())
             `);
        }

        await transaction.commit();
        console.log(`[CronService] Successfully swept ${expiredReservations.length} expired reservations.`);

        try {
          const { getIO } = await import('../socket.js');
          const io = getIO();
          if (io) {
            for (const res of expiredReservations) {
              io.emit('RESERVATION_STATUS_CHANGED', {
                reservationId: res.reservation_id,
                reservation_id: res.reservation_id,
                status: 'Cancelled',
              });
            }
          }
        } catch (socketErr) {
          console.warn('[CronService] Socket emit failed during sweep:', socketErr.message);
        }

      } catch (dbError) {
        await transaction.rollback();
        console.error('[CronService] Error during batch sweep transaction:', dbError);
      }

    } catch (error) {
      console.error('[CronService] Interval error:', error);
    } finally {
      isRunning = false;
    }
  }, 60 * 1000); // 60 seconds
};

export const stopCronJobs = () => {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
  console.log('[CronService] Background jobs stopped.');
};

