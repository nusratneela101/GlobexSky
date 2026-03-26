/**
 * Globex Sky — utils.js
 * Common client-side utility functions used across the platform.
 *
 * All functions are exposed on the global `GlobexUtils` object and also
 * exported individually for use by other scripts that load after this one.
 */

const GlobexUtils = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CURRENCY & NUMBER FORMATTING
  ───────────────────────────────────────────── */

  /**
   * Format a numeric value as a currency string.
   * @param {number} amount
   * @param {string} [currency='USD']
   * @param {string} [locale] - BCP 47 locale tag, e.g. 'en-US', 'zh-CN'
   * @returns {string} e.g. '$1,234.56'
   */
  function formatCurrency(amount, currency, locale) {
    currency = currency || window.GlobexConfig?.DEFAULT_CURRENCY || 'USD';
    locale   = locale   || navigator.language || 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style:                 'currency',
        currency:              currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount || 0);
    } catch (_) {
      return `${currency} ${(amount || 0).toFixed(2)}`;
    }
  }

  /**
   * Format a large number compactly: 1200 → '1.2K', 1500000 → '1.5M'
   * @param {number} n
   * @returns {string}
   */
  function formatNumber(n) {
    n = Number(n) || 0;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  /**
   * Format bytes into a human-readable size string.
   * @param {number} bytes
   * @returns {string} e.g. '2.5 MB'
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  /* ─────────────────────────────────────────────
     DATE & TIME FORMATTING
  ───────────────────────────────────────────── */

  /**
   * Format an ISO date string or Date object into a human-readable date.
   * @param {string|Date} date
   * @param {object} [options] - Intl.DateTimeFormat options
   * @returns {string}
   */
  function formatDate(date, options) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const locale = navigator.language || 'en-US';
    const opts   = options || { year: 'numeric', month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat(locale, opts).format(d);
  }

  /**
   * Format an ISO date string or Date object into a date + time string.
   * @param {string|Date} date
   * @returns {string}
   */
  function formatDateTime(date) {
    return formatDate(date, {
      year:   'numeric',
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Return a relative time description: 'just now', '3 mins ago', '2 days ago', etc.
   * @param {string|Date} date
   * @returns {string}
   */
  function timeAgo(date) {
    if (!date) return '';
    const d       = date instanceof Date ? date : new Date(date);
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds <  60)  return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (seconds < 3600) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(seconds / 3600);
    if (seconds < 86400) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(seconds / 86400);
    if (seconds < 604800) return `${days} day${days > 1 ? 's' : ''} ago`;
    return formatDate(d);
  }

  /* ─────────────────────────────────────────────
     STRING UTILITIES
  ───────────────────────────────────────────── */

  /**
   * Truncate a string to a maximum length, appending '…' if needed.
   * @param {string} str
   * @param {number} [maxLen=100]
   * @returns {string}
   */
  function truncate(str, maxLen) {
    maxLen = maxLen || 100;
    if (!str || str.length <= maxLen) return str || '';
    return str.slice(0, maxLen).trimEnd() + '…';
  }

  /**
   * Convert a string to a URL-friendly slug.
   * @param {string} str
   * @returns {string}
   */
  function slugify(str) {
    if (!str) return '';
    return str
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Capitalise the first letter of a string.
   * @param {string} str
   * @returns {string}
   */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ─────────────────────────────────────────────
     DOM UTILITIES
  ───────────────────────────────────────────── */

  /**
   * Safely query a single element. Returns null (not throws) if not found.
   * @param {string} selector
   * @param {Element|Document} [root=document]
   * @returns {Element|null}
   */
  function qs(selector, root) {
    try {
      return (root || document).querySelector(selector);
    } catch (_) {
      return null;
    }
  }

  /**
   * Safely query all elements.
   * @param {string} selector
   * @param {Element|Document} [root=document]
   * @returns {Element[]}
   */
  function qsAll(selector, root) {
    try {
      return Array.from((root || document).querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  /**
   * Show a loading skeleton or spinner on an element.
   * @param {Element} el
   * @param {string} [text='Loading…']
   */
  function setLoading(el, text) {
    if (!el) return;
    el.dataset.originalContent = el.innerHTML;
    el.innerHTML = `<span class="loading-spinner" aria-label="${text || 'Loading…'}">
      <i class="fas fa-circle-notch fa-spin"></i> ${text || 'Loading…'}
    </span>`;
    el.disabled = true;
  }

  /**
   * Restore an element from its loading state.
   * @param {Element} el
   */
  function clearLoading(el) {
    if (!el) return;
    if (el.dataset.originalContent !== undefined) {
      el.innerHTML = el.dataset.originalContent;
      delete el.dataset.originalContent;
    }
    el.disabled = false;
  }

  /* ─────────────────────────────────────────────
     TOAST NOTIFICATIONS
  ───────────────────────────────────────────── */

  let _toastContainer = null;

  function _getToastContainer() {
    if (_toastContainer && document.body.contains(_toastContainer)) {
      return _toastContainer;
    }
    const existing = document.getElementById('gs-toast-container');
    if (existing) {
      _toastContainer = existing;
      return _toastContainer;
    }
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'gs-toast-container';
    _toastContainer.setAttribute('role', 'alert');
    _toastContainer.setAttribute('aria-live', 'polite');
    Object.assign(_toastContainer.style, {
      position:   'fixed',
      bottom:     '24px',
      right:      '24px',
      zIndex:     '99999',
      display:    'flex',
      flexDirection: 'column',
      gap:        '10px',
      maxWidth:   '360px',
    });
    document.body.appendChild(_toastContainer);
    return _toastContainer;
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} [type='info']
   * @param {number} [duration=3500] - ms before auto-dismiss
   */
  function showToast(message, type, duration) {
    type     = type     || 'info';
    duration = duration !== undefined ? duration : 3500;

    const icons = {
      success: 'fa-circle-check',
      error:   'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info:    'fa-circle-info',
    };
    const colors = {
      success: '#059669',
      error:   '#dc2626',
      warning: '#d97706',
      info:    '#0052CC',
    };

    const toast = document.createElement('div');
    toast.className = `gs-toast gs-toast--${type}`;
    Object.assign(toast.style, {
      background:   '#fff',
      borderRadius: '10px',
      boxShadow:    '0 4px 20px rgba(0,0,0,.15)',
      borderLeft:   `4px solid ${colors[type] || colors.info}`,
      padding:      '12px 16px',
      display:      'flex',
      alignItems:   'center',
      gap:          '10px',
      fontSize:     '.875rem',
      fontFamily:   'Inter, sans-serif',
      color:        '#1e293b',
      transition:   'opacity .3s, transform .3s',
      opacity:      '0',
      transform:    'translateX(20px)',
      cursor:       'pointer',
    });

    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info}" style="color:${colors[type] || colors.info};font-size:1rem;flex-shrink:0;"></i>
      <span>${escapeHtml(message)}</span>
      <button style="margin-left:auto;background:none;border:none;cursor:pointer;color:#94a3b8;padding:0;font-size:1rem;" aria-label="Dismiss">
        <i class="fas fa-xmark"></i>
      </button>
    `;

    const container = _getToastContainer();
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity   = '1';
      toast.style.transform = 'translateX(0)';
    });

    function dismiss() {
      toast.style.opacity   = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }

    toast.addEventListener('click', dismiss);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  /* ─────────────────────────────────────────────
     VALIDATION HELPERS
  ───────────────────────────────────────────── */

  /**
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
  }

  /**
   * Check password strength.
   * @param {string} password
   * @returns {{ valid: boolean, message: string }}
   */
  function checkPasswordStrength(password) {
    if (!password || password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    }
    if (!/\d/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number.' };
    }
    return { valid: true, message: 'Password is strong.' };
  }

  /* ─────────────────────────────────────────────
     PERFORMANCE
  ───────────────────────────────────────────── */

  /**
   * Debounce a function call.
   * @param {Function} fn
   * @param {number} [wait=300]
   * @returns {Function}
   */
  function debounce(fn, wait) {
    wait = wait || 300;
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /**
   * Throttle a function call.
   * @param {Function} fn
   * @param {number} [wait=300]
   * @returns {Function}
   */
  function throttle(fn, wait) {
    wait = wait || 300;
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  /* ─────────────────────────────────────────────
     STORAGE HELPERS
  ───────────────────────────────────────────── */

  /**
   * Safely read a JSON value from localStorage.
   * @param {string} key
   * @param {*} [fallback=null]
   * @returns {*}
   */
  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
    } catch (_) {
      return fallback !== undefined ? fallback : null;
    }
  }

  /**
   * Safely write a JSON value to localStorage.
   * @param {string} key
   * @param {*} value
   */
  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Quota exceeded — silently ignore.
    }
  }

  /**
   * Remove a key from localStorage.
   * @param {string} key
   */
  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) { /* ignore */ }
  }

  /* ─────────────────────────────────────────────
     URL / QUERY STRING
  ───────────────────────────────────────────── */

  /**
   * Build a URL with the given query params merged into the current location.
   * @param {object} params
   * @param {string} [base] - defaults to window.location.pathname
   * @returns {string}
   */
  function buildUrl(params, base) {
    const url = new URL(base || window.location.href, window.location.origin);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') {
        url.searchParams.delete(k);
      } else {
        url.searchParams.set(k, v);
      }
    });
    return url.toString();
  }

  /**
   * Get a single query parameter from the current URL.
   * @param {string} name
   * @returns {string|null}
   */
  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /* ─────────────────────────────────────────────
     COPY TO CLIPBOARD
  ───────────────────────────────────────────── */

  /**
   * Copy text to clipboard, showing a toast on completion.
   * @param {string} text
   * @param {string} [successMessage='Copied!']
   * @returns {Promise<boolean>}
   */
  async function copyToClipboard(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage || 'Copied to clipboard!', 'success', 2000);
      return true;
    } catch (_) {
      showToast('Failed to copy.', 'error', 2000);
      return false;
    }
  }

  /* ─────────────────────────────────────────────
     IMAGE HANDLING
  ───────────────────────────────────────────── */

  /**
   * Return a placeholder image URL if the source fails.
   * Attach to an <img> element's onerror.
   * @param {HTMLImageElement} img
   * @param {string} [fallbackSrc]
   */
  function handleImageError(img, fallbackSrc) {
    img.onerror = null;
    img.src = fallbackSrc || 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width%3D%22400%22 height%3D%22300%22 viewBox%3D%220 0 400 300%22%3E%3Crect fill%3D%22%23f1f5f9%22 width%3D%22400%22 height%3D%22300%22%2F%3E%3Ctext x%3D%22200%22 y%3D%22155%22 font-family%3D%22Arial%22 font-size%3D%2216%22 fill%3D%22%2394a3b8%22 text-anchor%3D%22middle%22%3ENo Image%3C%2Ftext%3E%3C%2Fsvg%3E';
  }

  /* ─────────────────────────────────────────────
     MISC
  ───────────────────────────────────────────── */

  /**
   * Generate a random UUID v4.
   * @returns {string}
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /**
   * Deep clone a plain JS object / array.
   * @param {*} obj
   * @returns {*}
   */
  function deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (_) {
      return obj;
    }
  }

  /**
   * Conditionally join CSS class names, filtering out falsy values.
   * @param {...(string|null|undefined|false)} classes
   * @returns {string}
   */
  function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    formatCurrency,
    formatNumber,
    formatBytes,
    formatDate,
    formatDateTime,
    timeAgo,
    truncate,
    slugify,
    capitalize,
    escapeHtml,
    qs,
    qsAll,
    setLoading,
    clearLoading,
    showToast,
    isValidEmail,
    checkPasswordStrength,
    debounce,
    throttle,
    storageGet,
    storageSet,
    storageRemove,
    buildUrl,
    getQueryParam,
    copyToClipboard,
    handleImageError,
    generateId,
    deepClone,
    classNames,
  };
})();

// Expose globally
window.GlobexUtils = GlobexUtils;

// Convenience aliases on window for backwards-compatible usage
window.formatCurrency  = GlobexUtils.formatCurrency;
window.formatDate      = GlobexUtils.formatDate;
window.showToast       = GlobexUtils.showToast;
window.debounce        = GlobexUtils.debounce;
