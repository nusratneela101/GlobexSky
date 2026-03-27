/**
 * Globex Sky — auth-flow.js
 * Wires up the standalone login/register pages (pages/auth/login.html,
 * pages/auth/register.html) to the real backend auth endpoints via window.API.
 * Stores the JWT session in localStorage and redirects on success.
 */

(function () {
  'use strict';

  /* ─── Helpers ─────────────────────────────────────────────────────────── */

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
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = loading ? 'Please wait…' : btn.dataset.originalText;
  }

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || '/';
  }

  /* ─── Login Page ──────────────────────────────────────────────────────── */

  function initLoginPage() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const alertBox = form.querySelector('.auth-alert') ||
      document.getElementById('login-alert');
    const submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      const email = form.querySelector('[name="email"]')?.value.trim() || '';
      const password = form.querySelector('[name="password"]')?.value || '';

      if (!email || !password) {
        showAlert(alertBox, 'Please enter your email and password.', 'error');
        return;
      }

      setLoading(submitBtn, true);

      try {
        if (!window.API) throw new Error('API client not loaded.');
        const res = await window.API.auth.login(email, password);
        const { token, refresh_token, user } = res.data || res;
        const profile = (user && user.profile) || {};

        // Persist session (compatible with auth.js session format)
        const sessionData = { token, refresh_token: refresh_token || null };
        localStorage.setItem('globexSession', JSON.stringify(sessionData));

        const userData = {
          name: profile.full_name || (user && user.email && user.email.split('@')[0]) || 'User',
          email: (user && user.email) || email,
          avatar: profile.avatar_url || '',
          role: profile.role || 'buyer',
          id: user && user.id,
          loggedInAt: new Date().toISOString(),
        };
        localStorage.setItem('globexUser', JSON.stringify(userData));

        showAlert(alertBox, 'Login successful! Redirecting…', 'success');
        setTimeout(() => {
          window.location.href = getRedirectTarget();
        }, 800);
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

    const alertBox = form.querySelector('.auth-alert') ||
      document.getElementById('register-alert');
    const submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      // Support multiple naming conventions used across register form variants
      const name = (
        form.querySelector('[name="name"]') ||
        form.querySelector('[name="full-name"]') ||
        form.querySelector('[name="fullName"]')
      )?.value.trim() || '';
      const email = form.querySelector('[name="email"]')?.value.trim() || '';
      const password = form.querySelector('[name="password"]')?.value || '';
      const confirmPassword = (
        form.querySelector('[name="confirm_password"]') ||
        form.querySelector('[name="confirmPassword"]') ||
        form.querySelector('[name="confirm-password"]')
      )?.value || '';
      // Radio group "account-type" is used in the register page; fall back to "role" select
      const roleRadio = form.querySelector('[name="account-type"]:checked');
      const role = roleRadio?.value ||
        form.querySelector('[name="role"]')?.value ||
        'buyer';
      const country = form.querySelector('[name="country"]')?.value || '';

      // Client-side validation
      if (!name || name.length < 2) {
        showAlert(alertBox, 'Please enter your full name (at least 2 characters).', 'error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAlert(alertBox, 'Please enter a valid email address.', 'error');
        return;
      }
      if (password.length < 8) {
        showAlert(alertBox, 'Password must be at least 8 characters.', 'error');
        return;
      }
      if (confirmPassword && confirmPassword !== password) {
        showAlert(alertBox, 'Passwords do not match.', 'error');
        return;
      }
      if (!country) {
        showAlert(alertBox, 'Please select your country.', 'error');
        return;
      }

      setLoading(submitBtn, true);

      try {
        if (!window.API) throw new Error('API client not loaded.');
        await window.API.auth.register({ name, email, password, role, country });

        showAlert(
          alertBox,
          'Account created! Please check your email to verify your account.',
          'success'
        );
        form.reset();

        // Redirect to login after a short delay
        setTimeout(() => {
          const loginUrl = '/pages/auth/login.html?registered=1';
          window.location.href = loginUrl;
        }, 2000);
      } catch (err) {
        const msg = (err && err.message) || 'Registration failed. Please try again.';
        showAlert(alertBox, msg, 'error');
        setLoading(submitBtn, false);
      }
    });
  }

  /* ─── Forgot Password Page ────────────────────────────────────────────── */

  function initForgotPasswordPage() {
    // Support both id="forgot-password-form" (preferred) and id="forgotForm" (legacy)
    const form = document.getElementById('forgot-password-form') ||
      document.getElementById('forgotForm');
    if (!form) return;

    // Inject an alert container if one doesn't already exist
    let alertBox = form.querySelector('.auth-alert') ||
      document.getElementById('forgot-alert');
    if (!alertBox) {
      alertBox = document.createElement('div');
      alertBox.id = 'forgot-alert';
      alertBox.style.display = 'none';
      form.insertBefore(alertBox, form.firstChild);
    }

    const submitBtn = form.querySelector('[type="submit"]');

    // Prevent the legacy inline onsubmit from running
    form.removeAttribute('onsubmit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      // Support both name="email" and name="identifier" (legacy forgot-password form)
      const emailInput = form.querySelector('[name="email"]') ||
        form.querySelector('[name="identifier"]');
      const email = emailInput?.value.trim() || '';

      if (!email) {
        showAlert(alertBox, 'Please enter your email address.', 'error');
        return;
      }

      setLoading(submitBtn, true);

      try {
        if (!window.API) throw new Error('API client not loaded.');
        await window.API.auth.forgotPassword(email);
        showAlert(alertBox, 'If that email is registered, a password reset link has been sent. Please check your inbox.', 'success');
        form.reset();
      } catch (err) {
        const msg = (err && err.message) || 'Failed to send reset email. Please try again.';
        showAlert(alertBox, msg, 'error');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  /* ─── Reset Password Page ─────────────────────────────────────────────── */

  function initResetPasswordPage() {
    // Support both id="reset-password-form" (preferred) and id="resetForm" (legacy)
    const form = document.getElementById('reset-password-form') ||
      document.getElementById('resetForm');
    if (!form) return;

    // Inject an alert container if one doesn't already exist
    let alertBox = form.querySelector('.auth-alert') ||
      document.getElementById('reset-alert');
    if (!alertBox) {
      alertBox = document.createElement('div');
      alertBox.id = 'reset-alert';
      alertBox.style.display = 'none';
      form.insertBefore(alertBox, form.firstChild);
    }

    const submitBtn = form.querySelector('[type="submit"]');

    // Prevent the legacy inline onsubmit from running
    form.removeAttribute('onsubmit');

    // Extract the recovery token from the URL
    // Supabase may provide it as ?token_hash=… or in the hash fragment as #access_token=…
    function getResetToken() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('token_hash')) return params.get('token_hash');
      if (params.get('token')) return params.get('token');
      // Hash fragment fallback: #access_token=…&type=recovery
      const hash = new URLSearchParams(window.location.hash.substring(1));
      return hash.get('access_token') || null;
    }

    const token = getResetToken();
    if (!token) {
      showAlert(alertBox, 'Invalid or missing reset token. Please request a new password reset link.', 'error');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      const password = (
        form.querySelector('[name="newpw"]') ||
        form.querySelector('[name="password"]') ||
        form.querySelector('[name="new_password"]')
      )?.value || '';
      const confirmPassword = (
        form.querySelector('[name="confirmpw"]') ||
        form.querySelector('[name="confirm_password"]') ||
        form.querySelector('[name="confirmPassword"]')
      )?.value || '';

      if (password.length < 8) {
        showAlert(alertBox, 'Password must be at least 8 characters.', 'error');
        return;
      }
      if (confirmPassword && confirmPassword !== password) {
        showAlert(alertBox, 'Passwords do not match.', 'error');
        return;
      }

      setLoading(submitBtn, true);

      try {
        if (!window.API) throw new Error('API client not loaded.');
        await window.API.auth.resetPassword(token, password);
        showAlert(alertBox, 'Password reset successful! Redirecting to login…', 'success');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
      } catch (err) {
        const msg = (err && err.message) || 'Password reset failed. The link may have expired.';
        showAlert(alertBox, msg, 'error');
        setLoading(submitBtn, false);
      }
    });
  }

  /* ─── Show "registered" success message on login page ────────────────── */

  function checkRegisteredParam() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1') {
      const alertBox = document.getElementById('login-alert') ||
        document.querySelector('.auth-alert');
      showAlert(alertBox, 'Account verified! You can now sign in.', 'success');
    }
  }

  /* ─── Init ────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    initLoginPage();
    initRegisterPage();
    initForgotPasswordPage();
    initResetPasswordPage();
    checkRegisteredParam();
  });
})();
