/**
 * Globex Sky — auth-flow.js
 * Wires up standalone login/register pages to Supabase Auth.
 * Stores the Supabase session and redirects on success.
 *
 * Depends on:
 *   - Supabase CDN: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   - assets/js/config.js (initializes window.supabaseClient)
 */

(function () {
  'use strict';

  function _sb() {
    return window.supabaseClient ||
      (window.supabase && window.supabase.createClient &&
        window.supabase.createClient(
          'https://czpqbdkarwdvrnhtvysd.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E'
        ));
  }

  /* ─── Helpers ──────────────────────────────────────────────────────────── */

  function showAlert(container, message, type) {
    if (!container) return;
    container.className = `auth-alert auth-alert--${type}`;
    container.textContent = message;
    container.style.display = 'block';
    container.setAttribute('role', 'alert');
  }

  function hideAlert(container) {
    if (!container) return;
    container.style.display = 'none';
    container.textContent = '';
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.originalText = btn.dataset.originalText || btn.innerHTML;
    btn.innerHTML = loading
      ? '<i class="fas fa-spinner fa-spin"></i> Please wait…'
      : btn.dataset.originalText;
  }

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    // Only allow relative paths (must start with / and not contain //)
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return redirect;
    }
    return '/index.html';
  }

  /* ─── Login Page ──────────────────────────────────────────────────────── */

  function initLoginPage() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const alertBox  = form.querySelector('.auth-alert') || document.getElementById('login-alert');
    const submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      const email    = form.querySelector('[name="email"]')?.value.trim() || '';
      const password = form.querySelector('[name="password"]')?.value     || '';

      if (!email || !password) {
        showAlert(alertBox, 'Please enter your email and password.', 'error');
        return;
      }

      setLoading(submitBtn, true);

      try {
        const sb = _sb();
        if (!sb) throw new Error('Supabase client not available. Please include the CDN script.');

        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);

        showAlert(alertBox, 'Login successful! Redirecting…', 'success');
        setTimeout(() => { window.location.href = getRedirectTarget(); }, 800);
      } catch (err) {
        const msg = (err && err.message) || 'Login failed. Please check your credentials.';
        showAlert(alertBox, msg, 'error');
        setLoading(submitBtn, false);
      }
    });
  }

  /* ─── Register Page ───────────────────────────────────────────────────── */

  function initRegisterPage() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const alertBox  = form.querySelector('.auth-alert') || document.getElementById('register-alert');
    const submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      const name     = form.querySelector('[name="name"], [name="full_name"]')?.value.trim() || '';
      const email    = form.querySelector('[name="email"]')?.value.trim()    || '';
      const password = form.querySelector('[name="password"]')?.value        || '';
      const role     = form.querySelector('[name="role"]')?.value            || 'buyer';
      const country  = form.querySelector('[name="country"]')?.value         || '';

      if (!name || !email || !password) {
        showAlert(alertBox, 'Please fill in all required fields.', 'error');
        return;
      }
      if (password.length < 6) {
        showAlert(alertBox, 'Password must be at least 6 characters.', 'error');
        return;
      }

      setLoading(submitBtn, true);

      try {
        const sb = _sb();
        if (!sb) throw new Error('Supabase client not available. Please include the CDN script.');

        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { name, role, country } },
        });
        if (error) throw new Error(error.message);

        showAlert(alertBox, 'Account created! Please check your email to verify your account.', 'success');
        setLoading(submitBtn, false);
      } catch (err) {
        const msg = (err && err.message) || 'Registration failed. Please try again.';
        showAlert(alertBox, msg, 'error');
        setLoading(submitBtn, false);
      }
    });
  }

  /* ─── Forgot Password Page ────────────────────────────────────────────── */

  function initForgotPasswordPage() {
    const form = document.getElementById('forgot-password-form');
    if (!form) return;

    const alertBox  = form.querySelector('.auth-alert') || document.getElementById('forgot-alert');
    const submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      const email = form.querySelector('[name="email"]')?.value.trim() || '';
      if (!email) {
        showAlert(alertBox, 'Please enter your email address.', 'error');
        return;
      }

      setLoading(submitBtn, true);

      try {
        const sb = _sb();
        if (!sb) throw new Error('Supabase client not available.');

        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/pages/auth/reset-password.html',
        });
        if (error) throw new Error(error.message);

        showAlert(alertBox, 'Password reset email sent! Please check your inbox.', 'success');
        setLoading(submitBtn, false);
      } catch (err) {
        showAlert(alertBox, err.message || 'Failed to send reset email.', 'error');
        setLoading(submitBtn, false);
      }
    });
  }

  /* ─── Reset Password Page ─────────────────────────────────────────────── */

  function initResetPasswordPage() {
    const form = document.getElementById('reset-password-form');
    if (!form) return;

    const alertBox  = form.querySelector('.auth-alert') || document.getElementById('reset-alert');
    const submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      const password = form.querySelector('[name="password"]')?.value || '';
      if (password.length < 6) {
        showAlert(alertBox, 'Password must be at least 6 characters.', 'error');
        return;
      }

      setLoading(submitBtn, true);

      try {
        const sb = _sb();
        if (!sb) throw new Error('Supabase client not available.');

        const { error } = await sb.auth.updateUser({ password });
        if (error) throw new Error(error.message);

        showAlert(alertBox, 'Password updated successfully! Redirecting to login…', 'success');
        setTimeout(() => { window.location.href = '/pages/auth/login.html'; }, 1500);
      } catch (err) {
        showAlert(alertBox, err.message || 'Failed to update password.', 'error');
        setLoading(submitBtn, false);
      }
    });
  }

  /* ─── Init ────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    initLoginPage();
    initRegisterPage();
    initForgotPasswordPage();
    initResetPasswordPage();
  });

})();
