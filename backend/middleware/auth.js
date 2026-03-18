import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';

/**
 * Verify Supabase JWT and attach user to req.user.
 * Supports both Supabase-issued JWTs and custom JWTs.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify via Supabase (preferred) — validates the token and returns the user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }

    // Attach profile data (role, etc.)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    req.user = { ...user, profile };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication — attaches user if token present, but doesn't block.
 */
export async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      req.user = { ...user, profile };
    }
  } catch (_) {
    // Silently ignore
  }
  next();
}
