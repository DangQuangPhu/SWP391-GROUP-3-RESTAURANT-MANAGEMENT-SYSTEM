/**
 * areaController.js
 * UC-M04 — Manager CRUD for Restaurant Areas
 *
 * listAreas already exists in tableController.js (GET /api/manager/areas).
 * This controller adds: createArea, updateArea, deactivateArea.
 */

import { getRawPool } from '../db.js';
import sql from 'mssql';

/**
 * POST /api/manager/areas
 * Body: { area_name, description? }
 * Creates a new restaurant area.
 */
export const createArea = async (req, res) => {
    const { area_name, description } = req.body;

    if (!area_name || String(area_name).trim() === '') {
        return res.status(400).json({ success: false, message: 'area_name is required.' });
    }

    const name = String(area_name).trim();

    try {
        const pool = await getRawPool();

        // Duplicate check
        const dupCheck = await pool.request()
            .input('areaName', sql.NVarChar(100), name)
            .query('SELECT area_id FROM dbo.RestaurantAreas WHERE area_name = @areaName AND is_active = 1');

        if (dupCheck.recordset.length > 0) {
            return res.status(409).json({ success: false, message: `Area "${name}" already exists.` });
        }

        const result = await pool.request()
            .input('areaName', sql.NVarChar(100), name)
            .input('description', sql.NVarChar(500), description ? String(description).trim() : null)
            .query(`
                INSERT INTO dbo.RestaurantAreas (area_name, description, is_active, created_at, updated_at)
                OUTPUT INSERTED.area_id, INSERTED.area_name, INSERTED.description, INSERTED.is_active
                VALUES (@areaName, @description, 1, SYSDATETIME(), SYSDATETIME())
            `);

        const io = req.app?.get('io');
        if (io) {
            io.to('room:manager').to('room:staff').emit('areas:updated', { action: 'create' });
        }

        return res.status(201).json({
            success: true,
            message: 'Area created successfully.',
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('[areaController] createArea error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create area.', error: error.message });
    }
};

/**
 * PATCH /api/manager/areas/:id
 * Body: { area_name?, description? }
 * Updates area name/description.
 */
export const updateArea = async (req, res) => {
    const areaId = Number(req.params.id);
    const { area_name, description } = req.body;

    if (!Number.isFinite(areaId) || areaId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid area id.' });
    }
    if (!area_name || String(area_name).trim() === '') {
        return res.status(400).json({ success: false, message: 'area_name is required.' });
    }

    const name = String(area_name).trim();

    try {
        const pool = await getRawPool();

        // Duplicate check (excluding self)
        const dupCheck = await pool.request()
            .input('areaName', sql.NVarChar(100), name)
            .input('areaId', sql.SmallInt, areaId)
            .query('SELECT area_id FROM dbo.RestaurantAreas WHERE area_name = @areaName AND area_id != @areaId AND is_active = 1');

        if (dupCheck.recordset.length > 0) {
            return res.status(409).json({ success: false, message: `Another area named "${name}" already exists.` });
        }

        const result = await pool.request()
            .input('areaId', sql.SmallInt, areaId)
            .input('areaName', sql.NVarChar(100), name)
            .input('description', sql.NVarChar(500), description ? String(description).trim() : null)
            .query(`
                UPDATE dbo.RestaurantAreas
                SET area_name = @areaName,
                    description = @description,
                    updated_at = SYSDATETIME()
                WHERE area_id = @areaId
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Area not found.' });
        }

        const io = req.app?.get('io');
        if (io) {
            io.to('room:manager').to('room:staff').emit('areas:updated', { action: 'update', area_id: areaId });
        }

        return res.json({ success: true, message: 'Area updated successfully.' });
    } catch (error) {
        console.error('[areaController] updateArea error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update area.', error: error.message });
    }
};

/**
 * DELETE /api/manager/areas/:id
 * Soft-deletes area (sets is_active = 0).
 * Hard-delete is rejected if the area has active tables.
 */
export const deactivateArea = async (req, res) => {
    const areaId = Number(req.params.id);

    if (!Number.isFinite(areaId) || areaId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid area id.' });
    }

    try {
        const pool = await getRawPool();

        // Check for active (non-Inactive) tables in this area
        const tableCheck = await pool.request()
            .input('areaId', sql.SmallInt, areaId)
            .query(`
                SELECT COUNT(*) AS active_table_count
                FROM dbo.RestaurantTables
                WHERE area_id = @areaId AND table_status != N'Inactive'
            `);

        const activeCount = tableCheck.recordset[0].active_table_count;
        if (activeCount > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot deactivate area: it has ${activeCount} active table(s). Mark all tables as Inactive first.`
            });
        }

        const result = await pool.request()
            .input('areaId', sql.SmallInt, areaId)
            .query(`
                UPDATE dbo.RestaurantAreas
                SET is_active = 0, updated_at = SYSDATETIME()
                WHERE area_id = @areaId
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Area not found.' });
        }

        const io = req.app?.get('io');
        if (io) {
            io.to('room:manager').to('room:staff').emit('areas:updated', { action: 'deactivate', area_id: areaId });
        }

        return res.json({ success: true, message: 'Area deactivated successfully.' });
    } catch (error) {
        console.error('[areaController] deactivateArea error:', error);
        return res.status(500).json({ success: false, message: 'Failed to deactivate area.', error: error.message });
    }
};
