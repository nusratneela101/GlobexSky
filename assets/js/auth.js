/**
 * GlobexSky - auth.js
 * Authentication modal management: login, register, mock session,
 * social login placeholders, form validation, and navbar UI updates.
 *
 * NOTE: This is a frontend-only mock. No real credentials are transmitted.
 * Replace mock functions with real API calls for production.
 */

const AUTH_KEY = 'globexUser';

/* ─────────────────────────────────────────────
   SESSION HELPERS
───────────────────────────────────────────── */

/**
 * Return the currently "logged-in" user from localStorage, or null.
 * @returns {{ name: string, email: string, avatar: string } | null}
 */
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
  } catch (_) {
    return null;
  }
}

/** Persist a user object to localStorage. */
function saveUser(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

/** Remove the user session from localStorage. */
function clearUser() {
  localStorage.removeItem(AUTH_KEY);
}

/* ─────────────────────────────────────────────
   NAVBAR UI
───────────────────────────────────────────── */

/**
 * Update the navbar to reflect the current auth state.
 * Shows user avatar + name when logged in, auth buttons when logged out.
 */
function updateNavUI() {
  const user = getCurrentUser();

  // Elements that are only visible when logged OUT
  document.querySelectorAll('.auth-logged-out, [data-auth="logged-out"]').forEach((el) => {
    el.style.display = user ? 'none' : '';
  });

  // Elements that are only visible when logged IN
  document.querySelectorAll('.auth-logged-in, [data-auth="logged-in"]').forEach((el) => {
    el.style.display = user ? '' : 'none';
  });

  if (user) {
    // Populate user avatar
    document.querySelectorAll('.user-avatar, [data-user-avatar]').forEach((el) => {
      if (el.tagName === 'IMG') {
        el.src = user.avatar || generateInitialsAvatar(user.name);
        el.alt = user.name;
      } else {
        el.textContent = user.name.charAt(0).toUpperCase();
      }
    });

    // Populate user display name
    document.querySelectorAll('.user-display-name, [data-user-name]').forEach((el) => {
      el.textContent = user.name;
    });

    // Populate user email
    document.querySelectorAll('.user-display-email, [data-user-email]').forEach((el) => {
      el.textContent = user.email;
    });
  }
}

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
  ctx.fillStyle = '#1a73e8';
  ctx.fillRect(0, 0, 48, 48);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 24, 24);
  return canvas.toDataURL();
}

/* ─────────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────────── */
function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
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
  if (!modal) return;
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

  const emailField = form.querySelector('[name="email"], input[type="email"]');
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

  const nameField = form.querySelector('[name="name"]');
  const emailField = form.querySelector('[name="email"], input[type="email"]');
  const passwordField = form.querySelector('[name="password"], input[type="password"]');
  const confirmField = form.querySelector('[name="confirm_password"], [name="confirmPassword"]');

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
   MOCK LOGIN / LOGOUT
───────────────────────────────────────────── */

/**
 * Simulate a login by storing a mock user in localStorage.
 * @param {string} email
 * @param {string} _password - Not stored; included for API parity.
 */
function mockLogin(email, _password) {
  const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const user = {
    name,
    email: email.trim().toLowerCase(),
    avatar: '',
    loggedInAt: new Date().toISOString(),
  };
  saveUser(user);
  updateNavUI();
  closeLoginModal();

  if (window.GlobexSky?.showToast) {
    window.GlobexSky.showToast(`Welcome back, ${user.name}!`, 'success');
  }
}

/**
 * Simulate registration and auto-login.
 * @param {string} name
 * @param {string} email
 */
function mockRegister(name, email) {
  const user = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    avatar: '',
    registeredAt: new Date().toISOString(),
  };
  saveUser(user);
  updateNavUI();
  closeRegisterModal();

  if (window.GlobexSky?.showToast) {
    window.GlobexSky.showToast(`Account created! Welcome, ${user.name}!`, 'success');
  }
}

/** Log out the current user. */
function logout() {
  const user = getCurrentUser();
  clearUser();
  updateNavUI();

  if (window.GlobexSky?.showToast) {
    window.GlobexSky.showToast('You have been logged out.', 'info');
  }

  // Redirect to home if on a protected page
  const protectedPaths = ['/pages/account/', '/pages/admin/'];
  if (protectedPaths.some((p) => window.location.pathname.startsWith(p))) {
    window.location.href = '/';
  }
}

/* ─────────────────────────────────────────────
   SOCIAL LOGIN PLACEHOLDERS
───────────────────────────────────────────── */
function handleSocialLogin(provider) {
  // Placeholder — replace with real OAuth flow
  console.info(`[GlobexSky Auth] Social login with ${provider} is not yet configured.`);
  if (window.GlobexSky?.showToast) {
    window.GlobexSky.showToast(`${provider} login coming soon!`, 'info');
  }
}

/* ─────────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────────── */
function initAuthEvents() {
  // Open login modal
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="open-login"], .btn-login, [data-modal-open="login-modal"]')) {
      e.preventDefault();
      openLoginModal();
    }

    // Open register modal
    if (e.target.closest('[data-action="open-register"], .btn-register, [data-modal-open="register-modal"]')) {
      e.preventDefault();
      openRegisterModal();
    }

    // Switch from login → register
    if (e.target.closest('[data-action="switch-to-register"]')) {
      e.preventDefault();
      closeLoginModal();
      openRegisterModal();
    }

    // Switch from register → login
    if (e.target.closest('[data-action="switch-to-login"]')) {
      e.preventDefault();
      closeRegisterModal();
      openLoginModal();
    }

    // Close modals
    if (e.target.closest('[data-modal-close="login-modal"], .login-modal-close')) {
      closeLoginModal();
    }
    if (e.target.closest('[data-modal-close="register-modal"], .register-modal-close')) {
      closeRegisterModal();
    }

    // Click outside modal
    if (e.target.id === 'login-modal') closeLoginModal();
    if (e.target.id === 'register-modal') closeRegisterModal();

    // Logout
    if (e.target.closest('[data-action="logout"], .btn-logout')) {
      e.preventDefault();
      logout();
    }

    // Social login buttons
    const socialBtn = e.target.closest('[data-social-login]');
    if (socialBtn) {
      e.preventDefault();
      handleSocialLogin(socialBtn.dataset.socialLogin);
    }
  });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLoginModal();
      closeRegisterModal();
    }
  });

  // Login form submit
  const loginForm = document.getElementById('login-form') || document.querySelector('.login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateLoginForm(loginForm)) return;

      const email = loginForm.querySelector('[name="email"], input[type="email"]')?.value || '';
      const password = loginForm.querySelector('[name="password"]')?.value || '';
      mockLogin(email, password);
    });
  }

  // Register form submit
  const registerForm = document.getElementById('register-form') || document.querySelector('.register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateRegisterForm(registerForm)) return;

      const name = registerForm.querySelector('[name="name"]')?.value || '';
      const email = registerForm.querySelector('[name="email"], input[type="email"]')?.value || '';
      mockRegister(name, email);
    });
  }

  // Real-time validation feedback (clear error on input)
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
  // Restore session and update UI on every page load
  updateNavUI();
  initAuthEvents();
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
  logout,
  updateNavUI,
});
