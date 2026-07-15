import { getRawPool } from '../db.js';
import sql from 'mssql';

// GET /api/admin/audit-logs?page=1&limit=50
export const getPaginatedAuditLogs = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const offset = (page - 1) * limit;

        const pool = await getRawPool();

        // Total count (separate lightweight query)
        const countRes = await pool.request().query(
            `SELECT COUNT(*) AS total FROM dbo.AuditLogs`
        );
        const total = countRes.recordset[0].total;

        const result = await pool.request()
            .input('offset', sql.Int, offset)
            .input('limit',  sql.Int, limit)
            .query(`
                SELECT
                    a.audit_log_id,
                    a.created_at,
                    a.action_name,
                    a.target_table,
                    a.target_id,
                    a.new_value_json,
                    a.ip_address,
                    ISNULL(u.full_name, 'System Auto') AS full_name
                FROM dbo.AuditLogs a
                LEFT JOIN dbo.UserAccounts u ON a.user_id = u.user_id
                ORDER BY a.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `);

        return res.json({
            success: true,
            data: result.recordset,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('[adminAuditController] getPaginatedAuditLogs error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
