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
                ISNULL(u.full_name, 'System') as full_name
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
            SELECT 
                u.user_id,
                s.staff_id,
                s.staff_code,
                COALESCE(u.full_name, s.full_name) AS full_name,
                COALESCE(u.email, s.email) AS email,
                COALESCE(u.phone, s.phone) AS phone,
                u.role_id,
                r.role_name,
                u.is_active,
                u.last_login_at,
                s.job_title,
                s.job_title_id,
                s.has_system_account,
                CASE WHEN u.role_id = 1 THEN 'customer' ELSE 'staff' END AS account_type,
                u.created_at
            FROM dbo.UserAccounts u
            LEFT JOIN dbo.Roles r ON u.role_id = r.role_id
            LEFT JOIN dbo.StaffProfiles s ON u.user_id = s.user_id
            UNION ALL
            SELECT 
                NULL AS user_id,
                s.staff_id,
                s.staff_code,
                s.full_name,
                s.email,
                s.phone,
                NULL AS role_id,
                NULL AS role_name,
                0 AS is_active,
                NULL AS last_login_at,
                s.job_title,
                s.job_title_id,
                s.has_system_account,
                'staff' AS account_type,
                s.created_at
            FROM dbo.StaffProfiles s
            WHERE s.user_id IS NULL
            ORDER BY user_id DESC, staff_id DESC
        `);

        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminController] getAccounts error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// PUT /api/admin/accounts/:id/status — toggle is_active (Activate / Deactivate)
export const toggleAccountStatus = async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const adminId  = req.user?.user_id;

        if (!Number.isFinite(targetId) || targetId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid account id.' });
        }
        // Prevent self-lockout
        if (targetId === adminId) {
            return res.status(403).json({ success: false, message: 'You cannot deactivate your own account.' });
        }

        const pool = await getRawPool();

        // Fetch current state
        const current = await pool.request()
            .input('id', sql.Int, targetId)
            .query(`SELECT is_active, full_name FROM dbo.UserAccounts WHERE user_id = @id`);

        if (!current.recordset.length) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        const wasActive   = current.recordset[0].is_active;
        const targetName  = current.recordset[0].full_name;
        const newActive   = wasActive ? 0 : 1;
        const actionName  = newActive ? 'activate_account' : 'deactivate_account';

        // Update status
        await pool.request()
            .input('id', sql.Int, targetId)
            .input('active', sql.Bit, newActive)
            .query(`UPDATE dbo.UserAccounts SET is_active = @active, updated_at = SYSDATETIME() WHERE user_id = @id`);

        // Write audit log
        await pool.request()
            .input('userId',  sql.Int,          adminId)
            .input('action',  sql.NVarChar(100), actionName)
            .input('table',   sql.NVarChar(128), 'UserAccounts')
            .input('targetId',sql.Int,          targetId)
            .input('oldJson', sql.NVarChar(sql.MAX), JSON.stringify({ is_active: wasActive, full_name: targetName }))
            .input('newJson', sql.NVarChar(sql.MAX), JSON.stringify({ is_active: newActive }))
            .input('ip',      sql.VarChar(45),  req.ip || null)
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address)
                VALUES (@userId, @action, @table, @targetId, @oldJson, @newJson, @ip)
            `);

        return res.json({ success: true, message: `Account ${newActive ? 'activated' : 'deactivated'}.`, is_active: newActive });
    } catch (error) {
        console.error('[adminController] toggleAccountStatus error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// PUT /api/admin/staff/:staffId/job-title — update employee job title
export const updateStaffJobTitle = async (req, res) => {
    try {
        const staffId = Number(req.params.staffId);
        const { job_title_id } = req.body;

        if (!Number.isFinite(staffId) || staffId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid staff ID.' });
        }

        const pool = await getRawPool();

        // Fetch job title details
        const titleRes = await pool.request()
            .input('jtId', sql.TinyInt, job_title_id)
            .query('SELECT title_name FROM dbo.JobTitles WHERE job_title_id = @jtId');

        if (titleRes.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Job title not found.' });
        }
        const titleName = titleRes.recordset[0].title_name;

        // Fetch existing job title for audit log
        const currentStaff = await pool.request()
            .input('staffId', sql.Int, staffId)
            .query('SELECT job_title_id, job_title, full_name, user_id FROM dbo.StaffProfiles WHERE staff_id = @staffId');

        if (currentStaff.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Staff profile not found.' });
        }
        const oldJtId = currentStaff.recordset[0].job_title_id;
        const oldJt   = currentStaff.recordset[0].job_title;
        const sName   = currentStaff.recordset[0].full_name;

        // Update StaffProfile
        await pool.request()
            .input('staffId', sql.Int, staffId)
            .input('jtId', sql.TinyInt, job_title_id)
            .input('title', sql.NVarChar(80), titleName)
            .query(`
                UPDATE dbo.StaffProfiles 
                SET job_title_id = @jtId, job_title = @title, updated_at = SYSDATETIME()
                WHERE staff_id = @staffId
            `);

        // Write audit log
        const adminId = req.user?.user_id;
        await pool.request()
            .input('userId',   sql.Int,          adminId)
            .input('action',   sql.NVarChar(100), 'update_staff_job_title')
            .input('table',    sql.NVarChar(128), 'StaffProfiles')
            .input('targetId', sql.Int,          staffId)
            .input('oldJson',  sql.NVarChar(sql.MAX), JSON.stringify({ job_title_id: oldJtId, job_title: oldJt, full_name: sName }))
            .input('newJson',  sql.NVarChar(sql.MAX), JSON.stringify({ job_title_id, job_title: titleName }))
            .input('ip',       sql.VarChar(45),  req.ip || null)
            .query(`
                INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address)
                VALUES (@userId, @action, @table, @targetId, @oldJson, @newJson, @ip)
            `);

        return res.json({ success: true, message: 'Job title updated successfully.' });
    } catch (error) {
        console.error('[adminController] updateStaffJobTitle error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

export const getCustomerDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getRawPool();
        
        const userQuery = await pool.request()
            .input('userId', sql.Int, id)
            .query(`
                SELECT u.user_id, u.full_name, u.email, u.phone, u.is_active, u.created_at, u.last_login_at,
                       p.loyalty_points, p.date_of_birth, p.bio, p.gender
                FROM dbo.UserAccounts u
                LEFT JOIN dbo.CustomerProfiles p ON u.user_id = p.user_id
                WHERE u.user_id = @userId AND u.role_id = 1
            `);
            
        if (userQuery.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }
        
        const customerInfo = userQuery.recordset[0];
        
        const statsQuery = await pool.request()
            .input('userId', sql.Int, id)
            .query(`
                SELECT 
                    (SELECT COUNT(*) FROM dbo.Reservations WHERE customer_id = @userId) AS total_reservations,
                    (SELECT COUNT(*) FROM dbo.Orders WHERE customer_id = @userId) AS total_orders,
                    (SELECT ISNULL(SUM(total_amount), 0) FROM dbo.Orders WHERE customer_id = @userId) AS total_spent
            `);
            
        const resQuery = await pool.request()
            .input('userId', sql.Int, id)
            .query(`
                SELECT TOP 5 reservation_id, reservation_start_at, guest_count, reservation_status
                FROM dbo.Reservations
                WHERE customer_id = @userId
                ORDER BY reservation_start_at DESC
            `);
            
        const orderQuery = await pool.request()
            .input('userId', sql.Int, id)
            .query(`
                SELECT TOP 5 order_id, total_amount, order_status, created_at
                FROM dbo.Orders
                WHERE customer_id = @userId
                ORDER BY created_at DESC
            `);
            
        return res.json({
            success: true,
            data: {
                info: customerInfo,
                stats: statsQuery.recordset[0],
                recentReservations: resQuery.recordset,
                recentOrders: orderQuery.recordset
            }
        });
    } catch (error) {
        console.error('[adminController] getCustomerDetails error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

export const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getRawPool();
        
        const userCheck = await pool.request()
            .input('userId', sql.Int, id)
            .query('SELECT role_id FROM dbo.UserAccounts WHERE user_id = @userId');
            
        if (userCheck.recordset.length === 0 || userCheck.recordset[0].role_id !== 1) {
            return res.status(404).json({ success: false, message: 'Customer not found or invalid role.' });
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
            await transaction.request().input('userId', sql.Int, id).query('UPDATE dbo.Orders SET customer_id = NULL WHERE customer_id = @userId');
            await transaction.request().input('userId', sql.Int, id).query('UPDATE dbo.Reservations SET customer_id = NULL WHERE customer_id = @userId');
            await transaction.request().input('userId', sql.Int, id).query('UPDATE dbo.CustomerReviews SET customer_id = NULL WHERE customer_id = @userId');
            await transaction.request().input('userId', sql.Int, id).query('UPDATE dbo.VoucherRedemptions SET customer_id = NULL WHERE customer_id = @userId');
            await transaction.request().input('userId', sql.Int, id).query('UPDATE dbo.LoyaltyTransactions SET customer_id = NULL WHERE customer_id = @userId');
            
            await transaction.request().input('userId', sql.Int, id).query('DELETE FROM dbo.CustomerProfiles WHERE user_id = @userId');
            await transaction.request().input('userId', sql.Int, id).query('DELETE FROM dbo.CustomerVouchers WHERE customer_id = @userId');
            await transaction.request().input('userId', sql.Int, id).query('DELETE FROM dbo.RecommendationLogs WHERE customer_id = @userId');

            await transaction.request().input('userId', sql.Int, id).query('DELETE FROM dbo.UserAccounts WHERE user_id = @userId');
            
            await transaction.commit();
            return res.json({ success: true, message: 'Customer deleted successfully.' });
        } catch (txError) {
            await transaction.rollback();
            throw txError;
        }
    } catch (error) {
        console.error('[adminController] deleteCustomer error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
