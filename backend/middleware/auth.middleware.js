/**
 * Globex Sky — auth.middleware.js
 * JWT authentication middleware: authenticate, requireRole,
 * requireVerified, and optionalAuth.
 */

import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production.');
}

const _JWT_SECRET = JWT_SECRET || 'globexsky-dev-secret-change-in-production';

// ─── authenticate ─────────────────────────────────────────────────────────────
/**
 * Verify Bearer JWT and attach the user + profile to req.user.
 * Returns 401 if the token is missing, invalid, or expired.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    // Prefer Supabase token verification when Supabase is configured
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        req.user = { ...user, profile: profile || {} };
        return next();
      }
    }

    // Fall back to custom JWT verification
    const decoded = jwt.verify(token, _JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token.' });
    }
    next(err);
  }
}

// ─── requireRole ──────────────────────────────────────────────────────────────
/**
 * Factory that returns middleware enforcing one or more allowed roles.
 * Must be used after `authenticate`.
 *
 * @param {...string} roles  Allowed role names (e.g. 'admin', 'supplier').
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.profile?.role || req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
}

// ─── requireVerified ──────────────────────────────────────────────────────────
/**
 * Require that the authenticated user's email is verified.
 * Must be used after `authenticate`.
 */
export function requireVerified(req, res, next) {
  const isVerified =
    req.user?.email_confirmed_at ||
    req.user?.profile?.email_verified ||
    req.user?.emailVerified;

  if (!isVerified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required. Please verify your email address.',
    });
  }
  next();
}

// ─── optionalAuth ─────────────────────────────────────────────────────────────
/**
 * Attach the user to req.user if a valid Bearer token is present,
 * but do NOT block the request if no token is provided.
 */
export async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split(' ')[1];

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        req.user = { ...user, profile: profile || {} };
        return next();
      }
    }

    const decoded = jwt.verify(token, _JWT_SECRET);
    req.user = decoded;
  } catch (_) {
    // Silently ignore — token absent or invalid is acceptable for optional auth
  }
  next();
}
