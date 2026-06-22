import { getRawPool } from '../db.js';

// GET /api/admin/settings
export const getSettings = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query('SELECT setting_key, setting_value, description FROM dbo.RestaurantSettings');
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminSettingsController] getSettings error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// PUT /api/admin/settings
export const updateSettings = async (req, res) => {
    try {
        const settings = req.body; // Expecting an array of { setting_key, setting_value } or object
        
        if (!Array.isArray(settings)) {
            return res.status(400).json({ success: false, message: 'Invalid input format. Expected array.' });
        }

        const pool = await getRawPool();
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            for (const { setting_key, setting_value } of settings) {
                await transaction.request()
                    .input('key', setting_key)
                    .input('value', setting_value)
                    .query(`
                        UPDATE dbo.RestaurantSettings 
                        SET setting_value = @value, updated_at = SYSDATETIME()
                        WHERE setting_key = @key
                    `);
            }
            await transaction.commit();
            return res.json({ success: true, message: 'Settings updated successfully' });
        } catch (txnError) {
            await transaction.rollback();
            throw txnError;
        }
    } catch (error) {
        console.error('[adminSettingsController] updateSettings error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
