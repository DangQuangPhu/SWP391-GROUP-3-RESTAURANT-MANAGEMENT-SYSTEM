import { getRawPool } from '../db.js';
import sql from 'mssql';
import { getIO } from '../socket.js';

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

// PUT /api/admin/roles/:id — update role description only
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

/**
 * PATCH /api/admin/users/:userId/role
 * UC-A02 — Admin assigns/changes a user's role.
 *
 * Rules:
 *  - Cannot promote to Admin (role_id 5) via this endpoint.
 *  - Cannot change your own role (self-lockout prevention).
 *  - Active duty check: KitchenTickets (role 3), Reservations (role 2/4).
 *  - Updates UserAccounts + StaffProfiles, inserts AuditLogs, emits force-logout socket event.
 */
export const assignUserRole = async (req, res) => {
    try {
        const targetUserId = Number(req.params.userId);
        const { role_id: newRoleId, job_title } = req.body;
        const adminUserId = req.user?.user_id;

        if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid userId.' });
        }
        if (!Number.isFinite(Number(newRoleId)) || Number(newRoleId) <= 0) {
            return res.status(400).json({ success: false, message: 'role_id is required.' });
        }
        const parsedNewRoleId = Number(newRoleId);

        // Prevent escalation to Admin through this endpoint
        if (parsedNewRoleId === 5) {
            return res.status(403).json({ success: false, message: 'Cannot promote a user to Admin via this endpoint. Contact the system owner.' });
        }
        // Prevent valid role IDs outside system range (role_id=3 deprecated, role_id=5 escalation blocked above)
        if (![1, 2, 4].includes(parsedNewRoleId)) {
            return res.status(400).json({ success: false, message: 'role_id must be 1 (Customer), 2 (Restaurant Staff), or 4 (Manager). role_id=3 (Kitchen Staff) is deprecated.' });
        }

        // Prevent self-role-change
        if (targetUserId === adminUserId) {
            return res.status(403).json({ success: false, message: 'You cannot change your own role.' });
        }

        const pool = await getRawPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Fetch current user info
            const userRes = await transaction.request()
                .input('userId', sql.Int, targetUserId)
                .query(`
                    SELECT ua.user_id, ua.role_id AS current_role_id, ua.full_name, r.role_name AS current_role_name
                    FROM dbo.UserAccounts ua
                    JOIN dbo.Roles r ON ua.role_id = r.role_id
                    WHERE ua.user_id = @userId
                `);

            if (userRes.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'User not found.' });
            }

            const { current_role_id, current_role_name, full_name } = userRes.recordset[0];

            if (current_role_id === parsedNewRoleId) {
                await transaction.rollback();
                return res.status(409).json({ success: false, message: `User is already assigned to role_id ${parsedNewRoleId}.` });
            }

            // Active duty check (role_id=3 Kitchen Staff check removed — KDS is device-based now)
            if ([2, 4].includes(current_role_id)) {
                // Restaurant Staff / Manager: check for active reservations assigned
                const resCheck = await transaction.request()
                    .input('userId', sql.Int, targetUserId)
                    .query(`
                        SELECT 1 AS has_active FROM dbo.Reservations r
                        LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
                        WHERE r.reservation_status IN (N'Check-in', N'Dining', N'Payment Pending')
                          AND (r.confirmed_by_staff_id = @userId OR rt.assigned_by_staff_id = @userId)
                    `);
                if (resCheck.recordset.length > 0) {
                    await transaction.rollback();
                    return res.status(409).json({ success: false, message: 'Cannot change role. Staff is assigned to active reservations. Reassign them first.' });
                }
            }


            // Fetch new role name for job_title
            const newRoleRes = await transaction.request()
                .input('newRoleId', sql.TinyInt, parsedNewRoleId)
                .query('SELECT role_name FROM dbo.Roles WHERE role_id = @newRoleId');
            const newRoleName = job_title || newRoleRes.recordset[0]?.role_name || `Role ${parsedNewRoleId}`;

            // Update UserAccounts
            await transaction.request()
                .input('userId', sql.Int, targetUserId)
                .input('newRoleId', sql.TinyInt, parsedNewRoleId)
                .query('UPDATE dbo.UserAccounts SET role_id = @newRoleId, updated_at = SYSDATETIME() WHERE user_id = @userId');

            // Upsert StaffProfiles (non-Customer roles need a profile)
            if (parsedNewRoleId !== 1) {
                const profileExists = await transaction.request()
                    .input('userId', sql.Int, targetUserId)
                    .query('SELECT staff_id FROM dbo.StaffProfiles WHERE user_id = @userId');

                if (profileExists.recordset.length > 0) {
                    await transaction.request()
                        .input('userId', sql.Int, targetUserId)
                        .input('jobTitle', sql.NVarChar(80), newRoleName)
                        .query('UPDATE dbo.StaffProfiles SET job_title = @jobTitle, updated_at = SYSDATETIME() WHERE user_id = @userId');
                } else {
                    // Generate staff code
                    const codeRes = await transaction.request()
                        .query("SELECT ISNULL(MAX(staff_id), 0) + 1 AS nextId FROM dbo.StaffProfiles");
                    const staffCode = `STF${String(codeRes.recordset[0].nextId).padStart(3, '0')}`;
                    await transaction.request()
                        .input('userId', sql.Int, targetUserId)
                        .input('staffCode', sql.VarChar(30), staffCode)
                        .input('jobTitle', sql.NVarChar(80), newRoleName)
                        .query(`
                            INSERT INTO dbo.StaffProfiles (user_id, staff_code, job_title, hire_date, employment_status)
                            VALUES (@userId, @staffCode, @jobTitle, CAST(GETDATE() AS DATE), N'Active')
                        `);
                }
            }

            // Audit log
            await transaction.request()
                .input('adminId', sql.Int, adminUserId)
                .input('targetId', sql.Int, targetUserId)
                .input('oldValue', sql.NVarChar(sql.MAX), JSON.stringify({ role_id: current_role_id, role_name: current_role_name }))
                .input('newValue', sql.NVarChar(sql.MAX), JSON.stringify({ role_id: parsedNewRoleId, role_name: newRoleName }))
                .input('ip', sql.NVarChar(45), req.ip || '127.0.0.1')
                .query(`
                    INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
                    VALUES (@adminId, N'ADMIN_ROLE_CHANGE', N'UserAccounts', @targetId, @oldValue, @newValue, @ip, SYSDATETIME())
                `);

            await transaction.commit();

            // Emit force-logout to affected user
            const io = req.app?.get('io') || getIO();
            if (io) {
                io.to(`user_${targetUserId}`).emit('auth:force_logout', {
                    message: 'Your account role has been changed by an administrator. Please log in again.'
                });
            }

            return res.json({
                success: true,
                message: `Role for "${full_name}" updated to ${newRoleName} (role_id: ${parsedNewRoleId}).`,
                data: { user_id: targetUserId, new_role_id: parsedNewRoleId, new_role_name: newRoleName }
            });

        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }
    } catch (error) {
        console.error('[adminRoleController] assignUserRole error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

/**
 * GET /api/admin/employees?name=&email=&phone=&role=&page=1&limit=20
 * UC-A03 — Admin searches and lists employees with pagination.
 */
export const searchEmployees = async (req, res) => {
    try {
        const { name, email, phone, role, page = 1, limit = 20 } = req.query;
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const offset = (parsedPage - 1) * parsedLimit;

        const pool = await getRawPool();
        const request = pool.request();

        const whereClauses = [];

        if (name && name.trim()) {
            request.input('name', sql.NVarChar(120), `%${name.trim()}%`);
            whereClauses.push('ua.full_name LIKE @name');
        }
        if (email && email.trim()) {
            request.input('email', sql.NVarChar(180), `%${email.trim()}%`);
            whereClauses.push('ua.email LIKE @email');
        }
        if (phone && phone.trim()) {
            request.input('phone', sql.VarChar(25), `%${phone.trim()}%`);
            whereClauses.push('ua.phone LIKE @phone');
        }
        if (role && role.trim()) {
            request.input('roleName', sql.NVarChar(50), role.trim());
            whereClauses.push('r.role_name = @roleName');
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, parsedLimit);

        const countResult = await pool.request().query(`
            SELECT COUNT(*) AS total
            FROM dbo.UserAccounts ua
            JOIN dbo.Roles r ON ua.role_id = r.role_id
            LEFT JOIN dbo.StaffProfiles sp ON ua.user_id = sp.user_id
            ${whereSQL}
        `);

        const result = await request.query(`
            SELECT
                ua.user_id,
                ua.full_name,
                ua.email,
                ua.phone,
                ua.is_active,
                ua.created_at,
                r.role_id,
                r.role_name,
                sp.staff_id,
                sp.staff_code,
                sp.job_title,
                sp.employment_status,
                sp.hire_date
            FROM dbo.UserAccounts ua
            JOIN dbo.Roles r ON ua.role_id = r.role_id
            LEFT JOIN dbo.StaffProfiles sp ON ua.user_id = sp.user_id
            ${whereSQL}
            ORDER BY ua.full_name ASC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        return res.json({
            success: true,
            data: result.recordset,
            meta: {
                total: countResult.recordset[0].total,
                page: parsedPage,
                limit: parsedLimit,
                total_pages: Math.ceil(countResult.recordset[0].total / parsedLimit)
            }
        });
    } catch (error) {
        console.error('[adminRoleController] searchEmployees error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
