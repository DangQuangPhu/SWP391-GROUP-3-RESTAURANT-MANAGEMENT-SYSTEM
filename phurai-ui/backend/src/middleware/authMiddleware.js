/**
 * Resolves the active user id for profile routes.
 * JWT/session can replace the dev fallbacks later without changing route handlers.
 */
export function resolveUserId(req, _res, next) {
  const headerId = req.headers["x-user-id"];
  const queryId = req.query.userId ?? req.query.user_id;
  const bodyId = req.body?.userId ?? req.body?.user_id;
  const authUserId = req.auth?.userId ?? req.auth?.user_id;
  const reqUserId = req.user?.user_id ?? req.user?.userId ?? req.user?.id;

  const raw = authUserId ?? headerId ?? queryId ?? bodyId ?? reqUserId;
  const parsed = Number(raw);

  if (Number.isFinite(parsed) && parsed > 0) {
    req.userId = parsed;
  } else {
    // Development fallback so staff/manager local API calls do not throw 401
    req.userId = process.env.NODE_ENV !== "production" ? 1 : null;
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
