import sql from 'mssql';
import { getRawPool } from '../db.js';

export async function getOrderById(orderId) {
  const pool = await getRawPool();
  const result = await pool.request()
    .input('order_id', sql.Int, orderId)
    .query('SELECT order_id, total_amount, order_status FROM dbo.Orders WHERE order_id = @order_id');
  return result.recordset[0];
}

export async function getOrderByTxnRef(txnRef) {
  const pool = await getRawPool();
  const result = await pool.request()
    .input('txn_ref', sql.NVarChar, txnRef)
    .query('SELECT order_id, total_amount, order_status FROM dbo.Orders WHERE vnp_txn_ref = @txn_ref');
  return result.recordset[0];
}

export async function updateOrderTxnRef(orderId, txnRef) {
  const pool = await getRawPool();
  await pool.request()
    .input('order_id', sql.Int, orderId)
    .input('txn_ref', sql.NVarChar, txnRef)
    .query('UPDATE dbo.Orders SET vnp_txn_ref = @txn_ref WHERE order_id = @order_id');
}

export async function getReservationById(reservationId) {
  const pool = await getRawPool();
  const result = await pool.request()
    .input('reservation_id', sql.Int, reservationId)
    .query('SELECT reservation_id, reservation_status FROM dbo.Reservations WHERE reservation_id = @reservation_id');
  return result.recordset[0];
}

export async function updateReservationTxnRef(reservationId, txnRef) {
  const pool = await getRawPool();
  await pool.request()
    .input('reservation_id', sql.Int, reservationId)
    .input('txn_ref', sql.NVarChar, txnRef)
    .query('UPDATE dbo.Reservations SET vnp_txn_ref = @txn_ref WHERE reservation_id = @reservation_id');
}

export async function markOrderPaymentFailed(orderId, txnRef) {
  const pool = await getRawPool();
  await pool.request()
    .input('order_id', sql.Int, orderId)
    .query("UPDATE dbo.Orders SET order_status = 'PaymentFailed' WHERE order_id = @order_id");
}

export async function transaction(cb) {
  const pool = await getRawPool();
  const trx = new sql.Transaction(pool);
  await trx.begin();
  try {
    const trxHelpers = {
      setOrderPaid: async (orderId) => {
        const result = await new sql.Request(trx)
          .input('order_id', sql.Int, orderId)
          .query(`UPDATE dbo.Orders WITH (UPDLOCK, ROWLOCK)
                  SET order_status = 'Paid'
                  WHERE order_id = @order_id AND order_status != 'Paid'`);
        if (result.rowsAffected[0] === 0) {
          throw new Error('ALREADY_PAID');
        }
        
        // When pre-order is paid, the reservation is confirmed
        await new sql.Request(trx)
          .input('order_id', sql.Int, orderId)
          .query(`UPDATE r
                  SET r.reservation_status = N'Await Check-in'
                  FROM dbo.Reservations r
                  INNER JOIN dbo.Orders o ON r.reservation_id = o.reservation_id
                  WHERE o.order_id = @order_id
                    AND r.reservation_status = N'Pending Request'`);
      },
      completePayment: async ({ order_id, amount, vnp_txn_ref }) => {
        const result = await new sql.Request(trx)
          .input('order_id', sql.Int, order_id)
          .input('amount', sql.Decimal(12, 2), amount)
          .input('vnp_txn_ref', sql.NVarChar, vnp_txn_ref)
          .query(`UPDATE dbo.Payments WITH (UPDLOCK, ROWLOCK)
                  SET payment_status = N'Completed',
                      transaction_ref = @vnp_txn_ref,
                      paid_at = GETDATE(),
                      updated_at = GETDATE()
                  WHERE order_id = @order_id AND payment_status = N'Pending'`);
                  
        // Fallback: If no pending payment exists (e.g. from an older flow), insert a new one
        if (result.rowsAffected[0] === 0) {
           await new sql.Request(trx)
             .input('order_id', sql.Int, order_id)
             .input('amount', sql.Decimal(12, 2), amount)
             .input('vnp_txn_ref', sql.NVarChar, vnp_txn_ref)
             .query(`INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, payment_status, transaction_ref, paid_at)
                     VALUES (@order_id, (SELECT TOP 1 payment_method_id FROM dbo.PaymentMethods WHERE method_name = 'VNPAY'), @amount, N'Completed', @vnp_txn_ref, GETDATE())`);
        }
      }
    };
    await cb(trxHelpers);
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    if (err.message === 'ALREADY_PAID') return { alreadyPaid: true };
    throw err;
  }
}

export async function verifyAndClearTableTransaction({ parentTableId, staffId }) {
  const pool = await getRawPool();
  const trx = new sql.Transaction(pool);
  await trx.begin();
  try {
    const childTables = await new sql.Request(trx)
      .input('parent_id', sql.Int, parentTableId)
      .query(`SELECT table_id FROM dbo.RestaurantTables WITH (UPDLOCK, ROWLOCK)
              WHERE merged_into_table_id = @parent_id OR table_id = @parent_id`);

    const allTableIds = childTables.recordset.map((r) => r.table_id);
    
    if (allTableIds.length === 0) {
        await trx.commit();
        return { clearedTableIds: [] };
    }

    await new sql.Request(trx)
      .query(`UPDATE dbo.RestaurantTables SET table_status = 'Cleaning'
              WHERE table_id IN (${allTableIds.join(',')})`);

    await new sql.Request(trx)
      .input('parent_id', sql.Int, parentTableId)
      .query(`UPDATE dbo.RestaurantTables SET merged_into_table_id = NULL
              WHERE merged_into_table_id = @parent_id`);

    if (staffId) {
        await new sql.Request(trx)
          .input('staff_id', sql.Int, staffId)
          .input('parent_id', sql.Int, parentTableId)
          .query(`INSERT INTO dbo.AuditLogs (action_name, entity_name, entity_id, user_id, details)
                  VALUES ('STAFF_VERIFY_CLEAR_TABLE', 'RestaurantTables', @parent_id, @staff_id, 'Table cleared and unmerged.')`);
    }

    await new sql.Request(trx)
      .input('parent_id', sql.Int, parentTableId)
      .query(`INSERT INTO dbo.AuditLogs (action_name, entity_name, entity_id, user_id, details)
              VALUES ('SYSTEM_AUTO_UNMERGE_ON_CLEAR', 'RestaurantTables', @parent_id, NULL, 'Table auto unmerged upon clear.')`);

    await trx.commit();
    return { clearedTableIds: allTableIds };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}
