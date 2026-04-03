/**
 * Globex Sky — csrf.js
 * Simple stateless CSRF protection using double-submit cookie pattern.
 *
 * - GET /api/v1/csrf/token  → returns a CSRF token (set as cookie + JSON)
 * - On state-changing requests (POST/PUT/PATCH/DELETE) the middleware
 *   validates the X-CSRF-Token header matches the csrf_token cookie.
 *
 * Exceptions: authentication endpoints and API key authenticated requests.
 */

import crypto from 'crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const TOKEN_BYTES = 32;

/** Generate a new CSRF token */
export function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Express middleware: validate CSRF token on state-changing requests.
 * Skips: GET, HEAD, OPTIONS and API-key authenticated requests.
 */
export function csrfProtect(req, res, next) {
  const method = req.method.toUpperCase();

  // Safe methods — no CSRF check needed
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

  // Bearer token authenticated requests are exempt (browsers don't auto-send Bearer tokens)
  if (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')) return next();

  // API platform requests authenticated with X-API-Key header are exempt
  if (req.headers['x-api-key']) return next();

  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ success: false, error: 'CSRF token missing.' });
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(headerToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ success: false, error: 'CSRF token invalid.' });
    }
  } catch {
    return res.status(403).json({ success: false, error: 'CSRF token invalid.' });
  }

  next();
}

/**
 * Express route handler: issue a new CSRF token.
 * Sets httpOnly=false so JS can read and resend via header.
 */
export function issueCsrfToken(req, res) {
  const token = generateToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,          // JS needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    path: '/',
  });
  res.json({ success: true, data: { token } });
}
