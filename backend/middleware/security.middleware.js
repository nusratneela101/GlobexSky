/**
 * Globex Sky — security.middleware.js
 * Centralised security layer: Helmet CSP/HSTS, rate limiting, CORS,
 * XSS sanitisation, request size limits, IP blocking, and access logging.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Ensure logs directory exists ────────────────────────────────────────────
const logsDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });

// ─── Known bad IPs (in-memory blocklist) ─────────────────────────────────────
const blockedIPs = new Set(
  (process.env.BLOCKED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean)
);

// ─── Helmet: HTTP security headers ───────────────────────────────────────────
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      // Allow inline scripts only in development; production should use nonces/hashes
      scriptSrc:      process.env.NODE_ENV === 'production'
        ? ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com']
        : ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc:         ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc:     ["'self'", process.env.FRONTEND_URL, 'wss:'].filter(Boolean),
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard:           { action: 'deny' },
  xssFilter:            true,
  noSniff:              true,
  referrerPolicy:       { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
});

// ─── CORS configuration ───────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_WWW,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
});

// ─── Rate limiters ────────────────────────────────────────────────────────────

/** Global: 100 requests per 15 min per IP */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

/** Auth routes: 10 requests per 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

/** API routes: 200 requests per 15 min per IP */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'API rate limit exceeded. Please try again later.' },
});

// ─── IP blocker middleware ────────────────────────────────────────────────────
export function ipBlocker(req, res, next) {
  const clientIP = req.ip || req.socket?.remoteAddress;
  if (clientIP && blockedIPs.has(clientIP)) {
    return res.status(403).json({ success: false, error: 'Access denied.' });
  }
  next();
}

// ─── XSS sanitisation — strip dangerous characters from string values ─────────
function sanitiseString(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function sanitiseObject(obj) {
  if (obj === null || typeof obj !== 'object') return sanitiseString(obj);
  if (Array.isArray(obj)) return obj.map(sanitiseObject);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, sanitiseObject(v)])
  );
}

export function xssSanitiser(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitiseObject(req.body);
  }
  next();
}

// ─── Request logger ────────────────────────────────────────────────────────────
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms ${req.ip}\n`;
    accessLogStream.write(line);
  });
  next();
}

// ─── Apply all security middleware to an Express app ─────────────────────────
export function applySecurityMiddleware(app) {
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(ipBlocker);
  app.use(requestLogger);
  app.use(globalLimiter);
  app.use(xssSanitiser);

  // Tighter body-size limits handled via express.json/urlencoded in server.js
}
