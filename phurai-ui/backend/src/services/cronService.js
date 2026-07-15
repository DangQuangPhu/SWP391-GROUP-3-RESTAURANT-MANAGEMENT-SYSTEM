import sql from 'mssql';
import { getRawPool } from '../db.js';

let cronInterval = null;
let sepayInterval = null;
let isRunning = false;
let isPollingSePay = false;

// ─────────────────────────────────────────────────────────────────────────────
// Active SePay payment verification helper that polls transaction records.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY SWEEP JOB — runs every 1 minute, cancels unpaid reservations
// ─────────────────────────────────────────────────────────────────────────────
export const startCronJobs = () => {
  if (cronInterval) return;

  console.log('[CronService] Starting background jobs...');
  console.log('[CronService] Payment verification: active polling enabled (polls SePay API every 5s).');

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
      
      // Find all "Awaiting Deposit" reservations older than 16 minutes (1 min buffer after 15 min window)
      const selectResult = await pool.request().query(`
        SELECT reservation_id, order_code
        FROM dbo.Reservations
        WHERE reservation_status = 'Awaiting Deposit'
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
          SET reservation_status = 'No Show',
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
             .input('newValue', sql.VarChar, JSON.stringify({ reservation_status: 'No Show', order_code: res.order_code }))
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
                status: 'No Show',
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

  // Active SePay Polling Job: runs every 5 seconds
  sepayInterval = setInterval(async () => {
    if (!process.env.SEPAY_USER_TOKEN) return;
    if (isPollingSePay) return;
    isPollingSePay = true;

    try {
      const pool = await getRawPool();
      
      // 1. Check pending reservations (ensure order_code is NOT null and created within last 20 minutes)
      const resQuery = await pool.request().query(`
        SELECT reservation_id, order_code, deposit_amount
        FROM dbo.Reservations
        WHERE reservation_status = 'Awaiting Deposit'
          AND order_code IS NOT NULL
          AND created_at >= DATEADD(minute, -20, SYSDATETIME())
      `);
      
      const pendingReservations = resQuery.recordset;
      
      // 2. Check unpaid orders (only those created within last 20 minutes)
      const orderQuery = await pool.request().query(`
        SELECT order_id, total_amount
        FROM dbo.Orders
        WHERE (order_status = 'Unpaid' OR order_status = 'Open')
          AND created_at >= DATEADD(minute, -20, SYSDATETIME())
      `);
      
      const pendingOrders = orderQuery.recordset;
      
      if (pendingReservations.length === 0 && pendingOrders.length === 0) {
        isPollingSePay = false;
        return;
      }
      
      const { checkPaymentReceived } = await import('./sePayService.js');
      const { handleSepayWebhook } = await import('../controllers/paymentController.js');

      // Process reservations
      for (const res of pendingReservations) {
        try {
          const { found, transaction } = await checkPaymentReceived(res.order_code, res.deposit_amount);
          if (found) {
            console.log(`[CronService] Polling confirmed payment for reservation ${res.reservation_id}, code: ${res.order_code}`);
            
            const mockReq = {
              headers: {
                authorization: process.env.SEPAY_API_KEY || 'Apikey Phurai_Secret_Token_2026'
              },
              body: {
                transferAmount: transaction.amount_in || transaction.transfer_amount || res.deposit_amount,
                content: res.order_code,
                referenceCode: String(transaction.id || `AUTO-POLL-${Date.now()}`),
                transferType: 'in'
              }
            };
            
            const mockRes = {
              status: (code) => ({
                json: (data) => console.log(`[CronService] Internal webhook reservation update: status=${code}`, data)
              }),
              json: (data) => console.log('[CronService] Internal webhook reservation update: success', data)
            };
            
            await handleSepayWebhook(mockReq, mockRes);
          }
        } catch (resErr) {
          console.error(`[CronService] Active polling failed to verify reservation ${res.reservation_id}:`, resErr.message);
        }
      }

      // Process orders
      for (const order of pendingOrders) {
        const orderCode = `DH${order.order_id}`;
        try {
          const { found, transaction } = await checkPaymentReceived(orderCode, order.total_amount);
          if (found) {
            console.log(`[CronService] Polling confirmed payment for order ${order.order_id}`);
            
            const mockReq = {
              headers: {
                authorization: process.env.SEPAY_API_KEY || 'Apikey Phurai_Secret_Token_2026'
              },
              body: {
                transferAmount: transaction.amount_in || transaction.transfer_amount || order.total_amount,
                content: orderCode,
                referenceCode: String(transaction.id || `AUTO-POLL-${Date.now()}`),
                transferType: 'in'
              }
            };
            
            const mockRes = {
              status: (code) => ({
                json: (data) => console.log(`[CronService] Internal webhook order update: status=${code}`, data)
              }),
              json: (data) => console.log('[CronService] Internal webhook order update: success', data)
            };
            
            await handleSepayWebhook(mockReq, mockRes);
          }
        } catch (orderErr) {
          console.error(`[CronService] Active polling failed to verify order ${order.order_id}:`, orderErr.message);
        }
      }

    } catch (err) {
      console.error('[CronService] Active SePay polling error:', err.message);
    } finally {
      isPollingSePay = false;
    }
  }, 5000); // 5 seconds
};

export const stopCronJobs = () => {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
  if (sepayInterval) {
    clearInterval(sepayInterval);
    sepayInterval = null;
  }
  console.log('[CronService] Background jobs stopped.');
};

