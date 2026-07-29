import sql from 'mssql';
import { getRawPool } from '../db.js';
import { sweepTableAssignmentFinalization } from './tableAssignmentFinalizer.js';

let cronInterval = null;
let sepayInterval = null;
let isRunning = false;
let isPollingSePay = false;
let lastDbErrorTime = 0;

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
      
      // Sweep expired active customer promotions
      try {
        const sweepPromotionsResult = await pool.request().query(`
          UPDATE dbo.CustomerPromotions
          SET status = N'expired'
          WHERE status = N'active' AND expires_at <= SYSDATETIME()
        `);
        if (sweepPromotionsResult.rowsAffected[0] > 0) {
          console.log(`[CronService] Swept ${sweepPromotionsResult.rowsAffected[0]} expired promotions.`);
        }
      } catch (promotionSweepErr) {
        console.error('[CronService] Error sweeping expired promotions:', promotionSweepErr.message);
      }
      
      // Find all "Awaiting Deposit" reservations older than 16 minutes (1 min buffer after 15 min window)
      const selectResult = await pool.request().query(`
        SELECT reservation_id, order_code
        FROM dbo.Reservations
        WHERE reservation_status = 'Awaiting Deposit'
          AND DATEDIFF(minute, created_at, SYSDATETIME()) >= 16
      `);

      const expiredReservations = selectResult.recordset;

      try {
        const assignmentSweep = await sweepTableAssignmentFinalization();
        if (assignmentSweep.processed > 0) {
          console.log(`[CronService] Flagged ${assignmentSweep.processed} reservation(s) for table assignment finalization.`);
        }
      } catch (assignmentErr) {
        console.error('[CronService] Table assignment finalization sweep error:', assignmentErr.message);
      }
      
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

      // ─────────────────────────────────────────────────────────────────────
      // OVERRUN SWEEP — find Occupied tables past their EstimatedReleaseTime
      // and alert Staff Reception (once per session, no auto table transition).
      // ─────────────────────────────────────────────────────────────────────
      try {
        const overrunResult = await pool.request().query(`
          SELECT
            tos.session_id,
            tos.table_id,
            tos.reservation_id,
            tos.estimated_release_at,
            t.table_number,
            -- Next incoming reservation for the same table (if any)
            (SELECT TOP 1 r2.reservation_start_at
               FROM dbo.Reservations r2
               JOIN dbo.ReservationTables rt2 ON r2.reservation_id = rt2.reservation_id
               WHERE rt2.table_id = tos.table_id
                 AND r2.reservation_status IN (N'Await Check-in', N'Awaiting Deposit', N'Pending Request')
                 AND r2.reservation_start_at > SYSDATETIME()
               ORDER BY r2.reservation_start_at ASC) AS next_reservation_at
          FROM dbo.TableOccupancySessions tos
          JOIN dbo.RestaurantTables t ON t.table_id = tos.table_id
          WHERE tos.released_at IS NULL
            AND tos.overrun_alerted = 0
            AND tos.estimated_release_at < SYSDATETIME()
            AND t.table_status = N'Occupied'
        `);

        const overrunSessions = overrunResult.recordset;

        if (overrunSessions.length > 0) {
          console.log(`[CronService] Found ${overrunSessions.length} overrun table(s). Sending alerts...`);

          // Get all staff/manager user IDs
          const staffResult = await pool.request().query(`
            SELECT user_id FROM dbo.UserAccounts
            WHERE role_id IN (2, 3, 4) AND is_active = 1
          `);
          const staffIds = staffResult.recordset.map(r => r.user_id);

          for (const session of overrunSessions) {
            const releaseTime = new Date(session.estimated_release_at)
              .toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const nextResText = session.next_reservation_at
              ? ` — Next reservation at ${new Date(session.next_reservation_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
              : '';
            const title = `⚠️ Table Overrun: ${session.table_number}`;
            const message = `Table ${session.table_number} was estimated to be free at ${releaseTime} but is still occupied.${nextResText} Please check and take action.`;

            // Insert notification for each staff member
            for (const staffId of staffIds) {
              try {
                await pool.request()
                  .input('userId',    sql.Int,          staffId)
                  .input('notifType', sql.NVarChar(40), 'Overrun Warning')
                  .input('title',     sql.NVarChar(200), title)
                  .input('message',   sql.NVarChar(2000), message)
                  .query(`
                    INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
                    VALUES (@userId, @notifType, @title, @message, 0, SYSDATETIME())
                  `);
              } catch (notifErr) {
                console.warn(`[CronService] Failed to insert overrun notification for staff ${staffId}:`, notifErr.message);
              }
            }

            // Mark session as alerted (fire once only)
            await pool.request()
              .input('sessionId', sql.Int, session.session_id)
              .query(`
                UPDATE dbo.TableOccupancySessions
                SET overrun_alerted = 1, updated_at = SYSDATETIME()
                WHERE session_id = @sessionId
              `);

            // Emit real-time socket alert to staff/manager rooms
            try {
              const { getIO } = await import('../socket.js');
              const io = getIO();
              if (io) {
                io.to('room:staff').to('room:manager').emit('table:overrun_warning', {
                  sessionId: session.session_id,
                  tableId: session.table_id,
                  tableNumber: session.table_number,
                  estimatedReleaseAt: session.estimated_release_at,
                  nextReservationAt: session.next_reservation_at,
                  title,
                  message,
                  timestamp: new Date().toISOString(),
                });
              }
            } catch (socketErr) {
              console.warn('[CronService] Overrun socket emit failed:', socketErr.message);
            }
          }
        }
      } catch (overrunErr) {
        console.error('[CronService] Overrun sweep error:', overrunErr.message);
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
      if (err?.code !== 'ESOCKET' && !err?.message?.includes('1433')) {
        console.error('[CronService] Active SePay polling error:', err.message);
      }
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
