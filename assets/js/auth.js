/**
 * Globex Sky - auth.js
 * Real Supabase authentication: login, register, logout, navbar UI.
 *
 * Depends on:
 *   - Supabase CDN: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   - assets/js/config.js (initializes window.supabaseClient)
 */

/* ─────────────────────────────────────────────
   SUPABASE CLIENT
───────────────────────────────────────────── */

function _getSupabaseClient() {
  return window.supabaseClient ||
    (window.supabase && window.supabase.createClient &&
      window.supabase.createClient(
        'https://czpqbdkarwdvrnhtvysd.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E'
      ));
}

/* ─────────────────────────────────────────────
   SESSION HELPERS
───────────────────────────────────────────── */

/**
 * Return the currently logged-in Supabase user from localStorage, or null.
 * @returns {object|null}
 */
function getCurrentUser() {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const sess = JSON.parse(localStorage.getItem(key) || 'null');
        if (sess && sess.user) return sess.user;
      }
    }
  } catch (_) { }
  return null;
}

/* ─────────────────────────────────────────────
   NAVBAR UI
───────────────────────────────────────────── */

/** Generate a simple data-URI avatar from the user's initials. */
function generateInitialsAvatar(name = '') {
  const initials = name
    .split(' ')
    .map((w) => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0052CC';
  ctx.fillRect(0, 0, 48, 48);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 24, 24);
  return canvas.toDataURL();
}

/**
 * Update the navbar to reflect the current auth state.
 */
function updateNavUI() {
  const sb = _getSupabaseClient();
  const syncUI = (user) => {
    // Elements visible when logged out
    document.querySelectorAll('.auth-logged-out, [data-auth="logged-out"]').forEach((el) => {
      el.style.display = user ? 'none' : '';
    });
    // Elements visible when logged in
    document.querySelectorAll('.auth-logged-in, [data-auth="logged-in"]').forEach((el) => {
      el.style.display = user ? '' : 'none';
    });

    if (user) {
      const name = (user.user_metadata && user.user_metadata.name) || user.email.split('@')[0];
      // Avatar
      document.querySelectorAll('.user-avatar, [data-user-avatar]').forEach((el) => {
        if (el.tagName === 'IMG') {
          el.src = generateInitialsAvatar(name);
          el.alt = name;
        } else {
          el.textContent = name.charAt(0).toUpperCase();
        }
      });
      // Display name
      document.querySelectorAll('.user-display-name, [data-user-name]').forEach((el) => {
        el.textContent = name;
      });
      // Email
      document.querySelectorAll('.user-display-email, [data-user-email]').forEach((el) => {
        el.textContent = user.email;
      });
    }
  };

  // Use async Supabase getUser for accurate state
  if (sb) {
    sb.auth.getUser().then(({ data }) => syncUI(data && data.user)).catch(() => syncUI(null));
  } else {
    syncUI(getCurrentUser());
  }
}

/* ─────────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────────── */
function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (!modal) {
    // No inline modal — fall back to the dedicated login page
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = '/pages/auth/login.html?redirect=' + redirect;
    return;
  }
  document.getElementById('register-modal')?.classList.remove('modal-open');
  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-active');
  clearFormErrors(modal);
  modal.querySelector('input[type="email"], input[name="email"]')?.focus();
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  modal.classList.remove('modal-open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-open')) document.body.classList.remove('modal-active');
}

function openRegisterModal() {
  const modal = document.getElementById('register-modal');
  if (!modal) {
    // No inline modal — fall back to the dedicated register page
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = '/pages/auth/register.html?redirect=' + redirect;
    return;
  }
  document.getElementById('login-modal')?.classList.remove('modal-open');
  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-active');
  clearFormErrors(modal);
  modal.querySelector('input[name="name"], input[type="text"]')?.focus();
}

function closeRegisterModal() {
  const modal = document.getElementById('register-modal');
  if (!modal) return;
  modal.classList.remove('modal-open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-open')) document.body.classList.remove('modal-active');
}

/* ─────────────────────────────────────────────
   FORM VALIDATION
───────────────────────────────────────────── */
function clearFormErrors(form) {
  form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('.input-error').forEach((el) => el.classList.remove('input-error'));
}

function showFieldError(field, message) {
  field.classList.add('input-error');
  const errorEl =
    field.nextElementSibling?.classList.contains('field-error')
      ? field.nextElementSibling
      : field.closest('.form-group')?.querySelector('.field-error');
  if (errorEl) errorEl.textContent = message;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateLoginForm(form) {
  let valid = true;
  clearFormErrors(form);
  const emailField    = form.querySelector('[name="email"], input[type="email"]');
  const passwordField = form.querySelector('[name="password"], input[type="password"]');
  if (emailField && !validateEmail(emailField.value.trim())) {
    showFieldError(emailField, 'Please enter a valid email address.');
    valid = false;
  }
  if (passwordField && passwordField.value.length < 6) {
    showFieldError(passwordField, 'Password must be at least 6 characters.');
    valid = false;
  }
  return valid;
}

function validateRegisterForm(form) {
  let valid = true;
  clearFormErrors(form);
  const nameField     = form.querySelector('[name="name"]');
  const emailField    = form.querySelector('[name="email"], input[type="email"]');
  const passwordField = form.querySelector('[name="password"], input[type="password"]');
  const confirmField  = form.querySelector('[name="confirm_password"], [name="confirmPassword"]');
  if (nameField && nameField.value.trim().length < 2) {
    showFieldError(nameField, 'Please enter your full name (min 2 characters).');
    valid = false;
  }
  if (emailField && !validateEmail(emailField.value.trim())) {
    showFieldError(emailField, 'Please enter a valid email address.');
    valid = false;
  }
  if (passwordField && passwordField.value.length < 6) {
    showFieldError(passwordField, 'Password must be at least 6 characters.');
    valid = false;
  }
  if (confirmField && passwordField && confirmField.value !== passwordField.value) {
    showFieldError(confirmField, 'Passwords do not match.');
    valid = false;
  }
  return valid;
}

/* ─────────────────────────────────────────────
   SUPABASE LOGIN / REGISTER / LOGOUT
───────────────────────────────────────────── */

/**
 * Sign in with Supabase Auth.
 * Stores the Supabase access token as 'globexToken' so GlobexAPI can use it.
 * @param {string} email
 * @param {string} password
 */
async function login(email, password) {
  const sb = _getSupabaseClient();
  if (!sb) throw new Error('Supabase client not initialized. Please include the Supabase CDN script.');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  // Store the access token so GlobexAPI / ApiService can include it in requests
  if (data && data.session && data.session.access_token) {
    localStorage.setItem('globexToken', data.session.access_token);
  }
  return data;
}

/**
 * Register a new account with Supabase Auth.
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {string} [role]
 * @param {string} [country]
 */
async function register(name, email, password, role = 'buyer', country = '') {
  const sb = _getSupabaseClient();
  if (!sb) throw new Error('Supabase client not initialized. Please include the Supabase CDN script.');
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { name: name || email.split('@')[0], role, country } },
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Log out the current user. */
async function logout() {
  const sb = _getSupabaseClient();
  if (sb) await sb.auth.signOut();
  // Clear globexToken set on login
  localStorage.removeItem('globexToken');
  updateNavUI();
  closeLoginModal();
}

/* ─────────────────────────────────────────────
   MODAL EVENT HANDLERS (for inline modal usage)
───────────────────────────────────────────── */

async function handleModalLogin(email, password) {
  try {
    await login(email, password);
    const user = getCurrentUser();
    const name = (user && user.user_metadata && user.user_metadata.name) || (user && user.email && user.email.split('@')[0]) || 'User';
    updateNavUI();
    closeLoginModal();
    if (window.GlobexSky?.showToast) window.GlobexSky.showToast(`Welcome back, ${name}!`, 'success');
  } catch (err) {
    const msg = err.message || 'Login failed. Please check your credentials.';
    if (window.GlobexSky?.showToast) window.GlobexSky.showToast(msg, 'error');
  }
}

async function handleModalRegister(name, email, password, role = 'buyer', country = '') {
  try {
    await register(name, email, password, role, country);
    closeRegisterModal();
    if (window.GlobexSky?.showToast) {
      window.GlobexSky.showToast('Account created! Please check your email to verify your account.', 'success');
    }
  } catch (err) {
    const msg = err.message || 'Registration failed. Please try again.';
    if (window.GlobexSky?.showToast) window.GlobexSky.showToast(msg, 'error');
  }
}

/* ─────────────────────────────────────────────
   EVENT WIRING
───────────────────────────────────────────── */
function initAuthEvents() {
  document.addEventListener('click', (e) => {
    // Open modals
    if (e.target.closest('[data-modal-open="login-modal"], .btn-login, [data-action="login"]')) {
      e.preventDefault();
      openLoginModal();
    }
    if (e.target.closest('[data-modal-open="register-modal"], .btn-register, [data-action="register"]')) {
      e.preventDefault();
      openRegisterModal();
    }
    // Switch between modals
    if (e.target.closest('[data-modal-open="register-modal"]')) {
      e.preventDefault();
      closeLoginModal();
      openRegisterModal();
    }
    if (e.target.closest('[data-modal-open="login-modal"]')) {
      e.preventDefault();
      closeRegisterModal();
      openLoginModal();
    }
    // Close modals
    if (e.target.closest('[data-modal-close="login-modal"], .login-modal-close')) closeLoginModal();
    if (e.target.closest('[data-modal-close="register-modal"], .register-modal-close')) closeRegisterModal();
    if (e.target.id === 'login-modal') closeLoginModal();
    if (e.target.id === 'register-modal') closeRegisterModal();
    // Logout
    if (e.target.closest('[data-action="logout"], .btn-logout')) {
      e.preventDefault();
      logout();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeLoginModal(); closeRegisterModal(); }
  });

  // Login form submit
  const loginForm = document.getElementById('login-form') || document.querySelector('.login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateLoginForm(loginForm)) return;
      const email    = loginForm.querySelector('[name="email"], input[type="email"]')?.value || '';
      const password = loginForm.querySelector('[name="password"]')?.value || '';
      handleModalLogin(email, password);
    });
  }

  // Register form submit
  const registerForm = document.getElementById('register-form') || document.querySelector('.register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateRegisterForm(registerForm)) return;
      const name     = registerForm.querySelector('[name="name"]')?.value || '';
      const email    = registerForm.querySelector('[name="email"], input[type="email"]')?.value || '';
      const password = registerForm.querySelector('[name="password"]')?.value || '';
      const role     = registerForm.querySelector('[name="role"]')?.value || 'buyer';
      const country  = registerForm.querySelector('[name="country"]')?.value || '';
      handleModalRegister(name, email, password, role, country);
    });
  }

  // Clear errors on input
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('input-error')) {
      e.target.classList.remove('input-error');
      const errorEl = e.target.nextElementSibling;
      if (errorEl?.classList.contains('field-error')) errorEl.textContent = '';
    }
  });
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  updateNavUI();
  initAuthEvents();

  // Listen for Supabase auth state changes
  const sb = _getSupabaseClient();
  if (sb) {
    sb.auth.onAuthStateChange(() => updateNavUI());
  }
});

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};
Object.assign(window.GlobexSky, {
  openLoginModal,
  closeLoginModal,
  openRegisterModal,
  closeRegisterModal,
  getCurrentUser,
  login,
  register,
  logout,
  updateNavUI,
});
