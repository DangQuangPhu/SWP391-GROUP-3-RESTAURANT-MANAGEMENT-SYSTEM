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
                    t.table_number
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

        if (
            Number.isFinite(requestedTableId) &&
            requestedTableId > 0 &&
            Number(session.table_id) !== requestedTableId
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
            .input('tableId', sql.Int, session.table_id)
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
                .input('tableNumber', sql.NVarChar(255), String(session.table_number || session.table_id))
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
        
        // 1. Verify item exists and is not already Served
        const currentItem = await pool.request()
            .input('orderItemId', sql.Int, orderItemId)
            .query(`SELECT item_status FROM dbo.OrderItems WHERE order_item_id = @orderItemId`);

        if (currentItem.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Order item not found.' });
        }

        if (currentItem.recordset[0].item_status === 'Served') {
            return res.status(409).json({ success: false, message: 'Item is already served.' });
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
            .input('oldValue', sql.NVarChar(sql.MAX), JSON.stringify({ item_status: currentItem.recordset[0].item_status }))
            .input('newValue', sql.NVarChar(sql.MAX), JSON.stringify({ item_status: 'Served' }))
            .input('ipAddress', sql.NVarChar(45), req.ip || '127.0.0.1')
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
                VALUES (@userId, N'MARK_ITEM_SERVED', N'OrderItems', @targetId, @oldValue, @newValue, @ipAddress, SYSDATETIME())
            `);

        // Emit socket event if needed for front-of-house UI updates
        const io = getIO();
        if (io) {
            io.to('room:staff').emit('orders:item_served', {
                orderItemId: parseInt(orderItemId, 10),
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

    let pool;
    try {
        pool = await getRawPool();
    } catch (e) {
        return res.status(500).json({ success: false, message: 'DB connection failed' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        let totalAmount = 0;
        const validItems = [];

        // 1. Calculate securely from DB
        for (const item of items) {
            const dishId = resolveCartDishId(item);
            if (!Number.isFinite(dishId) || dishId <= 0) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Invalid dish in cart.' });
            }

            const result = await transaction.request()
                .input('dishId', sql.Int, dishId)
                .query(`SELECT price FROM dbo.Dishes WHERE dish_id = @dishId`);
            
            if (result.recordset.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: `Dish ID ${dishId} is invalid.` });
            }

            const unitPrice = result.recordset[0].price;
            const quantity = parseInt(item.quantity) || 1;
            totalAmount += (unitPrice * quantity);

            validItems.push({
                dish_id: dishId,
                quantity,
                unit_price: unitPrice
            });
        }

        // 2. Insert Order and use SCOPE_IDENTITY() to prevent trigger conflicts
        const orderResult = await transaction.request()
            .input('tableId', sql.Int, parsedTableId)
            .input('totalAmount', sql.Decimal(18, 2), totalAmount)
            .query(`
                INSERT INTO dbo.Orders (table_id, subtotal, total_amount, order_status, created_at, updated_at)
                VALUES (@tableId, @totalAmount, @totalAmount, N'Open', SYSDATETIME(), SYSDATETIME());
                SELECT SCOPE_IDENTITY() AS order_id;
            `);

        const orderId = orderResult.recordset[0].order_id;

        // 3. Insert OrderItems
        for (const vItem of validItems) {
            await transaction.request()
                .input('orderId', sql.Int, orderId)
                .input('dishId', sql.Int, vItem.dish_id)
                .input('quantity', sql.Int, vItem.quantity)
                .input('unitPrice', sql.Decimal(18, 2), vItem.unit_price)
                .query(`
                    INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, item_status)
                    VALUES (@orderId, @dishId, @quantity, @unitPrice, N'Pending')
                `);
        }

        await transaction.commit();

        // 4. Generate SePay QR URL dynamically
        const sepayUrl = `https://qr.sepay.vn/img?bank=TPBank&acc=00003942326&amount=${totalAmount}&des=ORD${orderId}&template=&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT`;

        return res.status(201).json({
            success: true,
            message: 'Order created successfully. Please scan the QR to pay.',
            data: {
                order_id: orderId,
                total_amount: totalAmount,
                qr_url: sepayUrl
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
