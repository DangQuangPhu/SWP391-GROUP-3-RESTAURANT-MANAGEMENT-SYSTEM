import { getRawPool } from '../db.js';
import sql from 'mssql';



// GET /api/admin/dashboard/stats
export const getDashboardStats = async (req, res) => {
    try {
        const pool = await getRawPool();
        
        const [
            accountsRes,
            staffRes,
            auditRes,
            reservationsRes,
            revenueRes,
            reviewsRes
        ] = await Promise.all([
            pool.request().query('SELECT COUNT(*) as count FROM dbo.UserAccounts'),
            pool.request().query("SELECT COUNT(*) as count FROM dbo.StaffProfiles WHERE employment_status = 'Active'"),
            pool.request().query("SELECT COUNT(*) as count FROM dbo.AuditLogs WHERE CAST(created_at AS DATE) = CAST(SYSDATETIME() AS DATE)"),
            pool.request().query("SELECT COUNT(*) as count FROM dbo.Reservations WHERE created_at >= DATEADD(day, -30, SYSDATETIME())"),
            pool.request().query("SELECT ISNULL(SUM(amount_paid), 0) as total FROM dbo.Payments WHERE paid_at >= DATEADD(day, -30, SYSDATETIME()) AND payment_status = 'Completed'"),
            pool.request().query("SELECT COUNT(*) as count FROM dbo.CustomerReviews WHERE overall_rating <= 3")
        ]);

        const stats = {
            totalAccounts: accountsRes.recordset[0].count,
            activeStaff: staffRes.recordset[0].count,
            auditEntriesToday: auditRes.recordset[0].count,
            reservations30d: reservationsRes.recordset[0].count,
            revenue30d: revenueRes.recordset[0].total,
            pendingRoleRequests: 2, // Mock for now or adapt if table exists
            reviewsNeedingReply: reviewsRes.recordset[0].count,
            staffPerformanceFlags: 1 // Mock for now or adapt if table exists
        };

        return res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[adminController] getDashboardStats error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// GET /api/admin/audit-logs/recent
export const getRecentAuditLogs = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT TOP 5 
                a.created_at, 
                a.action_name, 
                ISNULL(u.full_name, 'Hệ thống tự động') as full_name
            FROM dbo.AuditLogs a
            LEFT JOIN dbo.UserAccounts u ON a.user_id = u.user_id
            ORDER BY a.created_at DESC
        `);

        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminController] getRecentAuditLogs error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// GET /api/admin/accounts
export const getAccounts = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT u.user_id, u.full_name, u.email, u.phone, r.role_name, u.is_active, s.job_title 
            FROM dbo.UserAccounts u 
            JOIN dbo.Roles r ON u.role_id = r.role_id 
            LEFT JOIN dbo.StaffProfiles s ON u.user_id = s.user_id 
            ORDER BY u.created_at DESC
        `);

        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminController] getAccounts error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
