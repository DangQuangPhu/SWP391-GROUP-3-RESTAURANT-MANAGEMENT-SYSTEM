import jwt from 'jsonwebtoken';
import pool from '../db.js';

/**
 * Resolves the active user id for profile and customer routes.
 * Decodes JWT token if provided in Authorization header, or uses fallbacks.
 */
export async function resolveUserId(req, _res, next) {
  let tokenUserId = null;
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      if (decoded && (decoded.user_id || decoded.userId || decoded.id)) {
        tokenUserId = decoded.user_id || decoded.userId || decoded.id;
      }
    } catch {
      // Token expired or invalid — ignore for resolveUserId so fallbacks can apply in dev
    }
  }

  const headerId = req.headers["x-user-id"];
  const queryId = req.query.userId ?? req.query.user_id;
  const bodyId = req.body?.userId ?? req.body?.user_id;
  const authUserId = req.auth?.userId ?? req.auth?.user_id;
  const reqUserId = req.user?.user_id ?? req.user?.userId ?? req.user?.id;

  const raw = tokenUserId ?? authUserId ?? headerId ?? queryId ?? bodyId ?? reqUserId;
  const parsed = Number(raw);

  if (Number.isFinite(parsed) && parsed > 0) {
    req.userId = parsed;
  } else {
    if (process.env.NODE_ENV !== "production") {
      const [[devCust]] = await pool.query("SELECT TOP 1 user_id FROM dbo.UserAccounts WHERE email = 'quagphu159@gmail.com' OR role_id = (SELECT role_id FROM dbo.Roles WHERE role_name = 'Customer') ORDER BY CASE WHEN email = 'quagphu159@gmail.com' THEN 0 ELSE 1 END");
      req.userId = devCust?.user_id || 1342;
    } else {
      req.userId = null;
    }
  }
  next();
}

export async function requireUserId(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Provide user id for local development.",
    });
  }
  return next();
}
