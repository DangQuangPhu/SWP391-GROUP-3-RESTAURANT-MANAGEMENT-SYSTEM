import { getRawPool } from '../db.js';
import sql from 'mssql';

/**
 * Creates an order and its corresponding order items and kitchen tickets.
 * 
 * @param {Object} payload 
 * @param {number} payload.table_id - Required. The physical table.
 * @param {number|null} payload.reservation_id - Optional.
 * @param {number|null} payload.customer_id - Optional.
 * @param {number|null} payload.created_by_staff_id - Optional.
 * @param {number|null} payload.qr_session_id - Optional.
 * @param {string} payload.order_type - Required. e.g. 'Dine In', 'Preorder', 'QR Self'
 * @param {Array<{dish_id: number, quantity: number, unit_price: number, notes: string|null}>} payload.items - Required.
 * @returns {Promise<{ orderId: number }>}
 */
export async function createOrder(payload) {
    const {
        table_id,
        reservation_id = null,
        customer_id = null,
        created_by_staff_id = null,
        qr_session_id = null,
        order_type,
        items
    } = payload;

    if (!table_id) throw new Error("table_id is required");
    if (!order_type) throw new Error("order_type is required");
    if (!items || !items.length) throw new Error("items cannot be empty");

    const pool = await getRawPool();
    const transaction = pool.transaction();
    await transaction.begin();

    try {
        // Calculate subtotal
        let subtotal = 0;
        for (const item of items) {
            subtotal += (item.quantity * item.unit_price);
        }
        let total_amount = subtotal;

        // 1. Insert Order
        const orderResult = await transaction.request()
            .input('reservation_id', sql.Int, reservation_id)
            .input('table_id', sql.SmallInt, table_id)
            .input('customer_id', sql.Int, customer_id)
            .input('created_by_staff_id', sql.Int, created_by_staff_id)
            .input('qr_session_id', sql.Int, qr_session_id)
            .input('order_type', sql.NVarChar(20), order_type)
            .input('order_status', sql.NVarChar(25), 'Open')
            .input('subtotal', sql.Decimal(12, 2), subtotal)
            .input('total_amount', sql.Decimal(12, 2), total_amount)
            .query(`
                DECLARE @OutputTbl TABLE (order_id INT);
                INSERT INTO dbo.Orders (
                    reservation_id, table_id, customer_id, created_by_staff_id,
                    qr_session_id, order_type, order_status, subtotal, total_amount, created_at, updated_at
                )
                OUTPUT INSERTED.order_id INTO @OutputTbl
                VALUES (
                    @reservation_id, @table_id, @customer_id, @created_by_staff_id,
                    @qr_session_id, @order_type, @order_status, @subtotal, @total_amount, SYSDATETIME(), SYSDATETIME()
                );
                SELECT order_id FROM @OutputTbl;
            `);

        const orderId = orderResult.recordset[0].order_id;

        // 2. Insert Order Items & Kitchen Tickets
        for (const item of items) {
            const itemResult = await transaction.request()
                .input('order_id', sql.Int, orderId)
                .input('dish_id', sql.Int, item.dish_id)
                .input('quantity', sql.SmallInt, item.quantity)
                .input('unit_price', sql.Decimal(12, 2), item.unit_price)
                .input('notes', sql.NVarChar(255), item.notes || null)
                .query(`
                    DECLARE @OutputItemTbl TABLE (order_item_id INT);
                    INSERT INTO dbo.OrderItems (
                        order_id, dish_id, quantity, unit_price, notes, item_status, created_at, updated_at
                    )
                    OUTPUT INSERTED.order_item_id INTO @OutputItemTbl
                    VALUES (
                        @order_id, @dish_id, @quantity, @unit_price, @notes, N'Pending', SYSDATETIME(), SYSDATETIME()
                    );
                    SELECT order_item_id FROM @OutputItemTbl;
                `);
            
            const orderItemId = itemResult.recordset[0].order_item_id;

            await transaction.request()
                .input('order_item_id', sql.Int, orderItemId)
                .query(`
                    INSERT INTO dbo.KitchenTickets (
                        order_item_id, kitchen_status, priority_level, sent_at
                    )
                    VALUES (
                        @order_item_id, N'Pending', 3, SYSDATETIME()
                    )
                `);
        }

        await transaction.commit();
        return { orderId };
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}
