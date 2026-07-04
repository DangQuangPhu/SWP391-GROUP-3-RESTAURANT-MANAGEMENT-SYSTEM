/**
 * tableRequestController.js
 * UC-S09 — Handle Customer Requests (walk-in requests, cancel-item, extra notes)
 *
 * Storage strategy: uses dbo.AuditLogs with action_name patterns:
 *   TABLE_REQUEST_OPEN   — a new request
 *   TABLE_REQUEST_CLOSED — resolved by staff
 *
 * target_table = 'TableRequests' (logical, not a physical DB table)
 * target_id    = the order_item_id (for cancel_item) or table_id (for call_staff / extra_note)
 * new_value_json = { request_type, table_id, order_id, notes, status }
 *
 * This approach stores all data without schema migration, keeps an audit trail,
 * and is queryable by action_name + target_table.
 */

import { getRawPool } from '../db.js';
import sql from 'mssql';
import { getIO } from '../socket.js';

const VALID_REQUEST_TYPES = ['call_staff', 'cancel_item', 'extra_note'];

/**
 * POST /api/staff/table-requests
 * Body: { table_id, order_id?, order_item_id?, request_type, notes? }
 * Auth: Staff or Customer (via QR session)
 */
export const createTableRequest = async (req, res) => {
    const { table_id, order_id, order_item_id, request_type, notes } = req.body;
    const actorId = req.user?.user_id || null;

    if (!table_id) {
        return res.status(400).json({ success: false, message: 'table_id is required.' });
    }
    if (!request_type || !VALID_REQUEST_TYPES.includes(request_type)) {
        return res.status(400).json({
            success: false,
            message: `request_type must be one of: ${VALID_REQUEST_TYPES.join(', ')}.`
        });
    }
    if (request_type === 'cancel_item' && !order_item_id) {
        return res.status(400).json({ success: false, message: 'order_item_id is required for cancel_item requests.' });
    }

    const pool = await getRawPool();

    // For cancel_item: check kitchen_status is still Pending before creating the request
    if (request_type === 'cancel_item' && order_item_id) {
        const ticketCheck = await pool.request()
            .input('orderItemId', sql.Int, Number(order_item_id))
            .query(`
                SELECT kt.kitchen_status, oi.item_status
                FROM dbo.OrderItems oi
                LEFT JOIN dbo.KitchenTickets kt ON kt.order_item_id = oi.order_item_id
                WHERE oi.order_item_id = @orderItemId
            `);

        if (ticketCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Order item not found.' });
        }

        const { kitchen_status, item_status } = ticketCheck.recordset[0];

        if (item_status === 'Served' || item_status === 'Cancelled') {
            return res.status(409).json({
                success: false,
                message: `Cannot cancel item with status "${item_status}".`
            });
        }

        if (kitchen_status && !['Pending'].includes(kitchen_status)) {
            return res.status(409).json({
                success: false,
                message: `Cannot cancel item: kitchen has already started preparation (status: "${kitchen_status}"). Please ask staff directly.`
            });
        }
    }

    const requestData = {
        request_type,
        table_id: Number(table_id),
        order_id: order_id ? Number(order_id) : null,
        order_item_id: order_item_id ? Number(order_item_id) : null,
        notes: String(notes || '').trim() || null,
        status: 'open'
    };

    // Determine target_id: for cancel_item use order_item_id; otherwise use table_id
    const targetId = request_type === 'cancel_item' && order_item_id
        ? Number(order_item_id)
        : Number(table_id);

    const result = await pool.request()
        .input('userId', sql.Int, actorId)
        .input('targetId', sql.Int, targetId)
        .input('newValue', sql.NVarChar(sql.MAX), JSON.stringify(requestData))
        .input('ip', sql.NVarChar(45), req.ip || '127.0.0.1')
        .query(`
            INSERT INTO dbo.AuditLogs
                (user_id, action_name, target_table, target_id, new_value_json, ip_address, created_at)
            OUTPUT INSERTED.log_id
            VALUES
                (@userId, N'TABLE_REQUEST_OPEN', N'TableRequests', @targetId, @newValue, @ip, SYSDATETIME())
        `);

    const logId = result.recordset[0].log_id;

    // Emit socket event so staff dashboards show incoming request
    const io = req.app?.get('io') || getIO();
    if (io) {
        io.to('room:staff').emit('staff:new_request', {
            log_id: logId,
            request_type,
            table_id: Number(table_id),
            order_id: order_id ? Number(order_id) : null,
            order_item_id: order_item_id ? Number(order_item_id) : null,
            notes: requestData.notes,
            created_at: new Date().toISOString()
        });
    }

    return res.status(201).json({
        success: true,
        message: 'Request submitted.',
        data: { log_id: logId, ...requestData }
    });
};

/**
 * GET /api/staff/table-requests?status=open&table_id=
 * Auth: Staff, Manager, Admin
 */
export const listTableRequests = async (req, res) => {
    const { status = 'open', table_id } = req.query;

    const pool = await getRawPool();

    // Open requests are TABLE_REQUEST_OPEN log entries that do NOT have
    // a corresponding TABLE_REQUEST_CLOSED entry for the same log_id (stored in old_value_json).
    let query;
    if (status === 'open') {
        query = `
            SELECT al.log_id, al.user_id, al.target_id, al.new_value_json, al.ip_address, al.created_at,
                   ua.full_name AS requested_by
            FROM dbo.AuditLogs al
            LEFT JOIN dbo.UserAccounts ua ON ua.user_id = al.user_id
            WHERE al.action_name = N'TABLE_REQUEST_OPEN'
              AND al.target_table = N'TableRequests'
              AND NOT EXISTS (
                  SELECT 1 FROM dbo.AuditLogs closed_al
                  WHERE closed_al.action_name = N'TABLE_REQUEST_CLOSED'
                    AND closed_al.target_table = N'TableRequests'
                    AND JSON_VALUE(closed_al.old_value_json, '$.original_log_id') = CAST(al.log_id AS NVARCHAR)
              )
            ORDER BY al.created_at DESC
        `;
    } else {
        // All requests (open + closed)
        query = `
            SELECT al.log_id, al.user_id, al.target_id, al.new_value_json, al.ip_address, al.created_at,
                   ua.full_name AS requested_by
            FROM dbo.AuditLogs al
            LEFT JOIN dbo.UserAccounts ua ON ua.user_id = al.user_id
            WHERE al.action_name IN (N'TABLE_REQUEST_OPEN', N'TABLE_REQUEST_CLOSED')
              AND al.target_table = N'TableRequests'
            ORDER BY al.created_at DESC
        `;
    }

    const result = await pool.request().query(query);

    const requests = result.recordset.map(row => {
        let data = {};
        try { data = JSON.parse(row.new_value_json); } catch { /* ignore */ }
        return {
            log_id: row.log_id,
            requested_by: row.requested_by || 'Guest',
            target_id: row.target_id,
            created_at: row.created_at,
            ...data
        };
    });

    // Filter by table_id if requested
    const filtered = table_id
        ? requests.filter(r => r.table_id === Number(table_id))
        : requests;

    return res.json({ success: true, data: filtered });
};

/**
 * PATCH /api/staff/table-requests/:logId/resolve
 * Body: { resolution_notes? }
 * Auth: Staff, Manager, Admin
 */
export const resolveTableRequest = async (req, res) => {
    const { logId } = req.params;
    const { resolution_notes } = req.body;
    const staffUserId = req.user?.user_id || null;

    const pool = await getRawPool();

    // Verify the original request exists
    const original = await pool.request()
        .input('logId', sql.Int, Number(logId))
        .query(`
            SELECT log_id, new_value_json, action_name
            FROM dbo.AuditLogs
            WHERE log_id = @logId
              AND action_name = N'TABLE_REQUEST_OPEN'
              AND target_table = N'TableRequests'
        `);

    if (original.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'Request not found or already resolved.' });
    }

    let originalData = {};
    try { originalData = JSON.parse(original.recordset[0].new_value_json); } catch { /* ignore */ }

    // Write the resolved record (old_value_json links back to the original log_id)
    await pool.request()
        .input('userId', sql.Int, staffUserId)
        .input('targetId', sql.Int, original.recordset[0].log_id) // reuse the original log_id as targetId
        .input('oldValue', sql.NVarChar(sql.MAX), JSON.stringify({ original_log_id: logId, ...originalData }))
        .input('newValue', sql.NVarChar(sql.MAX), JSON.stringify({ resolution_notes: resolution_notes || null, resolved_by: staffUserId, status: 'resolved' }))
        .input('ip', sql.NVarChar(45), req.ip || '127.0.0.1')
        .query(`
            INSERT INTO dbo.AuditLogs
                (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
            VALUES
                (@userId, N'TABLE_REQUEST_CLOSED', N'TableRequests', @targetId, @oldValue, @newValue, @ip, SYSDATETIME())
        `);

    // Emit socket event
    const io = req.app?.get('io') || getIO();
    if (io) {
        io.to('room:staff').emit('staff:request_resolved', {
            log_id: Number(logId),
            resolved_by: staffUserId,
            resolution_notes: resolution_notes || null
        });
    }

    return res.json({ success: true, message: 'Request resolved.' });
};

/**
 * POST /api/staff/table-requests/cancel-item
 * Body: { order_item_id, cancel_reason }
 * Auth: Staff, Manager, Admin
 *
 * Hard-cancels an OrderItem + its KitchenTicket if kitchen_status is still Pending.
 * Enforced server-side: Preparing/Ready items cannot be cancelled through this endpoint.
 */
export const cancelOrderItem = async (req, res) => {
    const { order_item_id, cancel_reason } = req.body;
    const staffUserId = req.user?.user_id || null;

    if (!order_item_id) {
        return res.status(400).json({ success: false, message: 'order_item_id is required.' });
    }
    if (!cancel_reason || String(cancel_reason).trim() === '') {
        return res.status(400).json({ success: false, message: 'cancel_reason is required.' });
    }

    const pool = await getRawPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        // Lock and fetch the item
        const itemRes = await transaction.request()
            .input('orderItemId', sql.Int, Number(order_item_id))
            .query(`
                SELECT oi.order_item_id, oi.item_status, oi.order_id,
                       kt.kitchen_ticket_id, kt.kitchen_status
                FROM dbo.OrderItems oi WITH (UPDLOCK)
                LEFT JOIN dbo.KitchenTickets kt ON kt.order_item_id = oi.order_item_id
                WHERE oi.order_item_id = @orderItemId
            `);

        if (itemRes.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Order item not found.' });
        }

        const { item_status, kitchen_status, kitchen_ticket_id } = itemRes.recordset[0];

        if (item_status === 'Cancelled') {
            await transaction.rollback();
            return res.status(409).json({ success: false, message: 'Item is already cancelled.' });
        }
        if (item_status === 'Served') {
            await transaction.rollback();
            return res.status(409).json({ success: false, message: 'Cannot cancel an already-served item.' });
        }

        // Enforce: only Pending kitchen tickets can be cancelled through this automated path
        if (kitchen_status && !['Pending', null].includes(kitchen_status)) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: `Cannot cancel: kitchen has already started preparation (status: "${kitchen_status}"). Use the kitchen cancellation endpoint or resolve manually.`
            });
        }

        const reason = String(cancel_reason).trim();

        // Cancel the OrderItem
        await transaction.request()
            .input('orderItemId', sql.Int, Number(order_item_id))
            .input('reason', sql.NVarChar(500), reason)
            .query(`
                UPDATE dbo.OrderItems
                SET item_status = N'Cancelled',
                    notes = CONCAT(ISNULL(notes, ''), ' [Cancelled: ', @reason, ']'),
                    updated_at = SYSDATETIME()
                WHERE order_item_id = @orderItemId
            `);

        // Cancel the KitchenTicket if it exists and is Pending
        if (kitchen_ticket_id && kitchen_status === 'Pending') {
            await transaction.request()
                .input('ticketId', sql.Int, kitchen_ticket_id)
                .query(`
                    UPDATE dbo.KitchenTickets
                    SET kitchen_status = N'Cancelled',
                        cancelled_at = SYSDATETIME()
                    WHERE kitchen_ticket_id = @ticketId
                `);
        }

        // Audit log
        await transaction.request()
            .input('userId', sql.Int, staffUserId)
            .input('targetId', sql.Int, Number(order_item_id))
            .input('newValue', sql.NVarChar(sql.MAX), JSON.stringify({ item_status: 'Cancelled', cancel_reason: reason }))
            .input('ip', sql.NVarChar(45), req.ip || '127.0.0.1')
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, ip_address, created_at)
                VALUES (@userId, N'STAFF_CANCEL_ORDER_ITEM', N'OrderItems', @targetId, @newValue, @ip, SYSDATETIME())
            `);

        await transaction.commit();

        // Emit socket events
        const io = req.app?.get('io') || getIO();
        if (io) {
            io.to('room:kitchen').emit('kitchen:item_cancelled', {
                order_item_id: Number(order_item_id),
                kitchen_ticket_id,
                cancel_reason: reason
            });
            io.to('room:staff').emit('orders:item_cancelled', {
                order_item_id: Number(order_item_id),
                cancel_reason: reason
            });
        }

        return res.json({
            success: true,
            message: 'Order item cancelled successfully.',
            data: { order_item_id: Number(order_item_id), cancel_reason: reason }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('[tableRequestController] cancelOrderItem error:', error);
        return res.status(500).json({ success: false, message: 'Failed to cancel item.', error: error.message });
    }
};
