import { getRawPool } from '../db.js';
import sql from 'mssql';
import bcrypt from 'bcryptjs';

// Helper to map role name to role id
// role_id=3 (Kitchen Staff) removed — deprecated
const getRoleId = (roleName) => {
    switch(roleName) {
        case 'Restaurant Staff': return 2;
        case 'Manager': return 4;
        case 'Admin': return 5;
        default: return 2; // Default to Restaurant Staff
    }
};


const mapEmploymentStatusToDb = (status) => {
    if (status === 'active') return 'Active';
    if (status === 'inactive') return 'Resigned'; // or handle as inactive
    if (status === 'leave') return 'On Leave';
    if (status === 'Active') return 'Active';
    if (status === 'Inactive') return 'Resigned';
    if (status === 'On Leave') return 'On Leave';
    return 'Active';
};

const getStaffCode = async (pool) => {
    const result = await pool.request().query("SELECT ISNULL(MAX(staff_id), 0) + 1 AS nextId FROM dbo.StaffProfiles");
    const nextId = result.recordset[0].nextId;
    return `STF${String(nextId).padStart(3, '0')}`;
};

export const createStaffAccount = async (req, res) => {
    try {
        const { full_name, phone, role_name, status } = req.body;
        
        if (!full_name) {
            return res.status(400).json({ success: false, message: 'Name is required.' });
        }

        const roleId = getRoleId(role_name);
        const empStatus = mapEmploymentStatusToDb(status);
        const defaultPassword = 'Phurai@123';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        const pool = await getRawPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Auto-generate email
            let baseEmail = full_name.trim().toLowerCase().replace(/\s+/g, '.').normalize("NFD").replace(/[\u0300-\u036f]/g, "") + '@phurai.vn';
            let email = baseEmail;
            let counter = 1;

            while (true) {
                const emailCheck = await transaction.request()
                    .input('email', sql.NVarChar(180), email)
                    .query('SELECT user_id FROM dbo.UserAccounts WHERE email = @email');
                if (emailCheck.recordset.length === 0) {
                    break;
                }
                counter++;
                email = `${baseEmail.split('@')[0]}${counter}@phurai.vn`;
            }

            // Insert into UserAccounts
            const userResult = await transaction.request()
                .input('roleId', sql.TinyInt, roleId)
                .input('fullName', sql.NVarChar(120), full_name)
                .input('email', sql.NVarChar(180), email)
                .input('phone', sql.VarChar(25), phone || null)
                .input('passwordHash', sql.NVarChar(255), passwordHash)
                .input('isActive', sql.Bit, empStatus === 'Resigned' ? 0 : 1)
                .query(`
                    INSERT INTO dbo.UserAccounts (role_id, full_name, email, phone, password_hash, is_active, email_verified)
                    OUTPUT inserted.user_id
                    VALUES (@roleId, @fullName, @email, @phone, @passwordHash, @isActive, 1)
                `);
                
            const userId = userResult.recordset[0].user_id;

            // Generate staff code and insert into StaffProfiles
            const staffCode = await getStaffCode(pool);
            const staffResult = await transaction.request()
                .input('userId', sql.Int, userId)
                .input('staffCode', sql.VarChar(30), staffCode)
                .input('jobTitle', sql.NVarChar(80), role_name)
                .input('empStatus', sql.NVarChar(20), empStatus)
                .query(`
                    INSERT INTO dbo.StaffProfiles (user_id, staff_code, job_title, hire_date, employment_status)
                    OUTPUT inserted.staff_id
                    VALUES (@userId, @staffCode, @jobTitle, CAST(GETDATE() AS DATE), @empStatus)
                `);

            const staffId = staffResult.recordset[0].staff_id;

            await transaction.commit();

            return res.json({ 
                success: true, 
                data: {
                    user_id: userId,
                    staff_id: staffId,
                    staff_code: staffCode,
                    full_name,
                    email,
                    phone,
                    role_name,
                    status
                }
            });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }
    } catch (error) {
        console.error('[staffManagementController] createStaffAccount error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error creating staff.' });
    }
};

export const updateStaffAccount = async (req, res) => {
    try {
        const { id } = req.params; // this is staff_id
        const { full_name, email, phone, role_name, status } = req.body;
        
        if (!id || !full_name || !email) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        const roleId = getRoleId(role_name);
        const empStatus = mapEmploymentStatusToDb(status);
        const isActive = empStatus === 'Resigned' ? 0 : 1;

        const pool = await getRawPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Find the user_id
            const profileResult = await transaction.request()
                .input('staffId', sql.Int, id)
                .query('SELECT user_id FROM dbo.StaffProfiles WHERE staff_id = @staffId');
                
            if (profileResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Staff profile not found.' });
            }
            
            const userId = profileResult.recordset[0].user_id;

            // Get current user to check for role changes
            const userCheck = await transaction.request()
                .input('userId', sql.Int, userId)
                .query('SELECT role_id, is_active FROM dbo.UserAccounts WHERE user_id = @userId');
            
            const oldRoleId = userCheck.recordset[0].role_id;
            const oldIsActive = userCheck.recordset[0].is_active;

            // Active duty check (role_id=3 Kitchen Staff check removed — KDS is device-based)
            if (oldRoleId === 2 || oldRoleId === 4 || oldRoleId === 5) {
                const restaurantCheck = await transaction.request()
                    .input('userId', sql.Int, userId)
                    .query(`
                        SELECT 1 FROM dbo.Reservations r
                        LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
                        WHERE r.reservation_status IN (N'Check-in', N'Dining', N'Payment Pending')
                        AND (r.confirmed_by_staff_id = @userId OR rt.assigned_by_staff_id = @userId)
                    `);
                if (restaurantCheck.recordset.length > 0) {
                    await transaction.rollback();
                    return res.status(409).json({ success: false, message: "Cannot change role. Please reassign their active tables/tickets first." });
                }
            }


            // Update UserAccounts
            await transaction.request()
                .input('userId', sql.Int, userId)
                .input('roleId', sql.TinyInt, roleId)
                .input('fullName', sql.NVarChar(120), full_name)
                .input('email', sql.NVarChar(180), email)
                .input('phone', sql.VarChar(25), phone || null)
                .input('isActive', sql.Bit, isActive)
                .query(`
                    UPDATE dbo.UserAccounts 
                    SET role_id = @roleId, full_name = @fullName, email = @email, phone = @phone, is_active = @isActive, updated_at = SYSDATETIME()
                    WHERE user_id = @userId
                `);

            // Update StaffProfiles
            await transaction.request()
                .input('staffId', sql.Int, id)
                .input('jobTitle', sql.NVarChar(80), role_name)
                .input('empStatus', sql.NVarChar(20), empStatus)
                .query(`
                    UPDATE dbo.StaffProfiles 
                    SET job_title = @jobTitle, employment_status = @empStatus, updated_at = SYSDATETIME()
                    WHERE staff_id = @staffId
                `);

            // Update Shift Mapping logic removed (managed via StaffSchedules now)

            await transaction.commit();

            // Emit Socket events if role or status changed!
            const io = req.app?.get('io');
            if (io) {
                if (roleId !== oldRoleId) {
                    io.to(`user_${userId}`).emit('auth:force_logout', { message: "Your account permissions have been updated. Please log in again." });
                }
                if (isActive === 0 && oldIsActive === 1) {
                    io.to(`user_${userId}`).emit('auth:force_logout', { message: "Your account has been deactivated." });
                }
            }

            return res.json({ 
                success: true, 
                data: {
                    user_id: userId,
                    staff_id: id,
                    full_name,
                    email,
                    phone,
                    role_name,
                    status
                }
            });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }
    } catch (error) {
        console.error('[staffManagementController] updateStaffAccount error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error updating staff.' });
    }
};

export const deleteStaffAccount = async (req, res) => {
    try {
        const { id } = req.params; // this is staff_id
        
        if (!id) {
            return res.status(400).json({ success: false, message: 'Staff ID required.' });
        }

        const pool = await getRawPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Find the user_id
            const profileResult = await transaction.request()
                .input('staffId', sql.Int, id)
                .query('SELECT user_id FROM dbo.StaffProfiles WHERE staff_id = @staffId');
                
            if (profileResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Staff profile not found.' });
            }
            
            const userId = profileResult.recordset[0].user_id;

            // Check Active Duties before deleting
            const userCheck = await transaction.request()
                .input('userId', sql.Int, userId)
                .query('SELECT role_id FROM dbo.UserAccounts WHERE user_id = @userId');
            
            const oldRoleId = userCheck.recordset[0].role_id;

            // Active duty check before deleting (role_id=3 check removed — KDS is device-based)
            if (oldRoleId === 2 || oldRoleId === 4 || oldRoleId === 5) {

                const restaurantCheck = await transaction.request()
                    .input('userId', sql.Int, userId)
                    .query(`
                        SELECT 1 FROM dbo.Reservations r
                        LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
                        WHERE r.reservation_status IN (N'Check-in', N'Dining', N'Payment Pending')
                        AND (r.confirmed_by_staff_id = @userId OR rt.assigned_by_staff_id = @userId)
                    `);
                if (restaurantCheck.recordset.length > 0) {
                    await transaction.rollback();
                    return res.status(409).json({ success: false, message: "Cannot delete staff. Please reassign their active tables/tickets first." });
                }
            }

            // Delete from UserAccounts (Cascades to StaffProfiles)
            await transaction.request()
                .input('userId', sql.Int, userId)
                .query('DELETE FROM dbo.UserAccounts WHERE user_id = @userId');

            await transaction.commit();

            // Emit Socket event to kick them out
            const io = req.app?.get('io');
            if (io) {
                io.to(`user_${userId}`).emit('auth:force_logout', { message: "Your account has been deleted." });
            }

            return res.json({ success: true, message: 'Staff deleted successfully' });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }
    } catch (error) {
        console.error('[staffManagementController] deleteStaffAccount error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error deleting staff.' });
    }
};

export const updateStaffShift = async (req, res) => {
    try {
        const { id } = req.params; // staff_id
        const { shift_id } = req.body;
        
        if (!id || !shift_id) return res.status(400).json({ success: false, message: 'Missing fields' });

        const pool = await getRawPool();
        const profileResult = await pool.request()
            .input('staffId', sql.Int, id)
            .query('SELECT user_id FROM dbo.StaffProfiles WHERE staff_id = @staffId');
            
        if (profileResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Staff profile not found.' });
        }
        const userId = profileResult.recordset[0].user_id;

        // Upsert StaffSchedules for TODAY
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('shiftId', sql.TinyInt, shift_id)
            .query(`
                IF EXISTS (SELECT 1 FROM dbo.StaffSchedules WHERE user_id = @userId AND work_date = CAST(GETDATE() AS DATE))
                BEGIN
                    UPDATE dbo.StaffSchedules SET shift_id = @shiftId, updated_at = SYSDATETIME() WHERE user_id = @userId AND work_date = CAST(GETDATE() AS DATE)
                END
                ELSE
                BEGIN
                    INSERT INTO dbo.StaffSchedules (user_id, shift_id, work_date, attendance_status)
                    VALUES (@userId, @shiftId, CAST(GETDATE() AS DATE), N'Scheduled')
                END
            `);
            
        return res.json({ success: true, message: 'Shift updated.' });
    } catch (e) {
        console.error('[staffManagementController] updateStaffShift error:', e);
        return res.status(500).json({ success: false, message: 'Failed to update shift' });
    }
};
