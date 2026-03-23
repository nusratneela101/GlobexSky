/**
 * social-auth.js — Google & Facebook OAuth login for Globex Sky
 *
 * Expects the following global constants to be defined BEFORE this script:
 *   window.GOOGLE_CLIENT_ID  — Google OAuth Client ID
 *   window.FACEBOOK_APP_ID   — Facebook App ID
 *   window.API_BASE_URL      — Backend API base URL (e.g. https://api.globexsky.com/api/v1)
 */

(function () {
  'use strict';

  /* ─── Config ──────────────────────────────────────────────────────────────── */
  const API_BASE = window.API_BASE_URL || 'https://api.globexsky.com/api/v1';
  const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || '';
  const FACEBOOK_APP_ID = window.FACEBOOK_APP_ID || '';
  const REDIRECT_AFTER_LOGIN = window.SOCIAL_AUTH_REDIRECT || '../../index.html';

  /* ─── Helpers ─────────────────────────────────────────────────────────────── */

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
  }

  function showToast(message, type) {
    let toast = document.querySelector('.social-auth-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'social-auth-toast';
      const socialBtns = document.querySelector('.social-btns');
      if (socialBtns) {
        socialBtns.parentNode.insertBefore(toast, socialBtns);
      }
    }
    toast.textContent = message;
    toast.className = `social-auth-toast ${type}`;
    // Auto-hide after 5 s
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.className = 'social-auth-toast'; }, 5000);
  }

  function saveSession(data) {
    localStorage.setItem('token', data.token);
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
  }

  async function postToBackend(endpoint, payload) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Authentication failed. Please try again.');
    }
    return json.data;
  }

  /* ─── Google Sign-In ──────────────────────────────────────────────────────── */

  function initGoogle() {
    if (!GOOGLE_CLIENT_ID) return;

    // Load the Google Identity Services script dynamically
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      }
    };
    document.head.appendChild(script);
  }

  function handleGoogleCredentialResponse(response) {
    handleGoogleLogin(response.credential);
  }

  /**
   * Trigger Google sign-in popup and send the resulting ID token to the backend.
   * @param {string} [idToken] - Pre-obtained ID token (from GSI callback). If omitted, a popup is opened.
   */
  async function handleGoogleLogin(idToken) {
    const btn = document.querySelector('.btn-google');
    setLoading(btn, true);

    try {
      if (idToken) {
        const data = await postToBackend('/auth/google', { id_token: idToken });
        saveSession(data);
        showToast('Signed in with Google!', 'success');
        setTimeout(() => { window.location.href = REDIRECT_AFTER_LOGIN; }, 800);
      } else {
        // Use the One Tap / popup flow
        if (!window.google?.accounts?.id) {
          throw new Error('Google Sign-In SDK is not loaded yet. Please try again.');
        }
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setLoading(btn, false);
          }
        });
      }
    } catch (err) {
      showToast(err.message, 'error');
      setLoading(btn, false);
    }
  }

  /* ─── Facebook Login ──────────────────────────────────────────────────────── */

  function initFacebook() {
    if (!FACEBOOK_APP_ID) return;

    window.fbAsyncInit = function () {
      FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v19.0',
      });
    };

    // Load the Facebook SDK dynamically
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  /**
   * Trigger Facebook login popup and send the access token to the backend.
   */
  async function handleFacebookLogin() {
    const btn = document.querySelector('.btn-facebook');
    setLoading(btn, true);

    try {
      if (!window.FB) {
        throw new Error('Facebook SDK is not loaded yet. Please try again.');
      }

      // Wrap FB.login in a Promise
      const fbResponse = await new Promise((resolve, reject) => {
        FB.login((response) => {
          if (response.authResponse) {
            resolve(response.authResponse);
          } else {
            reject(new Error('Facebook login was cancelled.'));
          }
        }, { scope: 'public_profile,email' });
      });

      const data = await postToBackend('/auth/facebook', {
        access_token: fbResponse.accessToken,
      });

      saveSession(data);
      showToast('Signed in with Facebook!', 'success');
      setTimeout(() => { window.location.href = REDIRECT_AFTER_LOGIN; }, 800);
    } catch (err) {
      showToast(err.message, 'error');
      setLoading(btn, false);
    }
  }

  /* ─── Button wiring ───────────────────────────────────────────────────────── */

  function addSpinnerMarkup(btn) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    const text = btn.childNodes[btn.childNodes.length - 1];
    if (icon) icon.classList.add('social-btn-icon');
    // Wrap text node in a span if it's a bare text node
    if (text && text.nodeType === Node.TEXT_NODE) {
      const span = document.createElement('span');
      span.className = 'social-btn-text';
      span.textContent = text.textContent;
      btn.replaceChild(span, text);
    }
    const spinner = document.createElement('span');
    spinner.className = 'social-spinner';
    btn.appendChild(spinner);
  }

  function wireButtons() {
    const googleBtn = document.querySelector('.btn-google');
    const facebookBtn = document.querySelector('.btn-facebook');

    addSpinnerMarkup(googleBtn);
    addSpinnerMarkup(facebookBtn);

    if (googleBtn) {
      googleBtn.addEventListener('click', () => handleGoogleLogin());
    }
    if (facebookBtn) {
      facebookBtn.addEventListener('click', handleFacebookLogin);
    }
  }

  /* ─── Init ────────────────────────────────────────────────────────────────── */

  function init() {
    wireButtons();
    initGoogle();
    initFacebook();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use (e.g., link/unlink flows)
  window.socialAuth = { handleGoogleLogin, handleFacebookLogin };
})();
