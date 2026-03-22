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

/** Rate limiter for AI endpoints (chatbot, search, recommendations) */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute window
  max: parseInt(process.env.AI_RATE_LIMIT_MAX, 10) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'AI request rate limit exceeded. Please wait before sending more requests.' },
});

/** Stricter limiter for AI chatbot to prevent abuse */
export const chatbotRateLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute window
  max: parseInt(process.env.CHATBOT_RATE_LIMIT_MAX, 10) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Chatbot rate limit exceeded. Please wait before sending more messages.' },
});
