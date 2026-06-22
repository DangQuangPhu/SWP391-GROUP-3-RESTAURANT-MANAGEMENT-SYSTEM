import sql from "mssql";

export class OrderItemRepository {
  /**
   * Fetch all items for an order with exclusive lock (UPDLOCK, ROWLOCK).
   */
  static async getOrderItemsForUpdate(transaction, orderId) {
    const req = new sql.Request(transaction);
    req.input("orderId", sql.Int, orderId);
    
    const result = await req.query(`
      SELECT order_item_id, order_id, dish_id, quantity, unit_price, notes, item_status
      FROM dbo.OrderItems WITH (UPDLOCK, ROWLOCK)
      WHERE order_id = @orderId;
    `);
    
    return result.recordset;
  }

  /**
   * Transfer an entire OrderItem to a new order.
   */
  static async transferItemToOrder(transaction, orderItemId, newOrderId) {
    const req = new sql.Request(transaction);
    req.input("orderItemId", sql.Int, orderItemId);
    req.input("newOrderId", sql.Int, newOrderId);

    await req.query(`
      UPDATE dbo.OrderItems
      SET order_id = @newOrderId,
          updated_at = SYSDATETIME()
      WHERE order_item_id = @orderItemId;
    `);
  }

  /**
   * Reduce the quantity of an existing OrderItem.
   */
  static async reduceItemQuantity(transaction, orderItemId, reduceBy) {
    const req = new sql.Request(transaction);
    req.input("orderItemId", sql.Int, orderItemId);
    req.input("reduceBy", sql.SmallInt, reduceBy);

    await req.query(`
      UPDATE dbo.OrderItems
      SET quantity = quantity - @reduceBy,
          updated_at = SYSDATETIME()
      WHERE order_item_id = @orderItemId;
    `);
  }

  /**
   * Insert a new OrderItem (used when partially splitting an item).
   */
  static async insertOrderItem(transaction, newOrderId, itemToCopy, quantity) {
    const req = new sql.Request(transaction);
    req.input("newOrderId", sql.Int, newOrderId);
    req.input("dishId", sql.Int, itemToCopy.dish_id);
    req.input("quantity", sql.SmallInt, quantity);
    req.input("unitPrice", sql.Decimal(12, 2), itemToCopy.unit_price);
    req.input("notes", sql.NVarChar(255), itemToCopy.notes || null);
    req.input("itemStatus", sql.NVarChar(25), itemToCopy.item_status);

    await req.query(`
      INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
      VALUES (@newOrderId, @dishId, @quantity, @unitPrice, @notes, @itemStatus);
    `);
  }
}
