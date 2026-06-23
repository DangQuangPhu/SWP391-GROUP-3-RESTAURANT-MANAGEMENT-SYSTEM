import sql from 'mssql';
import { getRawPool } from '../db.js';

let cronInterval = null;
let paymentCheckInterval = null;
let isRunning = false;
let isCheckingPayments = false;

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATIC PAYMENT VERIFICATION JOB
// Polls SePay's User API every 10 seconds looking for transactions that match
// any reservation currently in "Payment Pending" status.
// When found → auto-confirms the reservation (same flow as a real webhook).
// ─────────────────────────────────────────────────────────────────────────────
const startPaymentVerificationJob = () => {
  if (paymentCheckInterval) return;

  if (!process.env.SEPAY_USER_TOKEN) {
    console.log('[CronService] SEPAY_USER_TOKEN not set — automatic payment verification disabled.');
    return;
  }

  console.log('[CronService] Starting automatic SePay payment verification (every 10s)...');

  paymentCheckInterval = setInterval(async () => {
    if (isCheckingPayments) return;
    isCheckingPayments = true;

    try {
      const pool = await getRawPool();

      // Get all reservations currently waiting for payment
      const pendingResult = await pool.request().query(`
        SELECT reservation_id, order_code, deposit_amount, created_at
        FROM dbo.Reservations
        WHERE reservation_status = 'Payment Pending'
          AND order_code IS NOT NULL
          AND DATEDIFF(minute, created_at, SYSDATETIME()) < 16
        ORDER BY created_at DESC
      `);

      const pending = pendingResult.recordset;
      if (pending.length === 0) {
        isCheckingPayments = false;
        return;
      }

      // Fetch recent SePay transactions (last 20 minutes)
      const { fetchRecentTransactions } = await import('./sePayService.js');
      const since = new Date(Date.now() - 20 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      let transactions = [];
      try {
        transactions = await fetchRecentTransactions({ limit: 50, since });
      } catch (sePayErr) {
        console.warn('[CronService] SePay API fetch failed:', sePayErr.message);
        isCheckingPayments = false;
        return;
      }

      if (transactions.length === 0) {
        isCheckingPayments = false;
        return;
      }

      console.log(`[CronService] Checking ${pending.length} pending reservations against ${transactions.length} SePay transactions...`);

      // Match each pending reservation against transactions
      for (const reservation of pending) {
        const orderCode = (reservation.order_code || '').toUpperCase();
        const expectedAmount = parseFloat(reservation.deposit_amount || 0);

        for (const txn of transactions) {
          const content = (txn.transaction_content || txn.content || '').toUpperCase();
          const received = parseFloat(txn.amount_in || txn.transfer_amount || 0);

          if (content.includes(orderCode) && received + 0.01 >= expectedAmount) {
            console.log(`[CronService] ✅ MATCH FOUND: Reservation ${reservation.reservation_id} (${orderCode}) → SePay txn ${txn.id}, amount: ${received}`);

            // Simulate the SePay webhook to trigger the exact same confirmation flow
            try {
              const { handleSepayWebhook } = await import('../controllers/paymentController.js');
              const mockReq = {
                headers: { authorization: process.env.SEPAY_API_KEY || 'Apikey Phurai_Secret_Token_2026' },
                body: {
                  transferAmount: received,
                  content: reservation.order_code,
                  referenceCode: `AUTO-${txn.id || Date.now()}`,
                  transferType: 'in',
                },
              };
              const mockRes = {
                status: (code) => ({ json: (data) => console.log(`[CronService] Webhook result ${code}:`, data?.message) }),
                json: (data) => console.log('[CronService] Webhook result:', data?.message),
              };
              await handleSepayWebhook(mockReq, mockRes);
            } catch (confirmErr) {
              console.error('[CronService] Failed to auto-confirm reservation:', confirmErr.message);
            }
            break; // move to next reservation
          }
        }
      }

    } catch (err) {
      console.error('[CronService] Payment verification job error:', err.message);
    } finally {
      isCheckingPayments = false;
    }
  }, 10 * 1000); // every 10 seconds
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY SWEEP JOB — runs every 1 minute, cancels unpaid reservations
// ─────────────────────────────────────────────────────────────────────────────
export const startCronJobs = () => {
  if (cronInterval) return;

  console.log('[CronService] Starting background jobs...');

  // Start the automatic payment verification job first
  startPaymentVerificationJob();

  // Run every 1 minute — sweep expired unpaid reservations
  cronInterval = setInterval(async () => {
    if (isRunning) {
       console.warn('[CronService] Previous interval still running. Skipping...');
       return;
    }
    isRunning = true;

    try {
      const pool = await getRawPool();
      
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
  if (paymentCheckInterval) {
    clearInterval(paymentCheckInterval);
    paymentCheckInterval = null;
  }
  console.log('[CronService] Background jobs stopped.');
};
