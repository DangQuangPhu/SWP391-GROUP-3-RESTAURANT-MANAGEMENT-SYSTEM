import { getRawPool } from '../db.js';

// GET /api/admin/roles
export const getRoles = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query('SELECT * FROM dbo.Roles ORDER BY role_id ASC');
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminRoleController] getRoles error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// PUT /api/admin/roles/:id
export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_name, description } = req.body; // Scaffolded fields

        const pool = await getRawPool();
        const result = await pool.request()
            .input('id', id)
            .input('description', description)
            .query(`
                UPDATE dbo.Roles 
                SET description = @description
                WHERE role_id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        return res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        console.error('[adminRoleController] updateRole error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
