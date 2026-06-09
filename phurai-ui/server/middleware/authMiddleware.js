/**
 * Resolves the active user id for profile routes.
 * JWT/session can replace the dev fallbacks later without changing route handlers.
 */
export function resolveUserId(req, _res, next) {
  const headerId = req.headers["x-user-id"];
  const queryId = req.query.userId ?? req.query.user_id;
  const bodyId = req.body?.userId ?? req.body?.user_id;
  const authUserId = req.auth?.userId ?? req.auth?.user_id;

  const raw = authUserId ?? headerId ?? queryId ?? bodyId;
  const parsed = Number(raw);

  req.userId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
