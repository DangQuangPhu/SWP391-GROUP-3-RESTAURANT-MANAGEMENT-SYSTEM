import jwt from 'jsonwebtoken';
import pool from '../db.js';

export async function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed.' });
  }

  const token = header.slice(7);
  if (!token) {
    return res.status(401).json({ error: 'Token is empty.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      user_id:   decoded.user_id,
      role_id:   decoded.role_id,
      role_name: decoded.role_name,
      full_name: decoded.full_name,
      email:     decoded.email,
      iat:       decoded.iat,  // JWT issued-at timestamp (seconds)
    };

    if (!req.user.user_id || !req.user.role_id) {
      return res.status(401).json({ error: 'Token payload is invalid (missing user_id or role_id).' });
    }

    req.user.user_id = Number(req.user.user_id);
    req.user.role_id = Number(req.user.role_id);

    // Phase 2: Check if session was revoked after this token was issued.
    // If session_revoked_at > JWT.iat, the user was force-logged-out (e.g. access revoked by Manager/Admin).
    try {
      const [rows] = await pool.query(
        `SELECT is_active, session_revoked_at FROM dbo.UserAccounts WHERE user_id = ?`,
        [req.user.user_id]
      );
      if (rows.length === 0) {
        return res.status(401).json({ error: 'User account not found.', code: 'ACCOUNT_NOT_FOUND' });
      }
      const account = rows[0];
      if (!account.is_active) {
        return res.status(401).json({ error: 'Your account has been deactivated. Please contact your manager.', code: 'ACCOUNT_DEACTIVATED' });
      }
      if (account.session_revoked_at) {
        const revokedAtSec = Math.floor(new Date(account.session_revoked_at).getTime() / 1000);
        if (revokedAtSec > (req.user.iat || 0)) {
          return res.status(401).json({ error: 'Your session has been revoked. Please log in again.', code: 'SESSION_REVOKED' });
        }
      }
    } catch (dbErr) {
      // Non-fatal: if DB check fails, fall through (don't block authenticated requests on DB hiccup)
      console.warn('[authMiddleware] DB session check failed:', dbErr?.message);
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Token is invalid.' });
  }
}

export const requireRole = (...allowedRoleIds) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  if (!allowedRoleIds.includes(req.user.role_id)) {
    return res.status(403).json({
      error: `Access denied. Required role(s): ${allowedRoleIds.join(', ')}. Your role: ${req.user.role_id}.`
    });
  }
  next();
};

export const requireCustomer = requireRole(1);
export const requireStaff    = requireRole(2);
export const requireManager  = requireRole(3);
export const requireAdmin    = requireRole(4);
export const requireAny      = requireRole(1, 2, 3, 4);


export const verifyAdmin = (req, res, next) => {
  const role = req.user?.role_id;
  if (role === 4) {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Forbidden: Requires Admin role' });
  }
};
