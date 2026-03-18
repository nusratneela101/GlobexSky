import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 min
const max = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;

/** Global limiter applied to all routes */
export const globalRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

/** Stricter limiter for auth endpoints */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts. Please try again in 15 minutes.' },
});

/** Limiter for upload endpoints */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Upload rate limit exceeded.' },
});
