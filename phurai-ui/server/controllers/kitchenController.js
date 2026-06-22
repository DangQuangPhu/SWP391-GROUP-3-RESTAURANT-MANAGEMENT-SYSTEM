import { getRawPool } from '../db.js';
import sql from 'mssql';

// GET /api/kitchen/queue
export const getKitchenQueue = async (req, res) => {
    let pool;
    try {
        pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT
                kt.kitchen_ticket_id,
                o.order_id,
                o.order_type,
                COALESCE(oi.snapshot_table_name, t.table_number) AS table_number,
                COALESCE(c.full_name, r.contact_name, N'Walk-in') AS guest_label,
                r.guest_count,
                d.dish_name,
                oi.quantity,
                oi.notes AS special_notes,
                kt.priority_level,
                kt.kitchen_status,
                chef.full_name AS assigned_to,
                kt.sent_at,
                DATEDIFF(MINUTE, kt.sent_at, SYSDATETIME()) AS wait_minutes
            FROM dbo.KitchenTickets kt
            JOIN dbo.OrderItems oi ON kt.order_item_id = oi.order_item_id
            JOIN dbo.Orders o ON oi.order_id = o.order_id
            JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
            JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
            LEFT JOIN dbo.Reservations r ON o.reservation_id = r.reservation_id
            LEFT JOIN dbo.UserAccounts c ON o.customer_id = c.user_id
            LEFT JOIN dbo.UserAccounts chef ON kt.assigned_to_staff_id = chef.user_id
            WHERE kt.kitchen_status IN (N'Pending', N'Preparing', N'Ready')
            ORDER BY kt.priority_level ASC, kt.sent_at ASC;
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[kitchenController] getKitchenQueue error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch kitchen queue', error: error.message });
    }
};

// Internal Service Function
export const processTicketStatusUpdate = async (pool, ticketId, new_status, triggered_by, actor_id, cancel_reason, req) => {
    const current = await pool.request()
        .input('ticketId', sql.Int, ticketId)
        .query(`
            SELECT kt.kitchen_status, o.reservation_id, o.table_id, kt.order_item_id 
            FROM dbo.KitchenTickets kt
            JOIN dbo.OrderItems oi ON kt.order_item_id = oi.order_item_id
            JOIN dbo.Orders o ON oi.order_id = o.order_id
            WHERE kt.kitchen_ticket_id = @ticketId
        `);

    if (current.recordset.length === 0) {
        throw new Error('NOT_FOUND');
    }

    const { kitchen_status: currentStatus, reservation_id: reservationId, table_id: tableId, order_item_id: orderItemId } = current.recordset[0];

    if (currentStatus === 'Cancelled') {
        throw new Error('INVALID_TRANSITION_TERMINAL');
    }

    if (new_status === 'Cancelled') {
        if (!cancel_reason || cancel_reason.trim() === '') {
            throw new Error('MISSING_CANCEL_REASON');
        }
    } else {
        // Enforce sequence: Pending -> Preparing -> Ready
        const validNext = {
            'Pending': 'Preparing',
            'Preparing': 'Ready'
        };

        if (new_status !== validNext[currentStatus]) {
            throw new Error(`INVALID_TRANSITION:${currentStatus}->${new_status}`);
        }
    }

    let timestampCol = null;

    if (new_status === 'Preparing') timestampCol = 'started_at';
    else if (new_status === 'Ready') timestampCol = 'ready_at';
    else if (new_status === 'Cancelled') timestampCol = 'cancelled_at';

    const now = new Date();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        let updateQuery = `UPDATE dbo.KitchenTickets SET kitchen_status = @status`;
        if (timestampCol) updateQuery += `, ${timestampCol} = @now`;
        // Always set assigned_to_staff_id on the first action if not set. For simplicity, just set it to actor_id if they are Preparing.
        if (new_status === 'Preparing') updateQuery += `, assigned_to_staff_id = COALESCE(assigned_to_staff_id, @actorId)`;
        updateQuery += ` WHERE kitchen_ticket_id = @ticketId`;

        const reqDb = transaction.request()
            .input('ticketId', sql.Int, ticketId)
            .input('status', sql.NVarChar(20), new_status)
            .input('now', sql.DateTime2, now)
            .input('actorId', sql.Int, actor_id);

        await reqDb.query(updateQuery);

        if (new_status === 'Cancelled') {
            await transaction.request()
                .input('orderItemId', sql.Int, orderItemId)
                .input('reason', sql.NVarChar(500), cancel_reason.trim())
                .query(`UPDATE dbo.OrderItems SET item_status = N'Cancelled', notes = CONCAT(notes, ' [Cancel Reason: ', @reason, ']') WHERE order_item_id = @orderItemId`);
        }

        const actionName = new_status === 'Cancelled' ? 'KITCHEN_CANCEL_TICKET' : 'KITCHEN_UPDATE_TICKET_STATUS';
        const detailJson = JSON.stringify({
            old_status: currentStatus,
            new_status,
            triggered_by,
            ...(new_status === 'Cancelled' ? { cancel_reason: cancel_reason.trim() } : {})
        });

        await transaction.request()
            .input('actorId', sql.Int, actor_id)
            .input('ticketId', sql.Int, ticketId)
            .input('action', sql.NVarChar(100), actionName)
            .input('detailJson', sql.NVarChar(sql.MAX), detailJson)
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, target_id, target_table, action_name, new_value_json, ip_address, created_at)
                VALUES (@actorId, @ticketId, N'KitchenTickets', @action, @detailJson, '127.0.0.1', GETDATE())
            `);

        await transaction.commit();
    } catch (txError) {
        await transaction.rollback();
        throw txError;
    }

    // Emit events
    const io = req?.app?.get('io');
    if (io) {
        if (new_status === 'Ready') {
            io.to('room:staff').emit('kitchen:dish_ready', {
                ticketId: parseInt(ticketId),
                reservationId,
                tableId,
                readyAt: now.toISOString()
            });
        } else if (new_status === 'Cancelled') {
            io.to('room:staff').emit('kitchen:dish_cancelled', {
                ticketId: parseInt(ticketId),
                reservationId,
                tableId,
                cancelReason: cancel_reason.trim()
            });
        } else if (new_status === 'Preparing') {
            io.to('room:staff').emit('kitchen:dish_preparing', {
                ticketId: parseInt(ticketId),
                reservationId,
                tableId,
                startedAt: now.toISOString()
            });
        }
    }

    return { ticketId, new_status, reservationId, tableId };
};

// PATCH /api/kitchen/tickets/:id/status
export const updateKitchenTicketStatus = async (req, res) => {
    const { id: ticketId } = req.params;
    const { new_status, triggered_by, actor_id, cancel_reason } = req.body || {};

    if (!ticketId || !/^\d+$/.test(ticketId)) {
        return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    }
    if (!new_status) {
        return res.status(400).json({ success: false, message: 'new_status is required' });
    }
    if (!triggered_by) {
        return res.status(400).json({ success: false, message: 'triggered_by is required' });
    }

    const resolvedActorId = triggered_by === 'timer_auto' ? (actor_id || null) : (actor_id || req.user?.user_id);

    try {
        const pool = await getRawPool();
        await processTicketStatusUpdate(pool, ticketId, new_status, triggered_by, resolvedActorId, cancel_reason, req);
        res.json({ success: true, message: `Ticket status updated to ${new_status}` });
    } catch (error) {
        console.error('[kitchenController] updateKitchenTicketStatus error:', error);
        if (error.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Ticket not found' });
        if (error.message === 'INVALID_TRANSITION_TERMINAL') return res.status(409).json({ success: false, message: 'Cannot update ticket from a terminal status' });
        if (error.message === 'MISSING_CANCEL_REASON') return res.status(400).json({ success: false, message: 'cancel_reason is required for cancellation' });
        if (error.message.startsWith('INVALID_TRANSITION:')) return res.status(409).json({ success: false, message: `Invalid transition: ${error.message.split(':')[1]}` });

        res.status(500).json({ success: false, message: 'Failed to update ticket status', error: error.message });
    }
};
