/**
 * kitchenController.js
 * Kitchen Ticket State Machine — enforces Part 1.1/1.2 of the KDS Directive.
 *
 * FSM Transition Authority Table:
 *  Pending            → Sent To Kitchen  : Staff (role_id=2, user-JWT)
 *  Sent To Kitchen    → Preparing        : KDS Device (device-JWT)
 *  Preparing          → Ready            : KDS Device (device-JWT)
 *  Ready              → Served           : Staff (role_id=2, user-JWT)
 *  Pending/SentToKitchen → Cancelled    : Staff (role_id=2, free cancel)
 *  Preparing          → Cancelled        : Manager/Admin override only (role_id ∈ {4,5})
 *  Ready/Served       → Cancelled        : HARD BLOCKED (use complaint/billing flow)
 *
 * Overdue detection: is_overdue = true when status=Preparing AND > OVERDUE_THRESHOLD_MIN
 */
import { getRawPool } from '../db.js';
import sql from 'mssql';

const OVERDUE_THRESHOLD_MIN = 15; // configurable; could be loaded from RestaurantSettings

// ─────────────────────────────────────────────────────────────
// GET /api/kitchen/queue  (user JWT — staff view, no station filter)
// GET /api/kds/queue      (device JWT — filtered by device.station_category_ids)
// ─────────────────────────────────────────────────────────────
export const getKitchenQueue = async (req, res) => {
    try {
        const pool = await getRawPool();

        // Multi-station routing: device token sets req.device; absent on user-JWT calls
        const stationIds = req.device?.station_category_ids ?? null;
        // Safe inline: stationIds is parsed from trusted server JWT claim (integers only)
        const stationFilter = stationIds?.length
            ? `AND d.category_id IN (${stationIds.map(Number).filter(Number.isFinite).join(',')})`
            : '';

        const result = await pool.request().query(`
            SELECT
                kt.kitchen_ticket_id,
                kt.kitchen_status,
                kt.updated_at,
                kt.priority_level,
                kt.sent_at,
                kt.started_at,
                kt.ready_at,
                kt.cancelled_at,
                o.order_id,
                o.order_type,
                COALESCE(oi.snapshot_table_name, t.table_number) AS table_number,
                COALESCE(c.full_name, r.contact_name, N'Walk-in')  AS guest_label,
                r.guest_count,
                d.dish_name,
                d.category_id,
                mc.category_name,
                oi.quantity,
                oi.notes AS special_notes,
                chef.full_name AS assigned_to,
                -- Wait time: seconds since sent_at (server-side so all clients agree)
                DATEDIFF(SECOND, kt.sent_at, SYSDATETIME())        AS wait_time_seconds,
                -- Overdue flag: Preparing for > threshold minutes
                CASE
                    WHEN kt.kitchen_status = N'Preparing'
                     AND DATEDIFF(MINUTE, COALESCE(kt.started_at, kt.sent_at), SYSDATETIME()) > ${OVERDUE_THRESHOLD_MIN}
                    THEN 1 ELSE 0
                END                                                  AS is_overdue
            FROM dbo.KitchenTickets kt
            JOIN dbo.OrderItems oi    ON kt.order_item_id     = oi.order_item_id
            JOIN dbo.Orders o         ON oi.order_id          = o.order_id
            JOIN dbo.RestaurantTables t ON o.table_id         = t.table_id
            JOIN dbo.Dishes d         ON oi.dish_id           = d.dish_id
            LEFT JOIN dbo.MenuCategories mc ON mc.category_id = d.category_id
            LEFT JOIN dbo.Reservations r    ON o.reservation_id = r.reservation_id
            LEFT JOIN dbo.UserAccounts c    ON o.customer_id    = c.user_id
            LEFT JOIN dbo.UserAccounts chef ON kt.assigned_to_staff_id = chef.user_id
            WHERE kt.kitchen_status IN (N'Pending', N'Sent To Kitchen', N'Preparing', N'Ready')
            ${stationFilter}
            ORDER BY kt.priority_level DESC, kt.sent_at ASC, kt.kitchen_ticket_id ASC;
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[kitchenController] getKitchenQueue error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch kitchen queue', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// FSM Authority: who may request each transition?
// actor_type: 'staff' | 'kds_device' | 'manager_override'
// ─────────────────────────────────────────────────────────────
const FSM = {
    // [ currentStatus ][ requestedStatus ] → required actor type(s)
    'Pending':          { 'Sent To Kitchen': ['staff'],                   'Cancelled': ['staff'] },
    'Sent To Kitchen':  { 'Preparing':       ['kds_device'],              'Cancelled': ['staff'] },
    'Preparing':        { 'Ready':           ['kds_device'],              'Cancelled': ['manager_override'] },
    'Ready':            { 'Served':          ['staff'] /* Cancelled: BLOCKED */ },
    'Served':           { /* all transitions blocked */ },
    'Cancelled':        { /* terminal */ },
};

function resolveActorType(req) {
    if (req.device)                                    return 'kds_device';
    if (req.user?.role_id === 4 || req.user?.role_id === 5) return 'manager_override';
    if (req.user?.role_id === 2)                       return 'staff';
    return 'unknown';
}

// ─────────────────────────────────────────────────────────────
// Internal service — called by route handlers and kds.routes.js
// ─────────────────────────────────────────────────────────────
export const processTicketStatusUpdate = async (
    pool, ticketId, new_status, triggered_by, actor_id, cancel_reason, req,
    expected_updated_at = null
) => {

    const current = await pool.request()
        .input('ticketId', sql.Int, ticketId)
        .query(`
            SELECT kt.kitchen_status, kt.updated_at,
                   o.reservation_id, o.table_id, kt.order_item_id,
                   d.dish_name
            FROM dbo.KitchenTickets kt
            JOIN dbo.OrderItems oi ON kt.order_item_id = oi.order_item_id
            JOIN dbo.Orders     o  ON oi.order_id      = o.order_id
            JOIN dbo.Dishes     d  ON oi.dish_id       = d.dish_id
            WHERE kt.kitchen_ticket_id = @ticketId
        `);

    if (current.recordset.length === 0) throw new Error('NOT_FOUND');

    const { kitchen_status: currentStatus, reservation_id: reservationId,
            table_id: tableId, order_item_id: orderItemId, dish_name: dishName }
        = current.recordset[0];

    // ── Terminal state guard ───────────────────────────────────
    if (currentStatus === 'Cancelled' || currentStatus === 'Served') {
        throw new Error('INVALID_TRANSITION_TERMINAL');
    }

    // ── Hard-block Cancelled from Ready/Served ─────────────────
    if (new_status === 'Cancelled' && (currentStatus === 'Ready' || currentStatus === 'Served')) {
        throw new Error('CANCEL_BLOCKED_TERMINAL:Post-Ready cancellation requires the billing/complaint flow, not the KDS cancel endpoint.');
    }

    // ── FSM authority check ────────────────────────────────────
    const actorType = resolveActorType(req);
    const allowedActors = FSM[currentStatus]?.[new_status];

    if (!allowedActors) {
        throw new Error(`INVALID_TRANSITION:${currentStatus}->${new_status}`);
    }
    if (!allowedActors.includes(actorType)) {
        throw new Error(`UNAUTHORIZED_TRANSITION:Actor "${actorType}" cannot transition ${currentStatus}->${new_status}`);
    }

    // ── Cancellation business rules ────────────────────────────
    if (new_status === 'Cancelled') {
        if (!cancel_reason || String(cancel_reason).trim() === '') {
            throw new Error('MISSING_CANCEL_REASON');
        }
        // Preparing → Cancelled requires manager_override (already enforced above via FSM)
    }

    // ── CAS (optimistic locking) ───────────────────────────────
    const now = new Date();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        if (expected_updated_at) {
            const cas = await transaction.request()
                .input('ticketId', sql.Int, ticketId)
                .input('expectedUpdatedAt', sql.DateTime2, new Date(expected_updated_at))
                .query(`SELECT 1 FROM dbo.KitchenTickets
                        WHERE kitchen_ticket_id = @ticketId AND updated_at = @expectedUpdatedAt`);
            if (cas.recordset.length === 0) {
                await transaction.rollback();
                throw new Error('STALE_STATE');
            }
        }

        // ── Build UPDATE ───────────────────────────────────────
        const timestampMap = {
            'Sent To Kitchen': 'sent_at',
            'Preparing':       'started_at',
            'Ready':           'ready_at',
            'Served':          'ready_at',   // reuse ready_at; served_at can be added later
            'Cancelled':       'cancelled_at',
        };
        const timestampCol = timestampMap[new_status];

        let updateQuery = `UPDATE dbo.KitchenTickets SET kitchen_status = @status, updated_at = @now`;
        if (timestampCol) updateQuery += `, ${timestampCol} = @now`;
        if (new_status === 'Preparing') {
            updateQuery += `, assigned_to_staff_id = COALESCE(assigned_to_staff_id, @actorId)`;
        }
        updateQuery += ` WHERE kitchen_ticket_id = @ticketId`;

        await transaction.request()
            .input('ticketId', sql.Int, ticketId)
            .input('status',   sql.NVarChar(20), new_status)
            .input('now',      sql.DateTime2, now)
            .input('actorId',  sql.Int, actor_id ?? null)
            .query(updateQuery);

        // ── Mirror status on OrderItems ────────────────────────
        if (new_status === 'Cancelled') {
            await transaction.request()
                .input('orderItemId', sql.Int, orderItemId)
                .input('reason',      sql.NVarChar(500), cancel_reason.trim())
                .query(`UPDATE dbo.OrderItems SET item_status = N'Cancelled',
                        notes = CONCAT(COALESCE(notes,''), ' [Cancelled: ', @reason, ']')
                        WHERE order_item_id = @orderItemId`);
        } else {
            const itemStatus = new_status === 'Served' ? 'Served' : new_status;
            await transaction.request()
                .input('orderItemId', sql.Int, orderItemId)
                .input('newStatus',   sql.NVarChar(25), itemStatus)
                .query(`UPDATE dbo.OrderItems SET item_status = @newStatus WHERE order_item_id = @orderItemId`);
        }

        // ── AuditLog ───────────────────────────────────────────
        const isManagerOverride = (new_status === 'Cancelled' && actorType === 'manager_override');
        const actionName = new_status === 'Cancelled'
            ? (isManagerOverride ? 'KITCHEN_MANAGER_OVERRIDE_CANCEL' : 'KITCHEN_CANCEL_TICKET')
            : 'KITCHEN_UPDATE_TICKET_STATUS';

        const detailJson = JSON.stringify({
            old_status: currentStatus,
            new_status,
            triggered_by,
            actor_type: actorType,
            ...(actor_id ? { actor_id } : {}),
            ...(req.device ? { device_id: req.device.device_id } : {}),
            ...(new_status === 'Cancelled' ? { cancel_reason: cancel_reason.trim(), manager_override: isManagerOverride } : {}),
        });

        await transaction.request()
            .input('actorId',    sql.Int, actor_id ?? null)
            .input('ticketId',   sql.Int, ticketId)
            .input('action',     sql.NVarChar(100), actionName)
            .input('detailJson', sql.NVarChar(sql.MAX), detailJson)
            .query(`
                INSERT INTO dbo.AuditLogs
                    (user_id, target_id, target_table, action_name, new_value_json, ip_address, created_at)
                VALUES (@actorId, @ticketId, N'KitchenTickets', @action, @detailJson,
                        '127.0.0.1', SYSDATETIME())
            `);

        await transaction.commit();
    } catch (txError) {
        await transaction.rollback();
        throw txError;
    }

    // ── Socket emits (fire-and-forget after commit) ────────────
    const io = req?.app?.get('io');
    if (io) {
        if (new_status === 'Ready') {
            io.to('room:staff').emit('kitchen:dish_ready', {
                ticketId: parseInt(ticketId), reservationId, tableId, dishName,
                readyAt: now.toISOString()
            });
            io.to('room:kds').emit('kds:ticket_updated', { ticketId: parseInt(ticketId), status: new_status });
        } else if (new_status === 'Served') {
            io.to('room:kds').emit('kds:ticket_updated', { ticketId: parseInt(ticketId), status: new_status });
        } else if (new_status === 'Cancelled') {
            io.to('room:staff').emit('kitchen:dish_cancelled', {
                ticketId: parseInt(ticketId), reservationId, tableId, dishName,
                cancelReason: cancel_reason?.trim()
            });
            io.to('room:kds').emit('kds:ticket_updated', { ticketId: parseInt(ticketId), status: 'Cancelled' });
        } else if (new_status === 'Preparing') {
            io.to('room:staff').emit('kitchen:dish_preparing', {
                ticketId: parseInt(ticketId), reservationId, tableId, dishName,
                startedAt: now.toISOString()
            });
            io.to('room:kds').emit('kds:ticket_updated', { ticketId: parseInt(ticketId), status: new_status });
        } else if (new_status === 'Sent To Kitchen') {
            io.to('room:kds').emit('kds:new_ticket', { ticketId: parseInt(ticketId), tableId, dishName });
        }
    }

    return { ticketId, new_status, reservationId, tableId };
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/kitchen/tickets/:id/status  (user JWT — Staff)
// PATCH /api/kds/tickets/:id/status      (device JWT — Kitchen)
// ─────────────────────────────────────────────────────────────
export const updateKitchenTicketStatus = async (req, res) => {
    const { id: ticketId } = req.params;
    const { new_status, triggered_by, actor_id, cancel_reason, expected_updated_at } = req.body || {};

    if (!ticketId || !/^\d+$/.test(ticketId)) {
        return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    }
    if (!new_status) {
        return res.status(400).json({ success: false, message: 'new_status is required' });
    }

    const resolvedActorId = actor_id ?? req.user?.user_id ?? null;
    const resolvedTriggeredBy = triggered_by ?? (req.device ? 'kds_device' : 'staff');

    try {
        const pool = await getRawPool();
        await processTicketStatusUpdate(
            pool, ticketId, new_status, resolvedTriggeredBy,
            resolvedActorId, cancel_reason, req, expected_updated_at
        );
        return res.json({ success: true, message: `Ticket status updated to ${new_status}` });
    } catch (error) {
        console.error('[kitchenController] updateKitchenTicketStatus error:', error.message);
        if (error.message === 'NOT_FOUND')
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        if (error.message === 'STALE_STATE')
            return res.status(409).json({ success: false, code: 'STALE_STATE', message: 'Ticket was updated by another session. Refresh and retry.' });
        if (error.message === 'INVALID_TRANSITION_TERMINAL')
            return res.status(409).json({ success: false, message: 'Ticket is already in a terminal state.' });
        if (error.message === 'MISSING_CANCEL_REASON')
            return res.status(400).json({ success: false, message: 'cancel_reason is required for cancellation.' });
        if (error.message.startsWith('CANCEL_BLOCKED_TERMINAL'))
            return res.status(409).json({ success: false, code: 'CANCEL_BLOCKED', message: 'Cancellation not permitted past Ready. Use the billing/complaint flow.' });
        if (error.message.startsWith('UNAUTHORIZED_TRANSITION'))
            return res.status(403).json({ success: false, message: error.message.split(':')[1]?.trim() || 'Unauthorized transition.' });
        if (error.message.startsWith('INVALID_TRANSITION'))
            return res.status(409).json({ success: false, message: `Invalid status transition: ${error.message.split(':')[1]}` });
        return res.status(500).json({ success: false, message: 'Failed to update ticket status', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/manager/kitchen/metrics  (Manager/Admin — aggregate only)
// Returns: avg prep time, overdue count, cancellation breakdown
// ─────────────────────────────────────────────────────────────
export const getKitchenMetrics = async (req, res) => {
    try {
        const pool = await getRawPool();

        const result = await pool.request().query(`
            SELECT
                -- Avg prep time: started_at → ready_at for today's completed tickets
                AVG(CAST(DATEDIFF(SECOND, started_at, ready_at) AS FLOAT)) AS avg_prep_seconds,
                -- Count currently overdue Preparing tickets
                SUM(CASE
                    WHEN kitchen_status = N'Preparing'
                     AND DATEDIFF(MINUTE, COALESCE(started_at, sent_at), SYSDATETIME()) > ${OVERDUE_THRESHOLD_MIN}
                    THEN 1 ELSE 0
                END) AS overdue_count,
                -- Total active Preparing tickets
                SUM(CASE WHEN kitchen_status = N'Preparing' THEN 1 ELSE 0 END) AS preparing_count,
                -- Total ready waiting for staff
                SUM(CASE WHEN kitchen_status = N'Ready' THEN 1 ELSE 0 END) AS ready_count
            FROM dbo.KitchenTickets
            WHERE kitchen_status IN (N'Pending', N'Sent To Kitchen', N'Preparing', N'Ready')
              OR (kitchen_status IN (N'Ready', N'Served') AND CAST(sent_at AS DATE) = CAST(SYSDATETIME() AS DATE));
        `);

        // Cancellation breakdown from AuditLogs
        const cancelResult = await pool.request().query(`
            SELECT
                action_name,
                COUNT(*) AS count
            FROM dbo.AuditLogs
            WHERE action_name IN (N'KITCHEN_CANCEL_TICKET', N'KITCHEN_MANAGER_OVERRIDE_CANCEL')
              AND CAST(created_at AS DATE) = CAST(SYSDATETIME() AS DATE)
            GROUP BY action_name;
        `);

        const cancelBreakdown = cancelResult.recordset.reduce((acc, r) => {
            acc[r.action_name === 'KITCHEN_MANAGER_OVERRIDE_CANCEL' ? 'manager_override' : 'free_cancel'] = r.count;
            return acc;
        }, { free_cancel: 0, manager_override: 0 });

        const metrics = result.recordset[0] ?? {};
        return res.json({
            success: true,
            data: {
                avg_prep_seconds: metrics.avg_prep_seconds ? Math.round(metrics.avg_prep_seconds) : null,
                avg_prep_minutes: metrics.avg_prep_seconds ? Math.round(metrics.avg_prep_seconds / 60) : null,
                overdue_count:    metrics.overdue_count    ?? 0,
                preparing_count:  metrics.preparing_count  ?? 0,
                ready_count:      metrics.ready_count      ?? 0,
                cancellations_today: cancelBreakdown,
                overdue_threshold_min: OVERDUE_THRESHOLD_MIN,
            }
        });
    } catch (error) {
        console.error('[kitchenController] getKitchenMetrics error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch kitchen metrics.' });
    }
};
