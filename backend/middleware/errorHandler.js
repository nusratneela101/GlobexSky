/**
 * Global error handler — must be the last app.use() call.
 */
export function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV !== 'production';

  console.error(`[ErrorHandler] ${req.method} ${req.originalUrl} →`, err.message);

  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ success: false, error: err.message });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error.',
    ...(isDev && { stack: err.stack }),
  });
}

/** 404 handler for undefined routes */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found.`,
  });
}

/** Convenience: create an error with a status code */
export function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}
