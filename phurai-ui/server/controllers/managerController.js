import { getRawPool } from '../db.js';
import sql from 'mssql';

// POST /api/manager/orders/:id/force-settle
export const forceSettleOrder = async (req, res) => {
    const { id: orderId } = req.params;
    const { payment_method_id } = req.body;
    const actorId = req.user?.user_id;

    if (!orderId || isNaN(orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid Order ID' });
    }

    if (!payment_method_id || ![1, 2, 3].includes(parseInt(payment_method_id))) {
        return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    const methodIdInt = parseInt(payment_method_id);
    let pool;
    try {
        pool = await getRawPool();
    } catch (dbErr) {
        return res.status(500).json({ success: false, message: 'Database connection failed' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        // Optimization 1: Zero-Trust & Race Condition prevention with UPDLOCK
        const orderResult = await transaction.request()
            .input('orderId', sql.Int, orderId)
            .query(`SELECT order_status, total_amount, table_id FROM dbo.Orders WITH (UPDLOCK) WHERE order_id = @orderId`);

        if (orderResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const currentOrder = orderResult.recordset[0];
        const currentStatusFromDB = currentOrder.order_status;
        const totalAmount = currentOrder.total_amount;
        const tableId = currentOrder.table_id;

        if (currentStatusFromDB === 'Paid') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Order is already paid.' });
        }

        // 1. Update Order status
        await transaction.request()
            .input('orderId', sql.Int, orderId)
            .input('totalAmount', sql.Decimal(18, 2), totalAmount)
            .query(`UPDATE dbo.Orders SET order_status = N'Paid', amount_paid = @totalAmount WHERE order_id = @orderId`);

        // 2. Update Table status
        if (tableId) {
            await transaction.request()
                .input('tableId', sql.Int, tableId)
                .query(`UPDATE dbo.RestaurantTables SET table_status = N'Cleaning' WHERE table_id = @tableId`);
        }

        // 3. Insert Payment
        await transaction.request()
            .input('orderId', sql.Int, orderId)
            .input('amount', sql.Decimal(18, 2), totalAmount)
            .input('methodId', sql.Int, methodIdInt)
            .input('staffId', sql.Int, actorId)
            .query(`
                INSERT INTO dbo.Payments (order_id, amount_paid, change_given, payment_status, processed_by_staff_id, payment_method_id)
                VALUES (@orderId, @amount, 0, N'Completed', @staffId, @methodId)
            `);

        // 4. Insert Audit Log (Optimization 2)
        const oldValueJson = JSON.stringify({ order_status: currentStatusFromDB });
        const newValueJson = JSON.stringify({
            order_status: "Paid",
            payment_method_id: methodIdInt,
            action: "Manual Force Settle by Manager"
        });

        await transaction.request()
            .input('actorId', sql.Int, actorId)
            .input('targetId', sql.Int, orderId)
            .input('oldValue', sql.NVarChar(sql.MAX), oldValueJson)
            .input('newValue', sql.NVarChar(sql.MAX), newValueJson)
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, target_id, target_table, action_name, old_value_json, new_value_json, ip_address, created_at)
                VALUES (@actorId, @targetId, N'Orders', N'MANAGER_FORCE_SETTLE', @oldValue, @newValue, '127.0.0.1', GETDATE())
            `);

        await transaction.commit();

        // Emit Socket Events (Optimization 4: The "Magic" Customer UI Sync)
        const io = req.app?.get('io');
        if (io) {
            io.to(`order_${orderId}`).emit('PAYMENT_STATUS_CHANGED', { orderId, status: 'Paid' });
            io.to('room:staff').emit('ORDER_FORCE_SETTLED', { orderId, status: 'Paid', tableId });
        }

        return res.json({ success: true, message: 'Order forcefully settled successfully.', data: { orderId, status: 'Paid' } });
    } catch (error) {
        await transaction.rollback();
        console.error('[managerController] forceSettleOrder error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error during force settle.', error: error.message });
    }
};

export const getAreas = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query('SELECT * FROM dbo.RestaurantAreas WHERE is_active = 1');
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[managerController] getAreas error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error fetching areas.' });
    }
};

export const getFilteredTables = async (req, res) => {
    try {
        const { search, area_id, statuses } = req.query;
        let query = `
            SELECT t.*, a.area_name 
            FROM dbo.RestaurantTables t
            LEFT JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
            WHERE a.is_active = 1
        `;
        const pool = await getRawPool();
        const request = pool.request();

        if (search) {
            query += ` AND t.table_number LIKE '%' + @search + '%'`;
            request.input('search', sql.NVarChar, search);
        }
        if (area_id) {
            query += ` AND t.area_id = @areaId`;
            request.input('areaId', sql.Int, area_id);
        }
        if (statuses) {
            // Note: simple split for IN clause. Proper implementation needs parameterization.
            const statusArray = statuses.split(',').map(s => s.trim().replace(/'/g, "''"));
            if (statusArray.length > 0) {
                query += ` AND t.table_status IN (${statusArray.map(s => `'${s}'`).join(',')})`;
            }
        }

        const result = await request.query(query);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[managerController] getFilteredTables error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error fetching filtered tables.' });
    }
};

export {
    getPendingReservations,
    getAllReservations,
    getReservationDetails,
    getReservationHistory,
    confirmReservation,
    rejectReservation,
    cancelReservation,
    updateReservation,
    resolveEditRequest,
    seedTestReservations,
    clearTestReservations
} from './managerReservationController.js';

export const getShifts = (req, res) => res.status(200).json({ success: true, data: [] });
export const getSchedules = (req, res) => res.status(200).json({ success: true, data: [] });
export const assignSchedule = (req, res) => res.status(200).json({ success: true, data: {} });
export const updateScheduleAttendance = (req, res) => res.status(200).json({ success: true, data: {} });

export const getShiftMapping = (req, res) => res.status(200).json({ success: true, data: {} });
export const updateShiftMapping = (req, res) => res.status(200).json({ success: true, data: {} });

export const createTable = (req, res) => res.status(200).json({ success: true, data: {} });
export const getNextTableNumber = (req, res) => res.status(200).json({ success: true, data: {} });
export const mergeTables = (req, res) => res.status(200).json({ success: true, data: {} });
export const unmergeTable = (req, res) => res.status(200).json({ success: true, data: {} });
export const getTableTimeline = (req, res) => res.status(200).json({ success: true, data: {} });
export const updateTable = (req, res) => res.status(200).json({ success: true, data: {} });
export const deleteTable = (req, res) => res.status(200).json({ success: true, data: {} });
