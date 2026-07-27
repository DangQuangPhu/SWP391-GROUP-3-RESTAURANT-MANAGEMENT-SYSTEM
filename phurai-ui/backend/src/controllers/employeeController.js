/**
 * Employee Controller
 * Implements the Employee Registry (Part B of the KDS plan).
 *
 * Security rules:
 *   - salary: only returned to Manager (role_id=3) or Admin (role_id=4)
 *   - performance ratings: read/write Manager/Admin only (enforced by route middleware)
 *   - grantSystemAccess: Manager→role 2 only; Admin→role 2,3; role 4 blocked
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

const CORPORATE_DOMAIN = 'phurai.vn';

/**
 * Normalize an email to use the corporate @phurai.vn domain.
 * - If the input already contains '@', strip everything after '@' and re-append.
 * - If no '@', treat the whole string as the local part.
 * - Returns null if the input is falsy/empty.
 */
const formatPhuraiEmail = (raw) => {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().toLowerCase();
  const localPart = cleaned.includes('@') ? cleaned.split('@')[0] : cleaned;
  if (!localPart) return null;
  return `${localPart}@${CORPORATE_DOMAIN}`;
};

/**
 * Generate an email prefix suggestion from a Vietnamese full name.
 * "Nguyễn Văn Anh" → "nguyenvananh"
 * Strips diacritics, removes non-alphanumeric chars, lowercases.
 */
const suggestEmailFromName = (fullName) => {
  if (!fullName || !fullName.trim()) return '';
  const slug = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]/g, '')     // remove non-alnum
    .toLowerCase();
  return slug || '';
};

const MANAGER_GRANTABLE_ROLES  = [2];       // Staff only
const ADMIN_GRANTABLE_ROLES    = [2, 3];    // Staff + Manager
// role_id=4 blocked for all via this endpoint

// ─────────────────────────────────────────────────────────────
// GET /api/manager/employees
// ─────────────────────────────────────────────────────────────
export const listEmployees = async (req, res) => {
  const callerUserId = req.user?.user_id || 0;
  const callerRoleId = req.user?.role_id;
  const includeSalary = false;

  try {
    const pool = await getRawPool();
    const request = pool.request();
    request.input('callerUserId', sql.Int, callerUserId);
    const result = await request.query(`
      SELECT
        sp.staff_id,
        sp.user_id,
        sp.has_system_account,
        sp.department,
        sp.employment_status,
        ${includeSalary ? 'sp.salary,' : ''}
        COALESCE(ua.full_name, sp.full_name) AS full_name,
        COALESCE(ua.email,     sp.email)     AS email,
        COALESCE(ua.phone,     sp.phone)     AS phone,
        ua.role_id,
        ua.is_active   AS account_is_active,
        CASE 
          WHEN (ua.is_active = 1 OR sp.employment_status = 'Active') AND (ua.user_id = @callerUserId OR sp.user_id = @callerUserId OR (ua.last_login_at IS NOT NULL AND ua.last_login_at >= DATEADD(minute, -120, SYSDATETIME()))) THEN 1 
          ELSE 0 
        END AS is_online,
        jt.title_name  AS job_title,
        sp.job_title_id,
        pr_latest.rating     AS latest_rating,
        pr_latest.review_date AS last_review_date,
        pr_latest.notes      AS last_review_notes
      FROM dbo.StaffProfiles sp
      LEFT JOIN dbo.UserAccounts ua ON (ua.user_id = sp.user_id OR (sp.email IS NOT NULL AND LOWER(ua.email) = LOWER(sp.email)))
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
      `SELECT job_title_id, title_name, requires_system_access FROM dbo.JobTitles ORDER BY title_name ASC`
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
  let { full_name, email, phone, job_title_id, salary, department, password } = req.body ?? {};

  if (!full_name?.trim()) {
    return res.status(400).json({ success: false, message: 'full_name is required.' });
  }

  // ── Auto-format corporate email ──────────────────────────────
  email = formatPhuraiEmail(email);

  // If job title requires system access and email is empty, auto-generate
  if (!email && job_title_id) {
    // We'll check if the job title requires access below; pre-generate slug here
    const suggestedPrefix = suggestEmailFromName(full_name);
    if (suggestedPrefix) {
      email = `${suggestedPrefix}@${CORPORATE_DOMAIN}`;
    }
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

    // Check if the selected job title requires system access
    let hasSystemAccount = 0;
    let userId = null;
    let jobTitleName = 'Staff';

    if (job_title_id) {
      const jtCheck = await pool.request()
        .input('jtId', sql.TinyInt, job_title_id)
        .query(`SELECT requires_system_access, default_role_id, title_name FROM dbo.JobTitles WHERE job_title_id = @jtId`);
      const jobTitle = jtCheck.recordset[0];

      if (jobTitle) {
        jobTitleName = jobTitle.title_name;
        if (jobTitle.requires_system_access) {
        const targetEmail = email?.trim();
        if (!targetEmail) {
          return res.status(400).json({ success: false, message: 'Employee must have an email to create a system account.' });
        }

        // Create system account
        const tempPassword = password || generateTempPassword();
        const hash = await bcrypt.hash(tempPassword, 10);

        const newAcct = await pool.request()
          .input('roleId',   sql.TinyInt,     jobTitle.default_role_id)
          .input('fullName', sql.NVarChar(200), full_name.trim())
          .input('email',    sql.NVarChar(255), targetEmail)
          .input('phone',    sql.NVarChar(20),  phone?.trim() ?? null)
          .input('hash',     sql.VarChar(255), hash)
          .query(`
            INSERT INTO dbo.UserAccounts
              (role_id, full_name, email, phone, password_hash, is_active,
               email_verified, force_password_reset, created_at, updated_at)
            OUTPUT inserted.user_id
            VALUES (@roleId, @fullName, @email, @phone, @hash, 1, 1, 1, SYSDATETIME(), SYSDATETIME())
          `);
        userId = newAcct.recordset[0].user_id;
        hasSystemAccount = 1;

        // Send email
        if (!password) {
          try {
            await sendOtpEmail({
              to: targetEmail,
              otp: tempPassword,
              purpose: 'temp_password',
            });
          } catch (emailErr) {
            console.warn('[employeeController] auto grant access email failed:', emailErr.message);
          }
        }
      }
    }
    }

    const staffCode = `STF-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;

    const result = await pool.request()
      .input('fullName',    sql.NVarChar(200), full_name.trim())
      .input('email',       sql.NVarChar(255), email?.trim() ?? null)
      .input('phone',       sql.NVarChar(20),  phone?.trim() ?? null)
      .input('jobTitleId',  sql.TinyInt,       job_title_id ?? null)
      .input('jobTitle',    sql.NVarChar(80),  jobTitleName)
      .input('staffCode',   sql.VarChar(30),   staffCode)
      .input('department',  sql.NVarChar(60),  department?.trim() ?? null)
      .input('hasAccount',  sql.Bit,           hasSystemAccount)
      .input('userId',      sql.Int,           userId)
      .query(`
        INSERT INTO dbo.StaffProfiles
          (staff_code, full_name, email, phone, job_title, job_title_id, hire_date, department,
           has_system_account, user_id, employment_status, created_at, updated_at)
        OUTPUT inserted.staff_id, inserted.full_name, inserted.email
        VALUES
          (@staffCode, @fullName, @email, @phone, @jobTitle, @jobTitleId, CAST(GETDATE() AS DATE), @department, @hasAccount, @userId, 'Active', SYSDATETIME(), SYSDATETIME())
      `);

    await pool.request()
      .input('actorId',  sql.Int,        req.user?.user_id || 1)
      .input('staffId',  sql.Int,        result.recordset[0].staff_id)
      .input('payload',  sql.NVarChar(sql.MAX), JSON.stringify(req.body))
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

  let { full_name, email, phone, job_title_id, salary, department, role_id, is_active, employment_status, password } = req.body ?? {};
  const callerRoleId = req.user?.role_id;
  const includeSalary = false;

  // ── Auto-format corporate email ──────────────────────────────
  if (email !== undefined) {
    email = formatPhuraiEmail(email);
  }

  try {
    const pool = await getRawPool();

    // Fetch existing profile details
    const empResult = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        SELECT sp.user_id, sp.has_system_account, sp.job_title_id,
               COALESCE(sp.full_name, ua.full_name) AS full_name,
               COALESCE(sp.email, ua.email) AS email,
               COALESCE(sp.phone, ua.phone) AS phone
        FROM dbo.StaffProfiles sp
        LEFT JOIN dbo.UserAccounts ua ON ua.user_id = sp.user_id
        WHERE sp.staff_id = @staffId
      `);
    
    const employee = empResult.recordset[0];
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    let newUserId = employee.user_id;
    let hasAccount = employee.has_system_account;

    // Check if job_title_id is changing
    if (job_title_id !== undefined && job_title_id !== employee.job_title_id) {
      const jtCheck = await pool.request()
        .input('jtId', sql.TinyInt, job_title_id)
        .query(`SELECT requires_system_access, default_role_id FROM dbo.JobTitles WHERE job_title_id = @jtId`);
      const jobTitle = jtCheck.recordset[0];

      if (jobTitle) {
        if (jobTitle.requires_system_access) {
          // Case A: Needs system access but doesn't have an account
          if (!hasAccount) {
            let targetEmail = email?.trim() || employee.email;
            // Auto-generate email from name if still empty
            if (!targetEmail) {
              const prefix = suggestEmailFromName(full_name?.trim() || employee.full_name);
              if (prefix) targetEmail = `${prefix}@${CORPORATE_DOMAIN}`;
            }
            if (!targetEmail) {
              return res.status(400).json({ success: false, message: 'Employee must have an email to create a system account.' });
            }
            // Ensure the target email uses @phurai.vn
            targetEmail = formatPhuraiEmail(targetEmail) || targetEmail;

            // Create account
            const tempPassword = password || generateTempPassword();
            const hash = await bcrypt.hash(tempPassword, 10);

            // Re-grant collision fix: check if account exists
            const existingAcct = await pool.request()
              .input('email', sql.NVarChar(255), targetEmail)
              .query(`SELECT user_id, is_active FROM dbo.UserAccounts WHERE email = @email`);

            if (existingAcct.recordset.length > 0) {
              const acct = existingAcct.recordset[0];
              newUserId = acct.user_id;
              await pool.request()
                .input('userId',    sql.Int,          newUserId)
                .input('roleId',    sql.TinyInt,      jobTitle.default_role_id)
                .input('hash',      sql.VarChar(255), hash)
                .query(`
                  UPDATE dbo.UserAccounts
                  SET is_active = 1, role_id = @roleId, password_hash = @hash,
                      force_password_reset = 1, updated_at = SYSDATETIME()
                  WHERE user_id = @userId
                `);
            } else {
              const newAcct = await pool.request()
                .input('roleId',   sql.TinyInt,     jobTitle.default_role_id)
                .input('fullName', sql.NVarChar(200), full_name?.trim() || employee.full_name)
                .input('email',    sql.NVarChar(255), targetEmail)
                .input('phone',    sql.NVarChar(20),  phone?.trim() || employee.phone || null)
                .input('hash',     sql.VarChar(255), hash)
                .query(`
                  INSERT INTO dbo.UserAccounts
                    (role_id, full_name, email, phone, password_hash, is_active,
                     email_verified, force_password_reset, created_at, updated_at)
                  OUTPUT inserted.user_id
                  VALUES (@roleId, @fullName, @email, @phone, @hash, 1, 1, 1, SYSDATETIME(), SYSDATETIME())
                `);
              newUserId = newAcct.recordset[0].user_id;
            }

            // Update StaffProfile has_system_account and user_id (will be written to DB at the end)
            hasAccount = 1;

            // Send email
            if (!password) {
              try {
                await sendOtpEmail({
                  to: targetEmail,
                  otp: tempPassword,
                  purpose: 'temp_password',
                });
              } catch (emailErr) {
                console.warn('[employeeController] auto grant access email failed:', emailErr.message);
              }
            }
          }
        } else {
          // Case B: Does NOT need access, but currently has an account -> auto revoke!
          if (hasAccount && employee.user_id) {
            await pool.request()
              .input('userId', sql.Int, employee.user_id)
              .query(`
                UPDATE dbo.UserAccounts
                SET is_active = 0, session_revoked_at = SYSDATETIME(), updated_at = SYSDATETIME()
                WHERE user_id = @userId
              `);

            // Socket expulsion
            try {
              const { getIO } = await import('../socket.js');
              const io = getIO();
              if (io) {
                io.to(`room:user:${employee.user_id}`).emit('auth:session_revoked', {
                  reason: 'Your system access has been revoked because your job role changed.',
                  code: 'ACCESS_REVOKED',
                });
              }
            } catch (socketErr) {
              console.warn('[employeeController] socket emit failed:', socketErr.message);
            }

            newUserId = null;
            hasAccount = 0;
          }
        }
      }
    }

    // Now update UserAccounts parameters if the account still exists
    if (newUserId) {
      const userUpdates = [];
      const userRequest = pool.request().input('userId', sql.Int, newUserId);

      if (role_id !== undefined) {
        if (role_id === 4) {
          return res.status(403).json({ success: false, message: 'Cannot assign Admin role.' });
        }
        if (callerRoleId === 3 && role_id !== 2) {
          return res.status(403).json({ success: false, message: 'Managers can only set role to Restaurant Staff (role_id=2).' });
        }
        if (callerRoleId === 4 && role_id !== 2 && role_id !== 3) {
          return res.status(403).json({ success: false, message: 'Admins can only set role to Staff (2) or Manager (3).' });
        }
        userUpdates.push('role_id = @roleId');
        userRequest.input('roleId', sql.TinyInt, role_id);
      }

      if (is_active !== undefined) {
        const isActiveVal = is_active ? 1 : 0;
        userUpdates.push('is_active = @isActive');
        userRequest.input('isActive', sql.Bit, isActiveVal);

        if (!is_active) {
          userUpdates.push('session_revoked_at = SYSDATETIME()');
          // Socket expulsion
          try {
            const { getIO } = await import('../socket.js');
            const io = getIO();
            if (io) {
              io.to(`room:user:${newUserId}`).emit('auth:session_revoked', {
                reason: 'Your account has been deactivated by an administrator.',
                code: 'ACCOUNT_DEACTIVATED',
              });
            }
          } catch (socketErr) {
            console.warn('[employeeController] socket emit failed:', socketErr.message);
          }
        }
      }

      // ── Sync name/email/phone to UserAccounts ──────────────────
      if (full_name !== undefined) {
        userUpdates.push('full_name = @syncFullName');
        userRequest.input('syncFullName', sql.NVarChar(200), full_name.trim());
      }
      if (email !== undefined && email) {
        userUpdates.push('email = @syncEmail');
        userRequest.input('syncEmail', sql.NVarChar(255), email);
      }
      if (phone !== undefined) {
        userUpdates.push('phone = @syncPhone');
        userRequest.input('syncPhone', sql.NVarChar(20), phone?.trim() ?? null);
      }

      if (userUpdates.length > 0) {
        await userRequest.query(`
          UPDATE dbo.UserAccounts
          SET ${userUpdates.join(', ')}, updated_at = SYSDATETIME()
          WHERE user_id = @userId
        `);
      }
    }

    // Update StaffProfiles
    const request = pool.request().input('staffId', sql.Int, staffId);
    const updates = [];
    if (full_name !== undefined)    { updates.push('full_name = @fullName');   request.input('fullName',   sql.NVarChar(200), full_name.trim()); }
    if (email !== undefined)        { updates.push('email = @email');          request.input('email',      sql.NVarChar(255), email?.trim() ?? null); }
    if (phone !== undefined)        { updates.push('phone = @phone');          request.input('phone',      sql.NVarChar(20),  phone?.trim() ?? null); }
    if (job_title_id !== undefined) { updates.push('job_title_id = @jtId');   request.input('jtId',       sql.TinyInt,       job_title_id ?? null); }
    if (department !== undefined)   { updates.push('department = @dept');      request.input('dept',       sql.NVarChar(60),  department?.trim() ?? null); }
    if (salary !== undefined && includeSalary) { updates.push('salary = @salary'); request.input('salary', sql.Decimal(18,2), salary ?? 0); }

    if (employment_status !== undefined) {
      if (!['Active', 'On Leave', 'Resigned'].includes(employment_status)) {
        return res.status(400).json({ success: false, message: 'Invalid employment_status value.' });
      }
      updates.push('employment_status = @empStatus');
      request.input('empStatus', sql.NVarChar(20), employment_status);
    } else if (!newUserId && is_active !== undefined) {
      const targetStatus = is_active ? 'Active' : 'On Leave';
      updates.push('employment_status = @empStatusMapped');
      request.input('empStatusMapped', sql.NVarChar(20), targetStatus);
    }

    updates.push('user_id = @newUserId');
    request.input('newUserId', sql.Int, newUserId);
    updates.push('has_system_account = @hasAccount');
    request.input('hasAccount', sql.Bit, hasAccount);

    if (updates.length > 0) {
      await request.query(`
        UPDATE dbo.StaffProfiles
        SET ${updates.join(', ')}, updated_at = SYSDATETIME()
        WHERE staff_id = @staffId
      `);
    }

    await pool.request()
      .input('actorId', sql.Int, req.user?.user_id || 1)
      .input('staffId', sql.Int, staffId)
      .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(req.body))
      .query(`INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
              VALUES (@actorId, N'EMPLOYEE_UPDATED', N'StaffProfiles', @staffId, @payload, SYSDATETIME())`);

    return res.json({ success: true, message: 'Employee updated successfully.' });
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
  if (requestedRoleId === 4) {
    return res.status(403).json({ success: false, message: 'Admin role cannot be granted via this endpoint.' });
  }
  if (callerRoleId === 3 && !MANAGER_GRANTABLE_ROLES.includes(requestedRoleId)) {
    return res.status(403).json({ success: false, message: 'Managers can only grant the Restaurant Staff role (role_id=2).' });
  }
  if (callerRoleId === 4 && !ADMIN_GRANTABLE_ROLES.includes(requestedRoleId)) {
    return res.status(403).json({ success: false, message: 'Admins can grant Restaurant Staff (2) or Manager (3) roles via this endpoint.' });
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

    // ── Auto-format / auto-generate corporate email ───────────
    let empEmail = formatPhuraiEmail(employee.email);
    if (!empEmail) {
      const prefix = suggestEmailFromName(employee.full_name);
      if (prefix) {
        empEmail = `${prefix}@${CORPORATE_DOMAIN}`;
        // Save the auto-generated email back to StaffProfile
        await pool.request()
          .input('staffId', sql.Int, staffId)
          .input('email', sql.NVarChar(255), empEmail)
          .query(`UPDATE dbo.StaffProfiles SET email = @email, updated_at = SYSDATETIME() WHERE staff_id = @staffId`);
      }
    }
    if (!empEmail) return res.status(400).json({ success: false, message: 'Employee must have an email before granting system access.' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    let userId;

    // ── Re-grant collision fix: check for existing inactive account ──
    const existingAcct = await pool.request()
      .input('email', sql.NVarChar(255), empEmail)
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
      const newAcct = await pool.request()
        .input('roleId',   sql.TinyInt,     requestedRoleId)
        .input('fullName', sql.NVarChar(200), employee.full_name)
        .input('email',    sql.NVarChar(255), empEmail)
        .input('phone',    sql.NVarChar(20),  employee.phone ?? null)
        .input('hash',     sql.VarChar(255), hash)
        .query(`
          INSERT INTO dbo.UserAccounts (role_id, full_name, email, phone, password_hash, is_active, email_verified, force_password_reset, created_at, updated_at)
          OUTPUT inserted.user_id
          VALUES (@roleId, @fullName, @email, @phone, @hash, 1, 1, 1, SYSDATETIME(), SYSDATETIME())
        `);
      userId = newAcct.recordset[0].user_id;
    }

    // Link UserAccount to StaffProfile
    await pool.request()
      .input('staffId', sql.Int, staffId)
      .input('userId',  sql.Int, userId)
      .query(`
        UPDATE dbo.StaffProfiles
        SET has_system_account = 1, user_id = @userId, updated_at = SYSDATETIME()
        WHERE staff_id = @staffId
      `);

    // Send temporary password email
    try {
      await sendOtpEmail({
        to: empEmail,
        otp: tempPassword,
        purpose: 'temp_password',
      });
    } catch (emailErr) {
      console.warn('[employeeController] grantSystemAccess: email sending failed:', emailErr.message);
    }

    // AuditLog
    await pool.request()
      .input('actorId',  sql.Int, req.user?.user_id || 1)
      .input('staffId',  sql.Int, staffId)
      .input('payload',  sql.NVarChar(sql.MAX), JSON.stringify({ role_id: requestedRoleId, email: empEmail }))
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

    // Soft-revoke: deactivate account AND set session_revoked_at so all existing JWTs are invalidated
    await pool.request()
      .input('userId', sql.Int, linkedUserId)
      .query(`
        UPDATE dbo.UserAccounts
        SET is_active = 0, session_revoked_at = SYSDATETIME(), updated_at = SYSDATETIME()
        WHERE user_id = @userId
      `);

    // Unlink from StaffProfiles (keep user_id row for AuditLogs FK preservation)
    await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`
        UPDATE dbo.StaffProfiles
        SET has_system_account = 0, user_id = NULL, updated_at = SYSDATETIME()
        WHERE staff_id = @staffId
      `);

    // Emit auth:session_revoked to the user's socket room
    try {
      const { getIO } = await import('../socket.js');
      const io = getIO();
      if (io) {
        io.to(`room:user:${linkedUserId}`).emit('auth:session_revoked', {
          reason: 'Your system access has been revoked by an administrator.',
          code: 'ACCESS_REVOKED',
        });
      }
    } catch (socketErr) {
      console.warn('[employeeController] revokeSystemAccess: socket emit failed:', socketErr.message);
    }

    // AuditLog
    await pool.request()
      .input('actorId',  sql.Int, req.user?.user_id || 1)
      .input('staffId',  sql.Int, staffId)
      .input('payload',  sql.NVarChar(sql.MAX), JSON.stringify({ revoked_user_id: linkedUserId, revoked_by: req.user?.email || 'System' }))
      .query(`
        INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
        VALUES (@actorId, N'REVOKE_SYSTEM_ACCESS', N'StaffProfiles', @staffId, @payload, SYSDATETIME())
      `);

    return res.json({ success: true, message: 'System access revoked. Employee session has been terminated.' });
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
      .input('reviewedBy',  sql.Int,          req.user?.user_id || 1)
      .query(`
        INSERT INTO dbo.PerformanceReviews (staff_id, rating, notes, reviewed_by, review_date, created_at)
        OUTPUT inserted.review_id, inserted.rating, inserted.review_date
        VALUES (@staffId, @rating, @notes, @reviewedBy, CAST(SYSDATETIME() AS DATE), SYSDATETIME())
      `);

    // AuditLog
    await pool.request()
      .input('actorId',  sql.Int, req.user?.user_id || 1)
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

// ─────────────────────────────────────────────────────────────
// POST /api/manager/employees/:id/deactivate & DELETE /api/manager/employees/:id
// Soft deactivates staff without deleting DB row, writes to AuditLogs inside transaction
// ─────────────────────────────────────────────────────────────
export const deactivateEmployee = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  if (!Number.isFinite(staffId)) {
    return res.status(400).json({ success: false, message: 'Invalid employee ID.' });
  }

  try {
    const pool = await getRawPool();

    // 1. Get linked user_id and current status
    const empResult = await pool.request()
      .input('staffId', sql.Int, staffId)
      .query(`SELECT user_id, full_name, employment_status FROM dbo.StaffProfiles WHERE staff_id = @staffId`);
    const employee = empResult.recordset[0];
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const linkedUserId = employee.user_id;
    const actorId = req.user?.user_id || req.user?.id || 1;

    // 2. Perform deactivation inside a transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Update StaffProfiles employment_status to 'Resigned'
      await transaction.request()
        .input('staffId', sql.Int, staffId)
        .query(`
          UPDATE dbo.StaffProfiles
          SET employment_status = N'Resigned', updated_at = SYSDATETIME()
          WHERE staff_id = @staffId
        `);

      // If linked user_id exists, set UserAccounts is_active = 0
      if (linkedUserId) {
        await transaction.request()
          .input('userId', sql.Int, linkedUserId)
          .query(`
            UPDATE dbo.UserAccounts
            SET is_active = 0, session_revoked_at = SYSDATETIME(), updated_at = SYSDATETIME()
            WHERE user_id = @userId
          `);
      }

      // Insert exactly 1 record into dbo.AuditLogs
      const payload = JSON.stringify({
        staff_id: staffId,
        linked_user_id: linkedUserId,
        previous_status: employee.employment_status,
        new_status: 'Resigned',
        deactivated_by: actorId,
        action: 'STAFF_DEACTIVATED'
      });

      await transaction.request()
        .input('actorId', sql.Int, actorId)
        .input('staffId', sql.Int, staffId)
        .input('payload', sql.NVarChar(sql.MAX), payload)
        .query(`
          INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
          VALUES (@actorId, N'STAFF_DEACTIVATED', N'StaffProfiles', @staffId, @payload, SYSDATETIME())
        `);

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    // Emit socket session revocation
    if (linkedUserId) {
      try {
        const { getIO } = await import('../socket.js');
        const io = getIO();
        if (io) {
          io.to(`room:user:${linkedUserId}`).emit('auth:session_revoked', {
            reason: 'Your account has been deactivated by an administrator.',
            code: 'ACCOUNT_DEACTIVATED',
          });
        }
      } catch (socketErr) {
        console.warn('[employeeController] deactivateEmployee: socket emit failed:', socketErr.message);
      }
    }

    return res.json({ success: true, message: 'Employee deactivated successfully.' });
  } catch (err) {
    console.error('[employeeController] deactivateEmployee error:', err);
    return res.status(500).json({ success: false, message: 'Failed to deactivate employee.' });
  }
};

export const deleteEmployee = deactivateEmployee;

