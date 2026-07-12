/**
 * Employee Controller
 * Implements the Employee Registry (Part B of the KDS plan).
 *
 * Security rules:
 *   - salary: only returned to Manager (role_id=4) or Admin (role_id=5)
 *   - performance ratings: read/write Manager/Admin only (enforced by route middleware)
 *   - grantSystemAccess: Manager→role 2 only; Admin→role 2,4; role 3 blocked; role 5 blocked
 */
import { getRawPool } from '../db.js';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendOtpEmail } from '../email.js'; // reuse existing SMTP utility

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const generateTempPassword = () => {
  // 12-char secure temp password: at least 1 upper, 1 digit, 1 special
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$%';
  const rand = crypto.randomBytes(10);
  let pass = special[rand[0] % special.length];
  pass += String.fromCharCode(65 + rand[1] % 26); // uppercase
  pass += String(rand[2] % 9 + 1); // digit
  for (let i = 3; i < 12; i++) pass += chars[rand[i] % chars.length];
  return pass.split('').sort(() => Math.random() - 0.5).join('');
};

const MANAGER_GRANTABLE_ROLES  = [2];       // Staff only
const ADMIN_GRANTABLE_ROLES    = [2, 4];    // Staff + Manager
// role_id=3 blocked (deprecated); role_id=5 blocked for all via this endpoint

// ─────────────────────────────────────────────────────────────
// GET /api/manager/employees
// ─────────────────────────────────────────────────────────────
export const listEmployees = async (req, res) => {
  const callerRoleId = req.user?.role_id;
  const includeSalary = [4, 5].includes(callerRoleId);

  try {
    const pool = await getRawPool();
    const result = await pool.request().query(`
      SELECT
        sp.staff_id,
        sp.user_id,
        sp.has_system_account,
        sp.department,
        ${includeSalary ? 'sp.salary,' : ''}
        COALESCE(ua.full_name, sp.full_name) AS full_name,
        COALESCE(ua.email,     sp.email)     AS email,
        COALESCE(ua.phone,     sp.phone)     AS phone,
        ua.role_id,
        ua.is_active   AS account_is_active,
        jt.title_name  AS job_title,
        sp.job_title_id,
        pr_latest.rating     AS latest_rating,
        pr_latest.review_date AS last_review_date,
        pr_latest.notes      AS last_review_notes
      FROM dbo.StaffProfiles sp
      LEFT JOIN dbo.UserAccounts ua ON ua.user_id = sp.user_id
      LEFT JOIN dbo.JobTitles jt ON jt.job_title_id = sp.job_title_id
      OUTER APPLY (
        SELECT TOP 1 rating, review_date, notes
        FROM dbo.PerformanceReviews
        WHERE staff_id = sp.staff_id
        ORDER BY review_date DESC, created_at DESC
      ) pr_latest
      ORDER BY COALESCE(ua.full_name, sp.full_name) ASC
    `);

    if (includeSalary) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }

    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[employeeController] listEmployees error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list employees.' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/manager/job-titles
// ─────────────────────────────────────────────────────────────
export const listJobTitles = async (req, res) => {
  try {
    const pool = await getRawPool();
    const result = await pool.request().query(
      `SELECT job_title_id, title_name FROM dbo.JobTitles ORDER BY title_name ASC`
    );
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[employeeController] listJobTitles error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list job titles.' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/manager/employees  — create employee WITHOUT system account
// ─────────────────────────────────────────────────────────────
export const createEmployee = async (req, res) => {
  const { full_name, email, phone, job_title_id, salary, department } = req.body ?? {};

  if (!full_name?.trim()) {
    return res.status(400).json({ success: false, message: 'full_name is required.' });
  }

  try {
    const pool = await getRawPool();

    // Uniqueness check: email across UserAccounts + StaffProfiles (active + inactive)
    if (email) {
      const dupCheck = await pool.request()
        .input('email', sql.NVarChar(255), email.trim())
        .query(`
          SELECT 1 AS dup FROM dbo.UserAccounts WHERE email = @email
          UNION ALL
          SELECT 1 AS dup FROM dbo.StaffProfiles WHERE email = @email
        `);
      if (dupCheck.recordset.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already in use by another account or employee.' });
      }
    }
    // Phone uniqueness check
    if (phone) {
      const phoneCheck = await pool.request()
        .input('phone', sql.NVarChar(20), phone.trim())
        .query(`
          SELECT 1 AS dup FROM dbo.UserAccounts WHERE phone = @phone
          UNION ALL
          SELECT 1 AS dup FROM dbo.StaffProfiles WHERE phone = @phone
        `);
      if (phoneCheck.recordset.length > 0) {
        return res.status(409).json({ success: false, message: 'Phone number already in use.' });
      }
    }

    const callerIncludeSalary = [4, 5].includes(req.user?.role_id);
    const salaryVal = callerIncludeSalary ? (salary ?? null) : null;

    const result = await pool.request()
      .input('fullName',    sql.NVarChar(200), full_name.trim())
      .input('email',       sql.NVarChar(255), email?.trim() ?? null)
      .input('phone',       sql.NVarChar(20),  phone?.trim() ?? null)
      .input('jobTitleId',  sql.TinyInt,       job_title_id ?? null)
      .input('salary',      sql.Decimal(18,2), salaryVal)
      .input('department',  sql.NVarChar(60),  department?.trim() ?? null)
      .query(`
        INSERT INTO dbo.StaffProfiles
          (full_name, email, phone, job_title_id, salary, department,
           has_system_account, user_id)
        OUTPUT inserted.staff_id, inserted.full_name, inserted.email
        VALUES
          (@fullName, @email, @phone, @jobTitleId, @salary, @department, 0, NULL)
      `);

    // AuditLog
    await pool.request()
      .input('actorId',  sql.Int,        req.user.user_id)
      .input('staffId',  sql.Int,        result.recordset[0].staff_id)
      .input('payload',  sql.NVarChar(sql.MAX), JSON.stringify({ full_name, email, job_title_id }))
      .query(`
        INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
        VALUES (@actorId, N'EMPLOYEE_CREATED', N'StaffProfiles', @staffId, @payload, SYSDATETIME())
      `);

    return res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('[employeeController] createEmployee error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create employee.' });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/manager/employees/:id
// ─────────────────────────────────────────────────────────────
export const updateEmployee = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  if (!Number.isFinite(staffId)) {
    return res.status(400).json({ success: false, message: 'Invalid employee ID.' });
  }

  const { full_name, email, phone, job_title_id, salary, department } = req.body ?? {};
  const callerRoleId = req.user?.role_id;
  const includeSalary = [4, 5].includes(callerRoleId);

  try {
    const pool = await getRawPool();
    const request = pool.request().input('staffId', sql.Int, staffId);

    const updates = [];
    if (full_name !== undefined)    { updates.push('full_name = @fullName');   request.input('fullName',   sql.NVarChar(200), full_name.trim()); }
    if (email !== undefined)        { updates.push('email = @email');          request.input('email',      sql.NVarChar(255), email?.trim() ?? null); }
    if (phone !== undefined)        { updates.push('phone = @phone');          request.input('phone',      sql.NVarChar(20),  phone?.trim() ?? null); }
    if (job_title_id !== undefined) { updates.push('job_title_id = @jtId');   request.input('jtId',       sql.TinyInt,       job_title_id ?? null); }
    if (department !== undefined)   { updates.push('department = @dept');      request.input('dept',       sql.NVarChar(60),  department?.trim() ?? null); }
    if (salary !== undefined && includeSalary) { updates.push('salary = @salary'); request.input('salary', sql.Decimal(18,2), salary ?? null); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    const result = await request.query(`
      UPDATE dbo.StaffProfiles
      SET ${updates.join(', ')}
      OUTPUT inserted.staff_id
      WHERE staff_id = @staffId
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // AuditLog
    await pool.request()
      .input('actorId', sql.Int, req.user.user_id)
      .input('staffId', sql.Int, staffId)
      .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(req.body))
      .query(`INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
              VALUES (@actorId, N'EMPLOYEE_UPDATED', N'StaffProfiles', @staffId, @payload, SYSDATETIME())`);

    return res.json({ success: true, message: 'Employee updated.' });
  } catch (err) {
    console.error('[employeeController] updateEmployee error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update employee.' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/manager/employees/:id/grant-access
// Body: { role_id, email? }
// ─────────────────────────────────────────────────────────────
export const grantSystemAccess = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  if (!Number.isFinite(staffId)) return res.status(400).json({ success: false, message: 'Invalid employee ID.' });

  const { role_id: requestedRoleId } = req.body ?? {};
  const callerRoleId = req.user?.role_id;

  // ── Privilege guards ────────────────────────────────────────
  if (requestedRoleId === 3) {
    return res.status(400).json({ success: false, message: 'role_id=3 (Kitchen Staff) is deprecated and cannot be granted.' });
  }
  if (requestedRoleId === 5) {
    return res.status(403).json({ success: false, message: 'Admin role cannot be granted via this endpoint.' });
  }
  if (callerRoleId === 4 && !MANAGER_GRANTABLE_ROLES.includes(requestedRoleId)) {
    return res.status(403).json({ success: false, message: 'Managers can only grant the Restaurant Staff role (role_id=2).' });
  }
  if (callerRoleId === 5 && !ADMIN_GRANTABLE_ROLES.includes(requestedRoleId)) {
    return res.status(403).json({ success: false, message: 'Admins can grant Restaurant Staff (2) or Manager (4) roles via this endpoint.' });
  }

  try {
    const pool = await getRawPool();

    // Fetch employee
    const empResult = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT sp.staff_id, sp.user_id, sp.has_system_account,
               COALESCE(sp.full_name, ua.full_name) AS full_name,
               COALESCE(sp.email, ua.email) AS email,
               COALESCE(sp.phone, ua.phone) AS phone
        FROM dbo.StaffProfiles sp
        LEFT JOIN dbo.UserAccounts ua ON ua.user_id = sp.user_id
        WHERE sp.staff_id = @staffId
      `);

    const employee = empResult.recordset[0];
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    if (!employee.email) return res.status(400).json({ success: false, message: 'Employee must have an email before granting system access.' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    let userId;

    // ── Re-grant collision fix: check for existing inactive account ──
    const existingAcct = await pool.request()
      .input('email', sql.NVarChar(255), employee.email)
      .query(`SELECT user_id, is_active FROM dbo.UserAccounts WHERE email = @email`);

    if (existingAcct.recordset.length > 0) {
      const acct = existingAcct.recordset[0];
      if (acct.is_active === true || acct.is_active === 1) {
        return res.status(409).json({ success: false, message: 'An active account already exists for this email. Revoke it first if you want to re-grant.' });
      }
      // Reactivate inactive account (re-grant scenario)
      userId = acct.user_id;
      await pool.request()
        .input('userId',    sql.Int,          userId)
        .input('roleId',    sql.TinyInt,      requestedRoleId)
        .input('hash',      sql.VarChar(255), hash)
        .query(`
          UPDATE dbo.UserAccounts
          SET is_active = 1, role_id = @roleId, password_hash = @hash,
              force_password_reset = 1, updated_at = SYSDATETIME()
          WHERE user_id = @userId
        `);
    } else {
      // Create new account
      const newAcct = await pool.request()
        .input('roleId',   sql.TinyInt,     requestedRoleId)
        .input('fullName', sql.NVarChar(200), employee.full_name)
        .input('email',    sql.NVarChar(255), employee.email)
        .input('phone',    sql.NVarChar(20),  employee.phone ?? null)
        .input('hash',     sql.VarChar(255), hash)
        .query(`
          INSERT INTO dbo.UserAccounts
            (role_id, full_name, email, phone, password_hash, is_active,
             email_verified, force_password_reset, created_at, updated_at)
          OUTPUT inserted.user_id
          VALUES (@roleId, @fullName, @email, @phone, @hash, 1, 1, 1, SYSDATETIME(), SYSDATETIME())
        `);
      userId = newAcct.recordset[0].user_id;
    }

    // Link user_id back to StaffProfiles
    await pool.request()
      .input('userId',  sql.Int, userId)
      .input('staffId', sql.Int, staffId)
      .query(`
        UPDATE dbo.StaffProfiles
        SET user_id = @userId, has_system_account = 1, updated_at = SYSDATETIME()
        WHERE staff_id = @staffId
      `);

    // Send temp-password email (reuse sendOtpEmail with custom purpose)
    try {
      await sendOtpEmail({
        to: employee.email,
        otp: tempPassword,
        purpose: 'temp_password',
        // sendOtpEmail reads purpose to pick the email template
      });
    } catch (emailErr) {
      console.warn('[employeeController] grantSystemAccess: email send failed:', emailErr.message);
      // Non-fatal — access still granted, password can be communicated manually
    }

    // AuditLog
    await pool.request()
      .input('actorId',  sql.Int, req.user.user_id)
      .input('staffId',  sql.Int, staffId)
      .input('payload',  sql.NVarChar(sql.MAX), JSON.stringify({ role_id: requestedRoleId, granted_by: req.user.email }))
      .query(`
        INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
        VALUES (@actorId, N'GRANT_SYSTEM_ACCESS', N'StaffProfiles', @staffId, @payload, SYSDATETIME())
      `);

    return res.json({ success: true, message: 'System access granted. Temporary password sent to employee email.' });
  } catch (err) {
    console.error('[employeeController] grantSystemAccess error:', err);
    return res.status(500).json({ success: false, message: 'Failed to grant system access.' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/manager/employees/:id/revoke-access
// ─────────────────────────────────────────────────────────────
export const revokeSystemAccess = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  if (!Number.isFinite(staffId)) return res.status(400).json({ success: false, message: 'Invalid employee ID.' });

  try {
    const pool = await getRawPool();

    const empResult = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT sp.user_id, sp.has_system_account
        FROM dbo.StaffProfiles sp
        WHERE sp.staff_id = @staffId
      `);

    const employee = empResult.recordset[0];
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    if (!employee.has_system_account || !employee.user_id) {
      return res.status(409).json({ success: false, message: 'Employee does not have a system account.' });
    }

    const linkedUserId = employee.user_id;

    // Soft-revoke: deactivate account
    await pool.request()
      .input('userId', sql.Int, linkedUserId)
      .query(`UPDATE dbo.UserAccounts SET is_active = 0, updated_at = SYSDATETIME() WHERE user_id = @userId`);

    // Unlink from StaffProfiles (keep user_id row for AuditLogs FK preservation)
    await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        UPDATE dbo.StaffProfiles
        SET has_system_account = 0, user_id = NULL, updated_at = SYSDATETIME()
        WHERE staff_id = @staffId
      `);

    // Emit auth:force_logout via socket (frontend listener confirmed in StaffNotificationListener.jsx)
    try {
      const { getIO } = await import('../socket.js');
      const io = getIO();
      if (io) {
        io.to(`user:${linkedUserId}`).emit('auth:force_logout', {
          reason: 'Account access has been revoked by an administrator.',
        });
      }
    } catch (socketErr) {
      console.warn('[employeeController] revokeSystemAccess: socket emit failed:', socketErr.message);
    }

    // AuditLog
    await pool.request()
      .input('actorId',  sql.Int, req.user.user_id)
      .input('staffId',  sql.Int, staffId)
      .input('payload',  sql.NVarChar(sql.MAX), JSON.stringify({ revoked_user_id: linkedUserId, revoked_by: req.user.email }))
      .query(`
        INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
        VALUES (@actorId, N'REVOKE_SYSTEM_ACCESS', N'StaffProfiles', @staffId, @payload, SYSDATETIME())
      `);

    return res.json({ success: true, message: 'System access revoked.' });
  } catch (err) {
    console.error('[employeeController] revokeSystemAccess error:', err);
    return res.status(500).json({ success: false, message: 'Failed to revoke system access.' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/manager/employees/:id/performance
// ─────────────────────────────────────────────────────────────
export const addPerformanceReview = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  if (!Number.isFinite(staffId)) return res.status(400).json({ success: false, message: 'Invalid employee ID.' });

  const { rating, notes } = req.body ?? {};
  const ratingNum = parseFloat(rating);

  if (!Number.isFinite(ratingNum) || ratingNum < 1.0 || ratingNum > 5.0) {
    return res.status(400).json({ success: false, message: 'rating must be a number between 1.0 and 5.0.' });
  }

  try {
    const pool = await getRawPool();

    // Verify employee exists
    const empCheck = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`SELECT 1 FROM dbo.StaffProfiles WHERE staff_id = @staffId`);
    if (empCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const result = await pool.request()
      .input('staffId',     sql.Int,          staffId)
      .input('rating',      sql.Decimal(3,1), Math.round(ratingNum * 10) / 10) // ensure 1 decimal
      .input('notes',       sql.NVarChar(1000), notes?.trim() ?? null)
      .input('reviewedBy',  sql.Int,          req.user.user_id)
      .query(`
        INSERT INTO dbo.PerformanceReviews (staff_id, rating, notes, reviewed_by, review_date, created_at)
        OUTPUT inserted.review_id, inserted.rating, inserted.review_date
        VALUES (@staffId, @rating, @notes, @reviewedBy, CAST(SYSDATETIME() AS DATE), SYSDATETIME())
      `);

    // AuditLog
    await pool.request()
      .input('actorId',  sql.Int, req.user.user_id)
      .input('staffId',  sql.Int, staffId)
      .input('payload',  sql.NVarChar(sql.MAX), JSON.stringify({ rating: ratingNum, notes }))
      .query(`INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
              VALUES (@actorId, N'PERFORMANCE_REVIEW_ADDED', N'StaffProfiles', @staffId, @payload, SYSDATETIME())`);

    return res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('[employeeController] addPerformanceReview error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add performance review.' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/manager/employees/:id/performance
// ─────────────────────────────────────────────────────────────
export const listPerformanceHistory = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  if (!Number.isFinite(staffId)) return res.status(400).json({ success: false, message: 'Invalid employee ID.' });

  try {
    const pool = await getRawPool();
    const result = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT pr.review_id, pr.rating, pr.notes, pr.review_date,
               ua.full_name AS reviewed_by_name
        FROM dbo.PerformanceReviews pr
        JOIN dbo.UserAccounts ua ON ua.user_id = pr.reviewed_by
        WHERE pr.staff_id = @staffId
        ORDER BY pr.review_date DESC, pr.created_at DESC
      `);

    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[employeeController] listPerformanceHistory error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch performance history.' });
  }
};
