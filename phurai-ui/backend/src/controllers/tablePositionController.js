import { getRawPool } from '../db.js';
import sql from 'mssql';

export const updateTablePosition = async (req, res) => {
    try {
        const { id } = req.params;
        const { position_x, position_y } = req.body;

        if (position_x == null || position_y == null) {
            return res.status(400).json({ success: false, message: 'position_x and position_y are required.' });
        }

        const pool = await getRawPool();
        const result = await pool.request()
            .input('table_id', sql.SmallInt, id)
            .input('position_x', sql.SmallInt, position_x)
            .input('position_y', sql.SmallInt, position_y)
            .query(`
                UPDATE dbo.RestaurantTables
                SET position_x = @position_x, position_y = @position_y
                WHERE table_id = @table_id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Table not found.' });
        }

        return res.json({ success: true, message: 'Table position updated successfully.' });
    } catch (error) {
        console.error('[tablePositionController] updateTablePosition error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error updating table position.', error: error.message });
    }
};
