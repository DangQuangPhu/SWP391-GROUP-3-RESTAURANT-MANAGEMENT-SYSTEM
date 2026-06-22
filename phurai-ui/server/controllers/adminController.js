import { getRawPool } from '../db.js';
import sql from 'mssql';

// GET /api/admin/audit-logs
export const getAuditLogs = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT 
                al.log_id,
                al.user_id,
                u.full_name,
                u.role_id,
                al.target_id,
                al.target_table,
                al.action_name,
                al.old_value_json,
                al.new_value_json,
                al.ip_address,
                al.created_at
            FROM dbo.AuditLogs al
            LEFT JOIN dbo.UserAccounts u ON al.user_id = u.user_id
            ORDER BY al.created_at DESC
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminController] getAuditLogs error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// GET /api/admin/settings
export const getSettings = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT setting_key, setting_value, description
            FROM dbo.RestaurantSettings
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminController] getSettings error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// PUT /api/admin/settings
export const updateSettings = async (req, res) => {
    const { settings } = req.body;
    
    if (!settings || !Array.isArray(settings)) {
        return res.status(400).json({ success: false, message: 'Invalid settings format. Expected array of objects.' });
    }

    let pool;
    try {
        pool = await getRawPool();
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Database connection failed' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        for (const item of settings) {
            if (item.setting_key && item.setting_value !== undefined) {
                await transaction.request()
                    .input('key', sql.NVarChar(100), item.setting_key)
                    .input('val', sql.NVarChar(sql.MAX), String(item.setting_value))
                    .query(`
                        UPDATE dbo.RestaurantSettings 
                        SET setting_value = @val, updated_at = GETDATE()
                        WHERE setting_key = @key
                    `);
            }
        }

        // Audit Log for Settings Update
        const adminId = req.user?.user_id;
        const newValueJson = JSON.stringify({ settings_updated: settings.length });
        
        await transaction.request()
            .input('actorId', sql.Int, adminId)
            .input('newValue', sql.NVarChar(sql.MAX), newValueJson)
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, target_table, action_name, new_value_json, ip_address, created_at)
                VALUES (@actorId, N'RestaurantSettings', N'ADMIN_UPDATE_SETTINGS', @newValue, '127.0.0.1', GETDATE())
            `);

        await transaction.commit();
        return res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        await transaction.rollback();
        console.error('[adminController] updateSettings error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
