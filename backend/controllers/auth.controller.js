import supabase from '../config/supabase.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.service.js';

/** POST /api/v1/auth/register */
export async function register(req, res, next) {
  try {
    const { email, password, name, role = 'buyer' } = req.body;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: name, role },
    });

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Create profile record — kyc_status starts as 'pending' for all new users
    // requireKYC middleware (backend/middleware/requireKyc.js) can gate routes that
    // need a verified identity before proceeding (e.g. high-value orders).
    await supabase.from('profiles').insert({
      user_id: data.user.id,
      full_name: name,
      role,
      kyc_status: 'pending',
    });

    await sendWelcomeEmail(email, name).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: { user_id: data.user.id, email },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/login */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    res.json({
      success: true,
      data: {
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { ...data.user, profile },
      },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/logout */
export async function logout(req, res, next) {
  try {
    await supabase.auth.admin.signOut(req.headers.authorization?.split(' ')[1]);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/forgot-password */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/pages/auth/reset-password.html`,
    });
    // Always respond with success to prevent email enumeration
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/reset-password */
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const { error } = await supabase.auth.admin.updateUserById(token, { password });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/auth/me */
export async function getMe(req, res) {
  res.json({ success: true, data: { user: req.user } });
}

/** POST /api/v1/auth/verify-email */
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'email' });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/auth/kyc-status — return the KYC status for the authenticated user */
export async function getKYCStatus(req, res, next) {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('kyc_status')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.', data: null });
    }

    res.json({
      success: true,
      message: 'KYC status retrieved.',
      data: { kyc_status: profile.kyc_status || 'pending' },
    });
  } catch (err) {
    next(err);
  }
}
