import { getIO } from "../socket.js";

/**
 * Automates data flow from PreorderItems to KDS.
 * To be called WITHIN an existing SQL transaction (e.g., during check-in).
 * 
 * @param {string|number} reservationId 
 * @param {Object} connection The SQL transaction connection wrapper
 * @param {string|number} staffUserId 
 * @returns {Promise<number|null>} Returns the orderId if created, or null if skipped.
 */
export async function processPreordersToKds(reservationId, connection, staffUserId) {
    // 1. Idempotency Check: Prevent Duplicate Orders
    const [existingOrder] = await connection.query(
        `SELECT TOP 1 order_id FROM dbo.Orders WHERE reservation_id = ? AND order_type = N'Preorder'`,
        [reservationId]
    );

    if (existingOrder && existingOrder.length > 0) {
        return null; // Already processed
    }

    // 2. Fetch PreorderItems
    const [items] = await connection.query(
        `SELECT dish_id, quantity, unit_price, notes
         FROM dbo.PreorderItems
         WHERE reservation_id = ?`,
        [reservationId]
    );

    if (!items || items.length === 0) {
        return null; // No preorders to process
    }

    // 3. Fetch Table Assigned to Reservation
    const [resRows] = await connection.query(
        `SELECT TOP 1 rt.table_id, r.customer_id 
         FROM dbo.Reservations r
         LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
         WHERE r.reservation_id = ?`,
        [reservationId]
    );

    const tableId = resRows?.[0]?.table_id || null;
    const customerId = resRows?.[0]?.customer_id || null;

    // We allow preorders to be sent even if table is unassigned yet. 
    // Staff can assign the table later.
    // if (!tableId) {
    //     throw new Error("Cannot send preorders to kitchen: No table assigned to this reservation.");
    // }

    // 4. Calculate Total
    let totalAmount = 0;
    for (const item of items) {
        totalAmount += (item.quantity * (item.unit_price || 0));
    }

    // 5. Insert Order
    const [orderInsert] = await connection.query(
        `DECLARE @OutputTbl TABLE (order_id INT);
         INSERT INTO dbo.Orders (
             reservation_id, table_id, customer_id, created_by_staff_id,
             order_type, order_status, subtotal, total_amount, created_at, updated_at
         )
         OUTPUT INSERTED.order_id INTO @OutputTbl
         VALUES (
             ?, ?, ?, ?,
             N'Preorder', N'Open', ?, ?, SYSDATETIME(), SYSDATETIME()
         );
         SELECT order_id FROM @OutputTbl;`,
        [reservationId, tableId, customerId, staffUserId, totalAmount, totalAmount]
    );

    const orderId = orderInsert[0].order_id;
    let itemCount = 0;

    // 6. Insert OrderItems & KitchenTickets
    for (const item of items) {
        itemCount++;
        const [itemInsert] = await connection.query(
            `DECLARE @OutputItemTbl TABLE (order_item_id INT);
             INSERT INTO dbo.OrderItems (
                 order_id, dish_id, quantity, unit_price, notes, item_status, created_at, updated_at
             )
             OUTPUT INSERTED.order_item_id INTO @OutputItemTbl
             VALUES (
                 ?, ?, ?, ?, ?, N'Pending', SYSDATETIME(), SYSDATETIME()
             );
             SELECT order_item_id FROM @OutputItemTbl;`,
            [orderId, item.dish_id, item.quantity, item.unit_price || 0, item.notes || null]
        );

        const orderItemId = itemInsert[0].order_item_id;

        await connection.query(
            `INSERT INTO dbo.KitchenTickets (
                 order_item_id, kitchen_status, priority_level, sent_at
             )
             VALUES (
                 ?, N'Pending', 3, SYSDATETIME()
             )`,
            [orderItemId]
        );
    }

    // 7. Audit Log
    await connection.query(
        `INSERT INTO dbo.AuditLogs (user_id, target_id, target_table, action_name, new_value_json, created_at)
         VALUES (?, ?, N'Reservations', N'System Auto Send Cooking Queue', ?, SYSDATETIME())`,
        [staffUserId, reservationId, JSON.stringify({ order_id: orderId, queued_items: itemCount, auto_triggered_by: 'Check-in' })]
    );

    return { orderId, itemCount };
}
