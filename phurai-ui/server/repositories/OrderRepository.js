import sql from "mssql";
import { getRawPool } from "../db.js";

export class OrderRepository {
  /**
   * Fetch order with exclusive lock (UPDLOCK, ROWLOCK).
   * Used for splitting to prevent race conditions.
   */
  static async getOrderForUpdate(transaction, orderId) {
    const req = new sql.Request(transaction);
    req.input("orderId", sql.Int, orderId);
    
    const result = await req.query(`
      SELECT order_id, reservation_id, table_id, customer_id, created_by_staff_id, 
             qr_session_id, order_type, order_status, order_note, 
             subtotal, discount_amount, service_charge, total_amount
      FROM dbo.Orders WITH (UPDLOCK, ROWLOCK)
      WHERE order_id = @orderId;
    `);
    
    return result.recordset[0];
  }

  /**
   * Create a new child order by copying parent order info.
   */
  static async createChildOrder(transaction, parentOrder) {
    const req = new sql.Request(transaction);
    req.input("reservationId", sql.Int, parentOrder.reservation_id);
    req.input("tableId", sql.SmallInt, parentOrder.table_id);
    req.input("customerId", sql.Int, parentOrder.customer_id);
    req.input("staffId", sql.Int, parentOrder.created_by_staff_id);
    req.input("qrSessionId", sql.Int, parentOrder.qr_session_id);
    req.input("orderType", sql.NVarChar(20), parentOrder.order_type);
    req.input("orderStatus", sql.NVarChar(25), parentOrder.order_status);
    req.input("parentOrderId", sql.Int, parentOrder.order_id);

    // Amounts are initially 0, will be updated later
    const result = await req.query(`
      INSERT INTO dbo.Orders (
        reservation_id, table_id, customer_id, created_by_staff_id, qr_session_id,
        order_type, order_status, parent_order_id, subtotal, discount_amount, service_charge, total_amount
      )
      OUTPUT INSERTED.order_id
      VALUES (
        @reservationId, @tableId, @customerId, @staffId, @qrSessionId,
        @orderType, @orderStatus, @parentOrderId, 0, 0, 0, 0
      );
    `);

    return result.recordset[0].order_id;
  }

  /**
   * Update totals for an order.
   */
  static async updateOrderTotals(transaction, orderId, subtotal, discountAmount, serviceCharge, totalAmount) {
    const req = new sql.Request(transaction);
    req.input("orderId", sql.Int, orderId);
    req.input("subtotal", sql.Decimal(12, 2), subtotal);
    req.input("discount", sql.Decimal(12, 2), discountAmount);
    req.input("service", sql.Decimal(12, 2), serviceCharge);
    req.input("total", sql.Decimal(12, 2), totalAmount);

    await req.query(`
      UPDATE dbo.Orders
      SET subtotal = @subtotal,
          discount_amount = @discount,
          service_charge = @service,
          total_amount = @total,
          updated_at = SYSDATETIME()
      WHERE order_id = @orderId;
    `);
  }
}
