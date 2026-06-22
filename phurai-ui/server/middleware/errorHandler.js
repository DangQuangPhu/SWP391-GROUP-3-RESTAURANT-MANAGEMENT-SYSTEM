export function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred.';

  console.error('[ERROR]', {
    timestamp:  new Date().toISOString(),
    method:     req.method,
    url:        req.originalUrl,
    userId:     req.user?.user_id || 'unauthenticated',
    status,
    message,
    stack:      err.stack,
  });

  if (err.code === 'EREQUEST' || err.number) {
    const sqlNum = err.number || 0;
    if (sqlNum === 2627 || sqlNum === 2601) {
      return res.status(409).json({ error: 'Duplicate entry. This record already exists.' });
    }
    if (sqlNum === 547) {
      return res.status(400).json({ error: 'Referenced record does not exist.' });
    }
    if (sqlNum === 515 || sqlNum === 245) {
      return res.status(400).json({ error: 'Invalid data type or missing required field.' });
    }
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }

  return res.status(status).json({
    error:  message,
    detail: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}

export function createError(status, message) {
  const err    = new Error(message);
  err.status   = status;
  return err;
}
