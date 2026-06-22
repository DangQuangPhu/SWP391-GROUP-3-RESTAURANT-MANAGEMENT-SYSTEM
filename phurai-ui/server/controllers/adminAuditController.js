import { getRawPool } from '../db.js';

// GET /api/admin/audit-logs
export const getPaginatedAuditLogs = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT a.audit_log_id, a.created_at, a.action_name, u.full_name, a.ip_address 
            FROM dbo.AuditLogs a 
            LEFT JOIN dbo.UserAccounts u ON a.user_id = u.user_id 
            ORDER BY a.created_at DESC
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminAuditController] getPaginatedAuditLogs error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
