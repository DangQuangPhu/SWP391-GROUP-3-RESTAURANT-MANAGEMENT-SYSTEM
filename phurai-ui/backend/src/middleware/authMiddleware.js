import jwt from 'jsonwebtoken';

/**
 * Resolves the active user id for profile and customer routes.
 * Decodes JWT token if provided in Authorization header, or uses fallbacks.
 */
export function resolveUserId(req, _res, next) {
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
    // Development fallback so customer/profile local API calls do not throw 401
    req.userId = process.env.NODE_ENV !== "production" ? 1222 : null;
  }
  next();
}

export function requireUserId(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Provide user id for local development.",
    });
  }
  return next();
}
