import sql from 'mssql';
import { getRawPool } from '../db.js';
import { getIO } from '../socket.js';
import { sendReservationInvoiceEmail, sendCheckoutReceiptEmail } from '../email.js';
import { RESERVATION_STATUS } from '../constants/reservationStatus.js';
import { handlePostCheckoutSuccess } from '../services/checkoutHelper.js';
import { notifyStaffNewCustomerAction } from '../services/notificationService.js';


/**
 * Handles incoming webhooks from SePay
 * Endpoint: POST /sepay-webhook (via paymentRoutes)
 */
export const handleSepayWebhook = async (req, res) => {
  try {
    // 1. Security Authentication: Validate Authorization header
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.SEPAY_API_KEY || 'Apikey Phurai_Secret_Token_2026';

    if (!authHeader || authHeader !== expectedKey) {
      console.warn('[SePay Webhook] Unauthorized access attempt.');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 2. Payload Processing
    const { transferAmount, content, referenceCode, transferType } = req.body;

    // Ignore if not an inward transaction
    if (transferType !== 'in') {
      return res.status(200).json({ success: true, message: 'Ignored non-inward transaction' });
    }

    if (!content) {
      return res.status(200).json({ success: true, message: 'Webhook received, but no content provided' });
    }

    // Extract Order or Reservation ID. Examples: "ORD1234", "DH1234", "RES123", "PHURAI123456".
    let match = content.match(/(PHURAI|RES|DH|ORD)(\d+)/i);
    if (!match) {
      // Fallback to simple number match if no prefix, assuming it's an order
      const numMatch = content.match(/\d+/);
      if (!numMatch) {
        console.warn(`[SePay Webhook] No order ID found in content: ${content}`);
        return res.status(200).json({ success: true, message: 'Webhook received, but no valid code found' });
      }
      match = ['DH' + numMatch[0], 'DH', numMatch[0]];
    }

    const prefix = match[1].toUpperCase();
    const targetId = parseInt(match[2], 10);

    const pool = await getRawPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      if (prefix === 'PHURAI' || prefix === 'RES') {
        // --- RESERVATION PAYMENT LOGIC ---
        // Look up using order_code instead of reservation_id since we generated a unique PHURAIxxxxxx code.
        const actualOrderCode = content.match(/(PHURAI|RES)\d+/i)?.[0]?.toUpperCase();
        if (!actualOrderCode) {
          await transaction.rollback();
          return res.status(200).json({ success: true, message: 'Webhook received, but no valid order code found' });
        }

        const resResult = await transaction.request()
          .input('orderCode', sql.VarChar(50), actualOrderCode)
          .query('SELECT reservation_id, reservation_status, final_total, deposit_amount, preorder_json, customer_id, order_code, applied_promo_code FROM dbo.Reservations WHERE order_code = @orderCode');

        if (resResult.recordset.length === 0) {
          await transaction.rollback();
          console.warn(`[SePay Webhook] Reservation with code ${actualOrderCode} not found`);
          return res.status(200).json({ success: true, message: 'Webhook received, but reservation not found' });
        }

        const reservation = resResult.recordset[0];
        // Guard: skip if already paid
        const alreadyPaidStatuses = ['Await Check-in', 'Completed', 'Dining'];
        if (alreadyPaidStatuses.includes(reservation.reservation_status)) {
          await transaction.rollback();
          return res.status(200).json({ success: true, message: 'Webhook received, reservation is already confirmed/paid' });
        }

        // Validate Amount — be lenient with floating point
        if (parseFloat(transferAmount) + 0.009 < parseFloat(reservation.deposit_amount)) {
          await transaction.rollback();
          console.warn(`[SePay Webhook] Insufficient funds for ${actualOrderCode}. Expected: ${reservation.deposit_amount}, Received: ${transferAmount}`);
          return res.status(200).json({ success: true, message: 'Insufficient funds received' });
        }

        // a. Update reservation to 'Await Check-in' (the canonical paid/awaiting-check-in state)
        await transaction.request()
          .input('resId', sql.Int, reservation.reservation_id)
          .input('resStatus', sql.VarChar, 'Await Check-in')
          .query(`
            UPDATE dbo.Reservations 
            SET reservation_status = @resStatus, 
                updated_at = SYSDATETIME()
            WHERE reservation_id = @resId
          `);

        // a2. Update table status to 'Reserved'
        const tableUpdateResult = await transaction.request()
          .input('resId', sql.Int, reservation.reservation_id)
          .input('tableStatus', sql.VarChar, 'Reserved')
          .query(`
            UPDATE dbo.RestaurantTables
            SET table_status = @tableStatus, updated_at = SYSDATETIME()
            WHERE table_id IN (
              SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @resId
            ) AND table_status = 'Available'
          `);

        if (tableUpdateResult.rowsAffected[0] === 0) {
          await transaction.request()
            .input('actionName', sql.VarChar, 'SYSTEM_TABLE_STATUS_CONFLICT')
            .input('targetTable', sql.VarChar, 'Reservations')
            .input('targetId', sql.Int, reservation.reservation_id)
            .input('newValue', sql.VarChar, JSON.stringify({ error: 'Table no longer Available when payment arrived' }))
            .query(`
              INSERT INTO dbo.AuditLogs (action_name, target_table, target_id, new_value_json, created_at)
              VALUES (@actionName, @targetTable, @targetId, @newValue, SYSDATETIME())
            `);

          const io = getIO();
          if (io) {
            io.to('room:manager').emit('table:status_conflict', {
              reservationId: reservation.reservation_id,
              orderCode: reservation.order_code
            });
          }
        }

        // b. Insert into dbo.Payments
        // NOTE: dbo.Payments has a DB trigger — bare OUTPUT...without INTO is forbidden.
        // Use DECLARE @tbl + OUTPUT INTO @tbl pattern, then SELECT from it.
        const paymentResult = await transaction.request()
          .input('resId', sql.Int, reservation.reservation_id)
          .input('paymentMethodId', sql.TinyInt, 3) // 3 = Bank Transfer
          .input('amountPaid', sql.Decimal(12, 2), transferAmount)
          .input('paymentStatus', sql.VarChar, 'Completed')
          .input('transactionRef', sql.VarChar, referenceCode)
          .query(`
            DECLARE @PaymentOutput TABLE (payment_id INT);
            INSERT INTO dbo.Payments (
              reservation_id, payment_method_id, amount_paid, payment_status, transaction_ref, paid_at, created_at, updated_at
            )
            OUTPUT INSERTED.payment_id INTO @PaymentOutput
            VALUES (
              @resId, @paymentMethodId, @amountPaid, @paymentStatus, @transactionRef, SYSDATETIME(), SYSDATETIME(), SYSDATETIME()
            );
            SELECT TOP 1 payment_id FROM @PaymentOutput;
          `);

        const paymentId = paymentResult.recordset[0].payment_id;

        // b2. Atomic Voucher Redemption
        if (reservation.applied_promo_code) {
          const voucherResult = await transaction.request()
            .input('voucherCode', sql.NVarChar(40), reservation.applied_promo_code)
            .query('SELECT voucher_id FROM dbo.Vouchers WHERE voucher_code = @voucherCode');

          if (voucherResult.recordset.length > 0) {
            const voucherId = voucherResult.recordset[0].voucher_id;
            const baseDeposit = 20000;
            const poQuery = await transaction.request()
              .input('resId', sql.Int, reservation.reservation_id)
              .query('SELECT SUM(quantity * unit_price) AS preorder_total FROM dbo.PreorderItems WHERE reservation_id = @resId');
            const preorderTotal = Number(poQuery.recordset[0]?.preorder_total || 0);
            const net_total = Number(reservation.deposit_amount) + Number(reservation.final_total);
            const calculatedDiscount = Math.max(0, preorderTotal - (net_total - baseDeposit));

            // Increment usage
            await transaction.request()
              .input('vId', sql.Int, voucherId)
              .query('UPDATE dbo.Vouchers SET times_used = times_used + 1 WHERE voucher_id = @vId');

            // Insert redemption record
            await transaction.request()
              .input('vId', sql.Int, voucherId)
              .input('pId', sql.Int, paymentId)
              .input('cId', sql.Int, reservation.customer_id || null)
              .input('discount', sql.Decimal(12, 2), calculatedDiscount)
              .query(`
                  INSERT INTO dbo.VoucherRedemptions (voucher_id, payment_id, customer_id, discount_amount, redeemed_at)
                  VALUES (@vId, @pId, @cId, @discount, SYSDATETIME())
                `);
          }
        }

        // c. Update existing Orders with order_type = 'Preorder' to Paid (if any created from route)
        await transaction.request()
          .input('resId', sql.Int, reservation.reservation_id)
          .query(`
            UPDATE dbo.Orders 
            SET order_status = 'Paid', 
                amount_paid = total_amount, 
                updated_at = SYSDATETIME()
            WHERE reservation_id = @resId AND order_type = 'Preorder' AND order_status = 'Open'
          `);

        // d. Insert into dbo.AuditLogs
        await transaction.request()
          .input('actionName', sql.VarChar, 'AUTOMATED_PAYMENT_SUCCESS')
          .input('targetTable', sql.VarChar, 'Reservations')
          .input('targetId', sql.Int, reservation.reservation_id)
          .input('newValue', sql.VarChar, JSON.stringify({ reservation_status: RESERVATION_STATUS.AWAIT_CHECK_IN, transactionRef: referenceCode }))
          .query(`
            INSERT INTO dbo.AuditLogs (action_name, target_table, target_id, new_value_json, created_at)
            VALUES (@actionName, @targetTable, @targetId, @newValue, SYSDATETIME())
          `);

        // Emit socket event — frontend listens for these to advance to success step
        const io = getIO();
        if (io) {
          io.emit('RESERVATION_PAYMENT_SUCCESS', {
            reservationId: reservation.reservation_id,
            reservation_id: reservation.reservation_id,
            orderCode: reservation.order_code,
            status: 'Await Check-in',
            flashCompletePaid: true
          });
          io.emit('RESERVATION_STATUS_CHANGED', {
            id: reservation.reservation_id,
            reservationId: reservation.reservation_id,
            reservation_id: reservation.reservation_id,
            status: 'Await Check-in'
          });
        }

        await transaction.commit();
        console.log(`[SePay Webhook] Reservation ${actualOrderCode} payment successful. Ref: ${referenceCode}`);

        // e. Send invoice email outside transaction (fire-and-forget)
        try {
          const rawPool = await getRawPool();
          const emailQuery = await rawPool.request()
            .input('resId', sql.Int, reservation.reservation_id)
            .query(`
              SELECT 
                r.contact_email, r.contact_name, r.contact_phone, 
                r.reservation_start_at, r.guest_count, r.deposit_amount, r.final_total, r.created_at,
                (SELECT STRING_AGG(t.table_number, ', ') FROM dbo.ReservationTables rt JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id WHERE rt.reservation_id = r.reservation_id) AS table_names,
                (SELECT TOP 1 a.area_name FROM dbo.ReservationTables rt JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id WHERE rt.reservation_id = r.reservation_id) AS area_name
              FROM dbo.Reservations r 
              WHERE r.reservation_id = @resId
            `);

          const resInfo = emailQuery.recordset[0];
          if (resInfo && resInfo.contact_email) {
            let finalPreorderItems = [];
            const poQuery = await rawPool.request()
              .input('resId', sql.Int, reservation.reservation_id)
              .query('SELECT pi.quantity, pi.unit_price, d.dish_name FROM dbo.PreorderItems pi JOIN dbo.Dishes d ON pi.dish_id = d.dish_id WHERE pi.reservation_id = @resId');
            finalPreorderItems = poQuery.recordset.map(r => ({
              name: r.dish_name,
              qty: r.quantity,
              price: r.unit_price
            }));

            await sendReservationInvoiceEmail({
              to: resInfo.contact_email,
              paymentId: paymentId,
              reservation: {
                reservation_id: reservation.reservation_id,
                contact_name: resInfo.contact_name,
                contact_phone: resInfo.contact_phone,
                contact_email: resInfo.contact_email,
                reservation_start_at: resInfo.reservation_start_at,
                date: resInfo.reservation_start_at ? resInfo.reservation_start_at.toLocaleDateString("vi-VN") : '',
                time: resInfo.reservation_start_at ? `${String(resInfo.reservation_start_at.getHours()).padStart(2, '0')}:${String(resInfo.reservation_start_at.getMinutes()).padStart(2, '0')}` : '',
                guest_count: resInfo.guest_count,
                deposit_amount: resInfo.deposit_amount,
                final_total: resInfo.final_total,
                created_at: resInfo.created_at,
                table_names: resInfo.table_names,
                area_name: resInfo.area_name
              },
              preorderItems: finalPreorderItems,
              totalAmount: transferAmount
            });
          }
        } catch (emailErr) {
          console.error('[SePay Webhook] Failed to send invoice email:', emailErr);
        }

      } else {
        // --- ORDER PAYMENT LOGIC (DH) ---
        const orderId = targetId;
        const orderResult = await transaction.request()
          .input('orderId', sql.Int, orderId)
          .query('SELECT order_id, order_status, total_amount, amount_paid, table_id, qr_session_id, reservation_id FROM dbo.Orders WHERE order_id = @orderId');

        if (orderResult.recordset.length === 0) {
          await transaction.rollback();
          console.warn(`[SePay Webhook] Order ${orderId} not found`);
          return res.status(200).json({ success: true, message: 'Webhook received, but order not found' });
        }

        const order = orderResult.recordset[0];

        if (order.order_status === 'Paid') {
          await transaction.rollback();
          return res.status(200).json({ success: true, message: 'Webhook received, order is already Paid' });
        }

        const receivedAmount = Number(transferAmount) || 0;
        const outstandingAmount = Math.max(
          0,
          Number(order.total_amount || 0) - Number(order.amount_paid || 0)
        );

        if (receivedAmount + 0.009 < outstandingAmount) {
          await transaction.rollback();
          console.warn(`[SePay Webhook] Insufficient funds transferred for order ${orderId}. Expected: ${outstandingAmount}, Received: ${transferAmount}`);
          return res.status(200).json({ success: true, message: 'Insufficient funds received' });
        }

        // Update the order status and amount paid
        await transaction.request()
          .input('orderId', sql.Int, orderId)
          .input('orderStatus', sql.VarChar, 'Paid')
          .input('amountPaid', sql.Decimal(12, 2), transferAmount)
          .query(`
            UPDATE dbo.Orders 
            SET order_status = @orderStatus, 
                amount_paid = amount_paid + @amountPaid, 
                updated_at = SYSDATETIME()
            WHERE order_id = @orderId
          `);

        // 1. Update table status to Cleaning
        await transaction.request()
          .input('tableId', sql.SmallInt, order.table_id)
          .query(`
            UPDATE dbo.RestaurantTables
            SET table_status = N'Cleaning', updated_at = SYSDATETIME()
            WHERE table_id = @tableId
          `);

        // 2. Update QR Session to Closed (Session Leak Fix)
        if (order.qr_session_id) {
          await transaction.request()
            .input('sessionId', sql.Int, order.qr_session_id)
            .query(`
              UPDATE dbo.QROrderSessions
              SET session_status = N'Closed',
                  closed_at = SYSDATETIME()
              WHERE qr_session_id = @sessionId
            `);
        }

        // 3. & 4. Update Reservation to Completed & Insert Timeline
        if (order.reservation_id) {
          await transaction.request()
            .input('resId', sql.Int, order.reservation_id)
            .query(`
              UPDATE dbo.Reservations
              SET reservation_status = N'Completed',
                  updated_at = SYSDATETIME()
              WHERE reservation_id = @resId
            `);

          await transaction.request()
            .input('resId', sql.Int, order.reservation_id)
            .query(`
              INSERT INTO dbo.ReservationTimelines (reservation_id, status_from, status_to, note, created_at)
              VALUES (@resId, N'Dining', N'Completed', N'Payment completed', SYSDATETIME())
            `);
        }

        // Record the payment
        await transaction.request()
          .input('orderId', sql.Int, orderId)
          .input('paymentMethodId', sql.TinyInt, 3)
          .input('amountPaid', sql.Decimal(12, 2), transferAmount)
          .input('paymentStatus', sql.VarChar, 'Completed')
          .input('transactionRef', sql.VarChar, referenceCode)
          .query(`
            INSERT INTO dbo.Payments (
              order_id, payment_method_id, amount_paid, payment_status, transaction_ref, paid_at, created_at, updated_at
            ) VALUES (
              @orderId, @paymentMethodId, @amountPaid, @paymentStatus, @transactionRef, SYSDATETIME(), SYSDATETIME(), SYSDATETIME()
            )
          `);

        // Audit Log
        await transaction.request()
          .input('actionName', sql.VarChar, 'SePay Webhook Payment')
          .input('targetTable', sql.VarChar, 'Orders')
          .input('targetId', sql.Int, orderId)
          .input('newValue', sql.VarChar, JSON.stringify({ order_status: 'Paid', transactionRef: referenceCode }))
          .query(`
            INSERT INTO dbo.AuditLogs (action_name, target_table, target_id, new_value_json, created_at)
            VALUES (@actionName, @targetTable, @targetId, @newValue, SYSDATETIME())
          `);

        await transaction.commit();
        console.log(`[SePay Webhook] Order ${orderId} marked as Paid successfully. Ref: ${referenceCode}`);

        // Send email receipt
        try {
          await handlePostCheckoutSuccess(orderId, transferAmount);
        } catch (receiptErr) {
          console.error('[SePay Webhook] Failed to process post-checkout success tasks:', receiptErr);
        }

        const io = getIO();
        if (io) {
          const payload = {
            orderId,
            order_id: orderId,
            status: 'Paid',
            table_id: order.table_id,
            session_id: order.qr_session_id ?? null,
            amount_paid: receivedAmount,
          };
          io.emit('PAYMENT_STATUS_CHANGED', payload);
          io.emit('QR_SESSION_PAYMENT_COMPLETED', payload);
          io.to("room:kitchen").emit("kds:clear_order", { orderId: orderId });
          io.to("room:staff").to("room:manager").emit("table:status_changed", { tableId: order.table_id, status: 'Cleaning' });
          if (order.reservation_id) {
            io.to('room:staff').to('room:manager').emit('reservation:status_changed', {
              reservation_id: order.reservation_id,
              id: order.reservation_id,
              status: 'Completed',
              new_status: 'Completed'
            });
            io.to('room:staff').emit('reservation:checkout_ready', { reservation_id: order.reservation_id });
          }
          if (order.qr_session_id) {
            io.to(`session_${order.qr_session_id}`).emit('PAYMENT_STATUS_CHANGED', payload);
            io.to(`session_${order.qr_session_id}`).emit('QR_SESSION_PAYMENT_COMPLETED', payload);
          }
        }
      }

      // 4. Response
      return res.status(200).json({ success: true, message: 'Webhook received and processed' });

    } catch (dbError) {
      await transaction.rollback();
      throw dbError;
    }

  } catch (error) {
    console.error('[SePay Webhook] Error processing webhook:', error);
    // Important: return 500 so SePay will retry
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * Customer requests to pay by cash on delivery
 * POST /api/payments/cash-on-delivery
 */
export const requestCashOnDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const pool = await getRawPool();
    const result = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT o.order_id, o.table_id, o.total_amount, o.reservation_id, t.table_number 
        FROM dbo.Orders o
        LEFT JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
        WHERE o.order_id = @orderId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = result.recordset[0];

    await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        UPDATE dbo.Orders 
        SET order_status = 'Billed' 
        WHERE order_id = @orderId AND order_status != 'Paid'
      `);

    // 1. Insert DB notifications for all staff/managers and emit NEW_CUSTOMER_ACTION
    await notifyStaffNewCustomerAction({
      actionType: 'cash_payment',
      title: 'Cash Payment Requested',
      message: `Table ${order.table_number || 'N/A'} requested Cash on Delivery payment of ${Number(order.total_amount).toLocaleString('vi-VN')}₫.`,
      payload: {
        orderId: order.order_id,
        tableId: order.table_id,
        tableNumber: order.table_number,
        amount: order.total_amount,
        reservationId: order.reservation_id
      }
    });

    // 2. Also emit custom socket events for immediate page warnings
    const io = getIO();
    if (io) {
      io.to('room:staff').to('room:manager').emit('payment:cash_pending', {
        orderId: order.order_id,
        tableId: order.table_id,
        tableNumber: order.table_number,
        amount: order.total_amount,
        reservationId: order.reservation_id
      });
    }

    return res.json({ success: true, message: 'Staff notified' });
  } catch (error) {
    console.error('requestCashOnDelivery Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Staff confirms a cash payment
 * POST /api/payments/staff-confirm-cash
 */
export const confirmCashPaymentStaff = async (req, res) => {
  try {
    const { orderId, tableId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const pool = await getRawPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const orderRes = await transaction.request()
        .input('orderId', sql.Int, orderId)
        .query('SELECT total_amount, reservation_id FROM dbo.Orders WHERE order_id = @orderId');

      if (orderRes.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const order = orderRes.recordset[0];

      // Insert into Payments table to ensure it appears in Revenue
      const pmRes = await transaction.request()
        .query(`SELECT payment_method_id FROM dbo.PaymentMethods WHERE method_name = N'Cash'`);
      const paymentMethodId = pmRes.recordset.length > 0 ? pmRes.recordset[0].payment_method_id : 1;

      await transaction.request()
        .input('orderId', sql.Int, orderId)
        .input('resId', sql.Int, order.reservation_id || null)
        .input('pmId', sql.TinyInt, paymentMethodId)
        .input('amountPaid', sql.Decimal(12, 2), order.total_amount)
        .input('staffId', sql.Int, req.user?.user_id || req.user?.id || null)
        .query(`
          INSERT INTO dbo.Payments (order_id, reservation_id, payment_method_id, amount_paid, change_given, payment_status, processed_by_staff_id, paid_at, created_at, updated_at)
          VALUES (@orderId, @resId, @pmId, @amountPaid, 0, N'Completed', @staffId, SYSDATETIME(), SYSDATETIME(), SYSDATETIME())
        `);

      // Update Order status
      await transaction.request()
        .input('orderId', sql.Int, orderId)
        .input('amountPaid', sql.Decimal(10, 2), order.total_amount)
        .query(`
          UPDATE dbo.Orders 
          SET order_status = 'Paid', amount_paid = @amountPaid
          WHERE order_id = @orderId
        `);

      if (tableId) {
        await transaction.request()
          .input('tableId', sql.Int, tableId)
          .query(`
            UPDATE dbo.RestaurantTables 
            SET table_status = 'Cleaning' 
            WHERE table_id = @tableId
          `);
      }

      if (order.reservation_id) {
        await transaction.request()
          .input('resId', sql.Int, order.reservation_id)
          .query(`
            UPDATE dbo.Reservations 
            SET reservation_status = 'Completed' 
            WHERE reservation_id = @resId AND reservation_status != 'Completed'
          `);
      }

      // Insert into AuditLogs for Timeline feature
      const staffName = req.user?.name || req.user?.full_name || 'Staff Member';
      await transaction.request()
        .input('userId', sql.Int, req.user?.user_id || req.user?.id || null)
        .input('actionName', sql.NVarChar(100), 'Cash Payment Confirmed')
        .input('targetTable', sql.NVarChar(128), 'Orders')
        .input('targetId', sql.Int, orderId)
        .input('newVal', sql.NVarChar(sql.MAX), JSON.stringify({
          staffName,
          amountPaid: order.total_amount,
          method: 'Cash on Delivery',
          tableId
        }))
        .query(`
          INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
          VALUES (@userId, @actionName, @targetTable, @targetId, @newVal, SYSDATETIME())
        `);

      await transaction.commit();

      try {
        await handlePostCheckoutSuccess(orderId, order.total_amount);
      } catch (receiptErr) {
        console.error('[confirmCashPaymentStaff] Failed to process post-checkout success tasks:', receiptErr);
      }

      const io = getIO();
      if (io) {
        io.emit('payment:confirmed', { orderId });
        if (order.reservation_id) {
          io.to('room:staff').to('room:manager').emit('reservation:status_changed', {
            reservation_id: order.reservation_id,
            id: order.reservation_id,
            status: 'Completed',
            new_status: 'Completed'
          });
        }
      }

      return res.json({ success: true, message: 'Payment confirmed' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('confirmCashPaymentStaff Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
