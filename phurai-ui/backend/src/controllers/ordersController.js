import { getRawPool } from '../db.js';
import sql from 'mssql';
import { getIO } from '../socket.js';

function resolveCartDishId(item = {}) {
    return Number(item.dish_id ?? item.menu_item_id ?? item.id);
}

async function checkoutQrDineInOrder(req, res) {
    const sessionId = Number(req.body.session_id ?? req.body.sessionId);
    const requestedTableId = Number(req.body.table_id ?? req.body.tableId);
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!Number.isFinite(sessionId) || sessionId <= 0) {
        return res.status(400).json({ success: false, message: 'session_id is required.' });
    }
    if (!items.length) {
        return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const pool = await getRawPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const sessionResult = await transaction.request()
            .input('sessionId', sql.Int, sessionId)
            .query(`
                SELECT TOP 1
                    qs.qr_session_id,
                    qs.table_id,
                    qs.customer_id,
                    qs.session_status,
                    t.table_number,
                    t.merged_into_table_id
                FROM dbo.QROrderSessions qs WITH (UPDLOCK)
                INNER JOIN dbo.RestaurantTables t ON t.table_id = qs.table_id
                WHERE qs.qr_session_id = @sessionId
                  AND qs.session_status = N'Active'
            `);

        const session = sessionResult.recordset[0];
        if (!session) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: 'QR session is not active.' });
        }
        
        let targetTableId = session.table_id;
        let targetTableNumber = session.table_number;
        
        if (session.merged_into_table_id) {
            const parentRes = await transaction.request()
                .input('parentId', sql.Int, session.merged_into_table_id)
                .query(`SELECT table_number FROM dbo.RestaurantTables WHERE table_id = @parentId`);
            if (parentRes.recordset.length > 0) {
                targetTableId = session.merged_into_table_id;
                targetTableNumber = parentRes.recordset[0].table_number + ' (Merged from ' + targetTableNumber + ')';
            }
        }

        if (
            Number.isFinite(requestedTableId) &&
            requestedTableId > 0 &&
            Number(session.table_id) !== requestedTableId &&
            Number(targetTableId) !== requestedTableId
        ) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Table does not match QR session.' });
        }

        let subtotal = 0;
        const validItems = [];

        for (const item of items) {
            const dishId = resolveCartDishId(item);
            const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
            const notes = String(item.notes || '').trim() || null;

            if (!Number.isFinite(dishId) || dishId <= 0) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Invalid dish in cart.' });
            }

            const dishResult = await transaction.request()
                .input('dishId', sql.Int, dishId)
                .query(`
                    SELECT TOP 1 dish_id, dish_name, price, is_available
                    FROM dbo.Dishes
                    WHERE dish_id = @dishId
                `);

            const dish = dishResult.recordset[0];
            if (!dish) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: `Dish ID ${dishId} is invalid.` });
            }
            if (dish.is_available === false || dish.is_available === 0) {
                await transaction.rollback();
                return res.status(409).json({ success: false, message: `${dish.dish_name} is currently unavailable.` });
            }

            const unitPrice = Number(dish.price) || 0;
            subtotal += unitPrice * quantity;
            validItems.push({
                dish_id: dishId,
                dish_name: dish.dish_name,
                quantity,
                unit_price: unitPrice,
                notes,
            });
        }

        const orderResult = await transaction.request()
            .input('tableId', sql.Int, targetTableId)
            .input('customerId', sql.Int, session.customer_id || null)
            .input('sessionId', sql.Int, sessionId)
            .input('subtotal', sql.Decimal(12, 2), subtotal)
            .query(`
                INSERT INTO dbo.Orders
                    (table_id, customer_id, qr_session_id, order_type, order_status, subtotal, total_amount, created_at, updated_at)
                OUTPUT INSERTED.order_id
                VALUES
                    (@tableId, @customerId, @sessionId, N'QR Self', N'Sent To Kitchen', @subtotal, @subtotal, SYSDATETIME(), SYSDATETIME())
            `);

        const orderId = orderResult.recordset[0]?.order_id;
        const createdItems = [];

        for (const item of validItems) {
            const itemResult = await transaction.request()
                .input('orderId', sql.Int, orderId)
                .input('dishId', sql.Int, item.dish_id)
                .input('quantity', sql.Int, item.quantity)
                .input('unitPrice', sql.Decimal(12, 2), item.unit_price)
                .input('notes', sql.NVarChar(500), item.notes)
                .input('tableNumber', sql.NVarChar(255), String(targetTableNumber || targetTableId))
                .query(`
                    INSERT INTO dbo.OrderItems
                        (order_id, dish_id, quantity, unit_price, notes, snapshot_table_name, item_status)
                    OUTPUT INSERTED.order_item_id
                    VALUES
                        (@orderId, @dishId, @quantity, @unitPrice, @notes, @tableNumber, N'Pending')
                `);

            const orderItemId = itemResult.recordset[0]?.order_item_id;

            const ticketResult = await transaction.request()
                .input('orderItemId', sql.Int, orderItemId)
                .query(`
                    INSERT INTO dbo.KitchenTickets
                        (order_item_id, kitchen_status, priority_level, sent_at)
                    OUTPUT INSERTED.kitchen_ticket_id
                    VALUES
                        (@orderItemId, N'Pending', 3, SYSDATETIME())
                `);

            createdItems.push({
                ...item,
                order_item_id: orderItemId,
                kitchen_ticket_id: ticketResult.recordset[0]?.kitchen_ticket_id,
            });
        }

        await transaction.commit();

        const payload = {
            order_id: orderId,
            table_id: Number(session.table_id),
            table_number: session.table_number,
            session_id: sessionId,
            item_count: createdItems.reduce((sum, item) => sum + item.quantity, 0),
            items: createdItems,
        };

        const io = req.app?.get?.('io') || getIO();
        if (io) {
            io.emit('NEW_KITCHEN_ORDER', payload);
            io.to('room:kitchen').emit('NEW_KITCHEN_ORDER', payload);
            io.to('room:kitchen').emit('kitchen:new_preorder', payload);
            io.to('room:kitchen').emit('kitchen:new_ticket', payload);
            console.log("🌍 [SOCKET EMIT] NEW_KITCHEN_ORDER sent to Kitchen!", payload);
        }

        return res.status(201).json({
            success: true,
            message: 'Order sent to kitchen!',
            data: payload,
        });
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (rollbackError) {
            console.error('[ordersController] QR checkout rollback failed:', rollbackError);
        }
        console.error('[ordersController] checkoutQrDineInOrder error:', error);
        return res.status(500).json({ success: false, message: 'Failed to send order to kitchen.', error: error.message });
    }
}

// PATCH /api/orders/items/:orderItemId/served
export const markItemServed = async (req, res) => {
    const { orderItemId } = req.params;
    const staffUserId = req.user?.user_id || req.body.actor_id || req.userId;

    try {
        const pool = await getRawPool();
        
        // 1. Verify item exists and enforce transition: only Ready → Served is allowed
        const currentItem = await pool.request()
            .input('orderItemId', sql.Int, orderItemId)
            .query(`
                SELECT oi.item_status, oi.order_id, oi.dish_id, kt.kitchen_ticket_id, kt.kitchen_status
                FROM dbo.OrderItems oi
                LEFT JOIN dbo.KitchenTickets kt ON kt.order_item_id = oi.order_item_id
                WHERE oi.order_item_id = @orderItemId
            `);

        if (currentItem.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Order item not found.' });
        }

        const { item_status, kitchen_status } = currentItem.recordset[0];

        if (item_status === 'Served') {
            return res.status(409).json({ success: false, message: 'Item is already served.' });
        }

        if (item_status === 'Cancelled') {
            return res.status(409).json({ success: false, message: 'Cannot serve a cancelled item.' });
        }

        // Enforce valid transition: must be Ready (from Kitchen) before marking Served
        // Allow override if kitchen_status is Ready or if no ticket (walk-in without KDS)
        const allowedFromStatuses = ['Ready', 'Pending', 'Preparing']; // staff can mark served once kitchen marks ready
        if (kitchen_status && kitchen_status !== 'Ready' && kitchen_status !== 'Cancelled') {
            // Only block if kitchen ticket exists and is not Ready
            if (!['Ready'].includes(kitchen_status)) {
                return res.status(409).json({
                    success: false,
                    message: `Cannot mark as served yet. Kitchen status is "${kitchen_status}". Wait for kitchen to mark it Ready.`
                });
            }
        }

        // 2. Update item status to Served
        await pool.request()
            .input('orderItemId', sql.Int, orderItemId)
            .query(`
                UPDATE dbo.OrderItems
                SET item_status = N'Served',
                    updated_at = SYSDATETIME()
                WHERE order_item_id = @orderItemId
            `);

        // 3. Log audit action
        await pool.request()
            .input('userId', sql.Int, staffUserId)
            .input('targetId', sql.Int, orderItemId)
            .input('oldValue', sql.NVarChar(sql.MAX), JSON.stringify({ item_status }))
            .input('newValue', sql.NVarChar(sql.MAX), JSON.stringify({ item_status: 'Served' }))
            .input('ipAddress', sql.NVarChar(45), req.ip || '127.0.0.1')
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
                VALUES (@userId, N'MARK_ITEM_SERVED', N'OrderItems', @targetId, @oldValue, @newValue, @ipAddress, SYSDATETIME())
            `);

        // 4. Emit socket event
        const io = getIO();
        if (io) {
            io.to('room:staff').emit('orders:item_served', {
                orderItemId: parseInt(orderItemId, 10),
                previousStatus: item_status,
                servedAt: new Date().toISOString()
            });
        }

        res.json({ success: true, message: 'Item marked as served successfully.' });
    } catch (error) {
        console.error('[ordersController] markItemServed error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark item as served.', error: error.message });
    }
};

// POST /api/orders/checkout
export const checkoutOrder = async (req, res) => {
    const { table_id, items } = req.body;

    if (req.body?.session_id || req.body?.sessionId) {
        return checkoutQrDineInOrder(req, res);
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const parsedTableId = Number(table_id);
    if (!Number.isFinite(parsedTableId) || parsedTableId <= 0) {
        return res.status(400).json({ success: false, message: 'table_id is required for checkout.' });
    }

    // Validate quantity > 0 for all items upfront
    for (const item of items) {
        const qty = parseInt(item.quantity) || 0;
        if (qty <= 0) {
            return res.status(400).json({ success: false, message: 'All item quantities must be greater than 0.' });
        }
    }

    let pool;
    try {
        pool = await getRawPool();
    } catch (e) {
        return res.status(500).json({ success: false, message: 'DB connection failed' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        // Validate table exists and is Occupied or Reserved
        const tableCheck = await transaction.request()
            .input('tableId', sql.Int, parsedTableId)
            .query(`SELECT table_id, table_status, table_number, merged_into_table_id FROM dbo.RestaurantTables WHERE table_id = @tableId`);

        if (tableCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Table not found.' });
        }
        let targetTableId = tableCheck.recordset[0].table_id;
        let tableStatus = tableCheck.recordset[0].table_status;
        let tableNumber = tableCheck.recordset[0].table_number;
        
        if (tableCheck.recordset[0].merged_into_table_id) {
            const parentRes = await transaction.request()
                .input('parentId', sql.Int, tableCheck.recordset[0].merged_into_table_id)
                .query(`SELECT table_status, table_number FROM dbo.RestaurantTables WHERE table_id = @parentId`);
            if (parentRes.recordset.length > 0) {
                targetTableId = tableCheck.recordset[0].merged_into_table_id;
                tableStatus = parentRes.recordset[0].table_status;
                tableNumber = parentRes.recordset[0].table_number + ' (Merged from ' + tableNumber + ')';
            }
        }

        if (!['Occupied', 'Reserved'].includes(tableStatus)) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: `Table is currently "${tableStatus}". Can only create orders for Occupied or Reserved tables.`
            });
        }

        let totalAmount = 0;
        const validItems = [];

        // Validate dishes and calculate total
        for (const item of items) {
            const dishId = resolveCartDishId(item);
            if (!Number.isFinite(dishId) || dishId <= 0) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Invalid dish in cart.' });
            }

            const result = await transaction.request()
                .input('dishId', sql.Int, dishId)
                .query(`SELECT dish_id, dish_name, price, is_available FROM dbo.Dishes WHERE dish_id = @dishId`);
            
            if (result.recordset.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: `Dish ID ${dishId} is invalid.` });
            }

            const dish = result.recordset[0];
            if (dish.is_available === false || dish.is_available === 0) {
                await transaction.rollback();
                return res.status(409).json({ success: false, message: `"${dish.dish_name}" is currently unavailable.` });
            }

            const unitPrice = Number(dish.price) || 0;
            const quantity = parseInt(item.quantity) || 1;
            const notes = String(item.notes || '').trim() || null;
            totalAmount += unitPrice * quantity;

            validItems.push({ dish_id: dishId, dish_name: dish.dish_name, quantity, unit_price: unitPrice, notes });
        }

        // Insert Order
        const orderResult = await transaction.request()
            .input('tableId', sql.Int, targetTableId)
            .input('customerId', sql.Int, req.user?.user_id || null)
            .input('subtotal', sql.Decimal(18, 2), totalAmount)
            .input('totalAmount', sql.Decimal(18, 2), totalAmount)
            .query(`
                INSERT INTO dbo.Orders (table_id, customer_id, subtotal, total_amount, order_status, order_type, created_at, updated_at)
                OUTPUT INSERTED.order_id
                VALUES (@tableId, @customerId, @subtotal, @totalAmount, N'Sent To Kitchen', N'Dine-In', SYSDATETIME(), SYSDATETIME())
            `);

        const orderId = orderResult.recordset[0].order_id;
        const createdItems = [];

        // Insert OrderItems + KitchenTickets (with idempotency check)
        for (const vItem of validItems) {
            const itemResult = await transaction.request()
                .input('orderId', sql.Int, orderId)
                .input('dishId', sql.Int, vItem.dish_id)
                .input('quantity', sql.Int, vItem.quantity)
                .input('unitPrice', sql.Decimal(18, 2), vItem.unit_price)
                .input('notes', sql.NVarChar(500), vItem.notes)
                .input('tableNumber', sql.NVarChar(255), tableNumber)
                .query(`
                    INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, snapshot_table_name, item_status)
                    OUTPUT INSERTED.order_item_id
                    VALUES (@orderId, @dishId, @quantity, @unitPrice, @notes, @tableNumber, N'Pending')
                `);

            const orderItemId = itemResult.recordset[0].order_item_id;

            // Idempotency: skip if ticket already exists for this order_item_id
            const existingTicket = await transaction.request()
                .input('orderItemId', sql.Int, orderItemId)
                .query(`SELECT kitchen_ticket_id FROM dbo.KitchenTickets WHERE order_item_id = @orderItemId`);

            let kitchenTicketId = null;
            if (existingTicket.recordset.length === 0) {
                const ticketResult = await transaction.request()
                    .input('orderItemId', sql.Int, orderItemId)
                    .query(`
                        INSERT INTO dbo.KitchenTickets (order_item_id, kitchen_status, priority_level, sent_at)
                        OUTPUT INSERTED.kitchen_ticket_id
                        VALUES (@orderItemId, N'Pending', 3, SYSDATETIME())
                    `);
                kitchenTicketId = ticketResult.recordset[0].kitchen_ticket_id;
            } else {
                kitchenTicketId = existingTicket.recordset[0].kitchen_ticket_id;
            }

            createdItems.push({ ...vItem, order_item_id: orderItemId, kitchen_ticket_id: kitchenTicketId });
        }

        await transaction.commit();

        const payload = {
            order_id: orderId,
            table_id: parsedTableId,
            table_number: tableNumber,
            item_count: createdItems.reduce((sum, i) => sum + i.quantity, 0),
            items: createdItems,
        };

        // Emit socket events for Kitchen and Staff dashboards
        const io = req.app?.get?.('io') || getIO();
        if (io) {
            io.to('room:kitchen').emit('kitchen:new_ticket', payload);
            io.to('room:kitchen').emit('NEW_KITCHEN_ORDER', payload);
            io.to('room:staff').emit('orders:new_order', payload);
        }

        // Generate SePay QR URL for payment
        const sepayUrl = `https://qr.sepay.vn/img?bank=TPBank&acc=00003942326&amount=${totalAmount}&des=DH${orderId}&template=&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT`;

        return res.status(201).json({
            success: true,
            message: 'Order sent to kitchen.',
            data: {
                order_id: orderId,
                total_amount: totalAmount,
                qr_url: sepayUrl,
                items: createdItems
            }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('[ordersController] checkoutOrder error:', error);
        return res.status(500).json({ success: false, message: 'Server error during checkout' });
    }
};

// POST /api/orders/:orderId/apply-voucher
export const applyVoucher = async (req, res) => {
    const { orderId } = req.params;
    const { voucherCode } = req.body;
    const staffUserId = req.user?.user_id || req.body.actor_id || req.userId || null;

    if (!voucherCode || !orderId) {
        return res.status(400).json({ success: false, message: 'Missing orderId or voucherCode' });
    }

    let pool;
    try {
        pool = await getRawPool();
    } catch (e) {
        return res.status(500).json({ success: false, message: 'DB connection failed' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        // Step 1: Select & Lock Order, Voucher, Promotion
        const orderRes = await transaction.request()
            .input('orderId', sql.Int, orderId)
            .query(`SELECT subtotal, service_charge, discount_amount, order_status FROM dbo.Orders WITH (UPDLOCK) WHERE order_id = @orderId`);
        
        if (orderRes.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const order = orderRes.recordset[0];
        
        if (order.order_status === 'Paid' || order.order_status === 'Cancelled') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: `Cannot apply voucher to ${order.order_status} order.` });
        }

        if (order.discount_amount > 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Order already has a discount applied.' });
        }

        const promoRes = await transaction.request()
            .input('voucherCode', sql.NVarChar(50), voucherCode.trim().toUpperCase())
            .query(`
                SELECT 
                    v.voucher_id, v.voucher_code, v.times_used, v.usage_limit, v.is_active as voucher_active,
                    p.promotion_id, p.is_active as promo_active, p.start_at, p.end_at, 
                    p.min_order_value, p.discount_type, p.discount_value, p.max_discount_amount
                FROM dbo.Vouchers v WITH (UPDLOCK)
                JOIN dbo.Promotions p ON v.promotion_id = p.promotion_id
                WHERE v.voucher_code = @voucherCode
            `);
            
        if (promoRes.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Voucher not found' });
        }
        const promo = promoRes.recordset[0];

        // Validations
        if (!promo.voucher_active || !promo.promo_active) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Voucher is no longer active' });
        }
        
        const now = new Date();
        if (promo.start_at && new Date(promo.start_at) > now) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Voucher is not yet valid' });
        }
        
        if (promo.end_at && new Date(promo.end_at) < now) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Voucher has expired' });
        }
        
        if (Number(order.subtotal) < Number(promo.min_order_value)) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: `Order subtotal must be at least ₫${promo.min_order_value}` });
        }
        
        if (promo.usage_limit !== null && promo.times_used >= promo.usage_limit) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Voucher usage limit exceeded' });
        }

        // Step 2: Math
        let discount = 0;
        const discountType = String(promo.discount_type).toUpperCase();
        if (discountType === 'FIXED') {
            discount = Number(promo.discount_value);
        } else if (discountType === 'PERCENT') {
            discount = Number(order.subtotal) * (Number(promo.discount_value) / 100);
            if (promo.max_discount_amount && discount > Number(promo.max_discount_amount)) {
                discount = Number(promo.max_discount_amount);
            }
        }
        
        const subtotal = Number(order.subtotal) || 0;
        const serviceCharge = Number(order.service_charge) || 0;
        const newTotalAmount = subtotal - discount + serviceCharge;

        // Step 3: Immediate Deduction
        await transaction.request()
            .input('voucherId', sql.Int, promo.voucher_id)
            .query(`UPDATE dbo.Vouchers SET times_used = times_used + 1, updated_at = SYSDATETIME() WHERE voucher_id = @voucherId`);

        // Step 4: Update Order
        await transaction.request()
            .input('orderId', sql.Int, orderId)
            .input('discount', sql.Decimal(12,2), discount)
            .input('newTotal', sql.Decimal(12,2), newTotalAmount)
            .query(`
                UPDATE dbo.Orders 
                SET discount_amount = @discount, total_amount = @newTotal, updated_at = SYSDATETIME()
                WHERE order_id = @orderId
            `);

        // Step 5: Audit Log
        await transaction.request()
            .input('userId', sql.Int, staffUserId)
            .input('targetId', sql.Int, orderId)
            .input('newValue', sql.NVarChar(sql.MAX), JSON.stringify({ voucher_code: promo.voucher_code, discount_amount: discount }))
            .input('ipAddress', sql.NVarChar(45), req.ip || '127.0.0.1')
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, ip_address, created_at)
                VALUES (@userId, N'APPLY_VOUCHER', N'Orders', @targetId, @newValue, @ipAddress, SYSDATETIME())
            `);

        await transaction.commit();
        
        return res.status(200).json({
            success: true,
            message: 'Voucher applied successfully',
            data: { discount_amount: discount, total_amount: newTotalAmount }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('[ordersController] applyVoucher error:', error);
        return res.status(500).json({ success: false, message: 'Failed to apply voucher', error: error.message });
    }
};

// POST /api/payments/cash
// Handles cash payment: accepts amount_paid, computes change, marks order Paid.
export const processCashPayment = async (req, res) => {
    const { order_id, amount_paid } = req.body;
    const staffUserId = req.user?.user_id || null;

    const parsedOrderId = Number(order_id);
    const parsedAmountPaid = Number(amount_paid);

    if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
        return res.status(400).json({ success: false, message: 'order_id is required.' });
    }
    if (!Number.isFinite(parsedAmountPaid) || parsedAmountPaid <= 0) {
        return res.status(400).json({ success: false, message: 'amount_paid must be greater than 0.' });
    }

    let pool;
    try {
        pool = await getRawPool();
    } catch (e) {
        return res.status(500).json({ success: false, message: 'DB connection failed' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        // 1. Fetch order and lock it
        const orderRes = await transaction.request()
            .input('orderId', sql.Int, parsedOrderId)
            .query(`
                SELECT order_id, order_status, total_amount, amount_paid AS already_paid,
                       table_id, qr_session_id, reservation_id, customer_id
                FROM dbo.Orders WITH (UPDLOCK)
                WHERE order_id = @orderId
            `);

        if (orderRes.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const order = orderRes.recordset[0];

        if (order.order_status === 'Paid') {
            await transaction.rollback();
            return res.status(409).json({ success: false, message: 'Order is already paid.' });
        }
        if (order.order_status === 'Cancelled') {
            await transaction.rollback();
            return res.status(409).json({ success: false, message: 'Cannot pay for a cancelled order.' });
        }

        const totalDue = Number(order.total_amount) - Number(order.already_paid || 0);

        if (parsedAmountPaid < totalDue - 0.009) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Insufficient amount. Total due: ${totalDue.toLocaleString('vi-VN')}₫. Received: ${parsedAmountPaid.toLocaleString('vi-VN')}₫.`,
                data: { total_due: totalDue, amount_received: parsedAmountPaid }
            });
        }

        const changeGiven = Math.max(0, parsedAmountPaid - totalDue);

        // 2. Insert Payment record (method_id 1 = Cash)
        await transaction.request()
            .input('orderId', sql.Int, parsedOrderId)
            .input('amountPaid', sql.Decimal(12, 2), parsedAmountPaid)
            .input('changeGiven', sql.Decimal(12, 2), changeGiven)
            .query(`
                INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at, updated_at)
                VALUES (@orderId, 1, @amountPaid, @changeGiven, N'Completed', SYSDATETIME(), SYSDATETIME(), SYSDATETIME())
            `);

        // 3. Mark Order as Paid
        await transaction.request()
            .input('orderId', sql.Int, parsedOrderId)
            .input('amountPaid', sql.Decimal(12, 2), parsedAmountPaid)
            .query(`
                UPDATE dbo.Orders
                SET order_status = N'Paid', amount_paid = ISNULL(amount_paid, 0) + @amountPaid, updated_at = SYSDATETIME()
                WHERE order_id = @orderId
            `);

        // 4. Update table to Cleaning
        if (order.table_id) {
            await transaction.request()
                .input('tableId', sql.SmallInt, order.table_id)
                .query(`UPDATE dbo.RestaurantTables SET table_status = N'Cleaning', updated_at = SYSDATETIME() WHERE table_id = @tableId`);
        }

        // 5. Close QR session if exists
        if (order.qr_session_id) {
            await transaction.request()
                .input('sessionId', sql.Int, order.qr_session_id)
                .query(`UPDATE dbo.QROrderSessions SET session_status = N'Closed', closed_at = SYSDATETIME() WHERE qr_session_id = @sessionId`);
        }

        // 6. Complete reservation if linked
        if (order.reservation_id) {
            await transaction.request()
                .input('resId', sql.Int, order.reservation_id)
                .query(`
                    UPDATE dbo.Reservations
                    SET reservation_status = N'Completed', updated_at = SYSDATETIME()
                    WHERE reservation_id = @resId;

                    INSERT INTO dbo.ReservationTimelines (reservation_id, status_from, status_to, note, created_at)
                    VALUES (@resId, N'Dining', N'Completed', N'Cash payment completed by staff', SYSDATETIME())
                `);
        }

        // 7. Audit log
        await transaction.request()
            .input('userId', sql.Int, staffUserId)
            .input('orderId', sql.Int, parsedOrderId)
            .input('newValue', sql.NVarChar(sql.MAX), JSON.stringify({ method: 'Cash', amount_paid: parsedAmountPaid, change_given: changeGiven }))
            .input('ip', sql.NVarChar(45), req.ip || '127.0.0.1')
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, ip_address, created_at)
                VALUES (@userId, N'CASH_PAYMENT_COMPLETED', N'Orders', @orderId, @newValue, @ip, SYSDATETIME())
            `);

        await transaction.commit();

        // 8. Emit socket events
        const io = req.app?.get?.('io') || getIO();
        if (io) {
            const payload = { orderId: parsedOrderId, order_id: parsedOrderId, status: 'Paid', table_id: order.table_id, payment_method: 'Cash' };
            io.emit('PAYMENT_STATUS_CHANGED', payload);
            io.to('room:staff').to('room:manager').emit('table:status_changed', { tableId: order.table_id, status: 'Cleaning' });
            io.to('room:kitchen').emit('kds:clear_order', { orderId: parsedOrderId });
        }

        return res.json({
            success: true,
            message: 'Cash payment processed successfully.',
            data: {
                order_id: parsedOrderId,
                total_due: totalDue,
                amount_paid: parsedAmountPaid,
                change_given: changeGiven
            }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('[ordersController] processCashPayment error:', error);
        return res.status(500).json({ success: false, message: 'Failed to process cash payment.', error: error.message });
    }
};
