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
                        MERGE dbo.RestaurantSettings AS target
                        USING (SELECT @key AS setting_key, @value AS setting_value) AS src
                        ON (target.setting_key = src.setting_key)
                        WHEN MATCHED THEN
                            UPDATE SET setting_value = src.setting_value, updated_at = SYSDATETIME()
                        WHEN NOT MATCHED THEN
                            INSERT (setting_key, setting_value, updated_at)
                            VALUES (src.setting_key, src.setting_value, SYSDATETIME());
                    `);
            }
            await transaction.commit();
            const io = req.app.get('io');
            if (io) {
              io.emit('settings:updated');
            }
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
