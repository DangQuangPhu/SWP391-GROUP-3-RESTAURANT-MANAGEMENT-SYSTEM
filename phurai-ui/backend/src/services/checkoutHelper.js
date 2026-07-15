import { getRawPool } from '../db.js';
import sql from 'mssql';
import { sendCheckoutReceiptEmail } from '../email.js';
import { notifyCustomerStaffAction } from './notificationService.js';

export async function handlePostCheckoutSuccess(orderId, receivedAmount) {
  try {
    console.log(`[checkoutHelper] Running post-checkout success tasks for Order #${orderId}`);
    const pool = await getRawPool();
    
    // 1. Fetch Order and Linked Reservation/Customer Details
    const orderRes = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT o.order_id, o.table_id, o.customer_id, o.total_amount, o.reservation_id, o.qr_session_id, o.order_note, t.table_number
        FROM dbo.Orders o
        LEFT JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
        WHERE o.order_id = @orderId
      `);
      
    if (orderRes.recordset.length === 0) {
      console.warn(`[checkoutHelper] Order #${orderId} not found in DB`);
      return;
    }
    const order = orderRes.recordset[0];
    const customerId = order.customer_id;
    const resId = order.reservation_id;
    const qrSessionId = order.qr_session_id;
    const tableId = order.table_id;
    const orderNote = order.order_note;

    // 2. Fetch Customer Info (Email, Name) & Special Notes
    let emailTo = null;
    let customerName = 'Guest';
    let preorderDeposit = 0;
    let preorderTotal = 0;
    let reservationNote = '';

    if (resId) {
      const resQuery = await pool.request()
        .input('resId', sql.Int, resId)
        .query('SELECT contact_email, contact_name, deposit_amount, final_total, special_request FROM dbo.Reservations WHERE reservation_id = @resId');
      if (resQuery.recordset.length > 0) {
        emailTo = resQuery.recordset[0].contact_email;
        customerName = resQuery.recordset[0].contact_name || 'Guest';
        preorderDeposit = resQuery.recordset[0].deposit_amount || 0;
        preorderTotal = resQuery.recordset[0].final_total || 0;
        reservationNote = resQuery.recordset[0].special_request || '';
      }
    } else if (customerId) {
      const userQuery = await pool.request()
        .input('cId', sql.Int, customerId)
        .query('SELECT email, full_name FROM dbo.UserAccounts WHERE user_id = @cId');
      if (userQuery.recordset.length > 0) {
        emailTo = userQuery.recordset[0].email;
        customerName = userQuery.recordset[0].full_name || 'Guest';
      }
    }

    const combinedNotes = [reservationNote, orderNote].filter(Boolean).join('; ');

    // 3. Award +200 Loyalty Points
    if (customerId) {
      console.log(`[checkoutHelper] Awarding +200 loyalty points to Customer #${customerId}`);
      await pool.request()
        .input('customerId', sql.Int, customerId)
        .input('orderId', sql.Int, orderId)
        .query(`
          INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, reference_id, description, created_at)
          VALUES (@customerId, 200, N'Earn', N'Payment', @orderId, N'Bonus points for successful checkout', SYSDATETIME());

          UPDATE dbo.CustomerProfiles
          SET loyalty_points = (SELECT ISNULL(SUM(points), 0) FROM dbo.LoyaltyTransactions WHERE customer_id = @customerId),
              updated_at = SYSDATETIME()
          WHERE user_id = @customerId;
        `);
    }

    // 4. Send Notification Bell Updates
    if (customerId) {
      console.log(`[checkoutHelper] Sending payment receipt notification for Customer #${customerId}`);
      await notifyCustomerStaffAction({
        customerId,
        notificationType: 'Payment Receipt',
        title: 'Payment Successful',
        message: `Your payment of ${Number(receivedAmount).toLocaleString('vi-VN')}₫ for Table ${order.table_number || 'N/A'} was successful. You earned +200 loyalty points!`,
        payload: { orderId }
      });
    }

    // 5. Query all relevant orders in this session to separate preorder vs. dining items
    if (emailTo) {
      console.log(`[checkoutHelper] Fetching items for email breakdown...`);
      const ordersQuery = await pool.request()
        .input('resId', sql.Int, resId || null)
        .input('sessionId', sql.Int, qrSessionId || null)
        .input('tableId', sql.Int, tableId)
        .query(`
          SELECT order_id, order_type 
          FROM dbo.Orders 
          WHERE (reservation_id = @resId AND @resId IS NOT NULL)
             OR qr_session_id = @sessionId
             OR (table_id = @tableId AND order_status = N'Open')
        `);

      let preordersList = [];
      let sessionOrdersList = [];

      for (const ord of ordersQuery.recordset) {
        const itemsRes = await pool.request()
          .input('ordId', sql.Int, ord.order_id)
          .query(`
            SELECT d.dish_name as name, oi.quantity as qty, oi.unit_price as price
            FROM dbo.OrderItems oi
            JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
            WHERE oi.order_id = @ordId AND oi.item_status != N'Cancelled'
          `);
        
        if (ord.order_type === 'Preorder') {
          preordersList = preordersList.concat(itemsRes.recordset);
        } else {
          sessionOrdersList = sessionOrdersList.concat(itemsRes.recordset);
        }
      }

      console.log(`[checkoutHelper] Sending receipt email to: ${emailTo}`);
      let discountAmount = 0;
      const vrQuery = await pool.request()
        .input('orderId', sql.Int, orderId)
        .query('SELECT SUM(discount_amount) as total_discount FROM dbo.VoucherRedemptions vr JOIN dbo.Payments p ON vr.payment_id = p.payment_id WHERE p.order_id = @orderId');
      if (vrQuery.recordset.length > 0) {
        discountAmount = vrQuery.recordset[0].total_discount || 0;
      }

      await sendCheckoutReceiptEmail({
        toEmail: emailTo,
        customerName: customerName,
        orderId: orderId,
        items: sessionOrdersList.concat(preordersList),
        preorders: preordersList,
        sessionOrders: sessionOrdersList,
        discountAmount: discountAmount,
        totalPaid: receivedAmount,
        tableNumber: order.table_number || 'N/A',
        dateStr: new Date().toLocaleDateString('en-US') + ' ' + new Date().toLocaleTimeString('en-US'),
        preorderDeposit,
        preorderTotal,
        notes: combinedNotes
      });
    }
  } catch (err) {
    console.error('[checkoutHelper] Error in handlePostCheckoutSuccess:', err);
  }
}
