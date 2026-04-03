/**
 * Globex Sky — Global Error Handler
 * Catches JS errors, unhandled promise rejections, and network/API errors.
 * Provides a lightweight toast notification system.
 */
(function () {
  'use strict';

  var TOAST_COLORS = {
    error:   '#ef4444',
    warning: '#f59e0b',
    info:    '#3b82f6',
    success: '#22c55e',
  };

  var ErrorHandler = {
    init() {
      this._patchFetch();
      this._registerGlobalHandlers();
    },

    /* ── Global JS error handler ── */
    _registerGlobalHandlers() {
      var self = this;

      window.onerror = function (msg, url, line, col, err) {
        self._logError({ type: 'js_error', message: msg, url: url, line: line, col: col, stack: err && err.stack });
        return false;
      };

      window.addEventListener('unhandledrejection', function (e) {
        self._logError({ type: 'promise_rejection', message: (e.reason && e.reason.message) || String(e.reason) });
      });
    },

    /* ── Fetch interceptor ── */
    _patchFetch() {
      if (typeof window.fetch !== 'function') return;
      var self = this;
      var originalFetch = window.fetch;

      window.fetch = function () {
        var args = arguments;
        return originalFetch.apply(window, args).then(function (response) {
          if (response.status >= 500) {
            self.showToast('Server error. Please try again later.', 'error');
          } else if (response.status === 401) {
            if (!location.pathname.includes('/auth/')) {
              localStorage.removeItem('globexToken');
              location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(location.pathname);
            }
          } else if (response.status === 403) {
            self.showToast("Access denied. You don't have permission.", 'warning');
          }
          return response;
        }).catch(function (err) {
          if (err && err.name === 'TypeError' && err.message && err.message.includes('Failed to fetch')) {
            self.showToast('Network error. Check your internet connection.', 'error');
          }
          throw err;
        });
      };
    },

    /* ── Toast notification ── */
    showToast(message, type) {
      type = type || 'info';
      var toast = document.createElement('div');
      toast.className = 'globex-toast globex-toast-' + type;
      toast.setAttribute('role', 'alert');
      toast.style.cssText = [
        'position:fixed',
        'top:20px',
        'right:20px',
        'padding:14px 18px',
        'border-radius:8px',
        'color:#fff',
        'z-index:99999',
        'display:flex',
        'align-items:center',
        'gap:10px',
        'max-width:400px',
        'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
        'font-family:Inter,sans-serif',
        'font-size:14px',
        'animation:globexSlideIn 0.3s ease',
        'background:' + (TOAST_COLORS[type] || TOAST_COLORS.info),
      ].join(';');

      var msgSpan = document.createElement('span');
      msgSpan.textContent = message;

      var closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.cssText = 'background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0;line-height:1;margin-left:auto;flex-shrink:0';
      closeBtn.setAttribute('aria-label', 'Close notification');
      closeBtn.onclick = function () { toast.remove(); };

      toast.appendChild(msgSpan);
      toast.appendChild(closeBtn);
      document.body.appendChild(toast);

      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 5000);
    },

    /* ── Internal logging ── */
    _logError(error) {
      console.error('[GlobexSky Error]', error);
    },
  };

  /* Inject keyframe animation once */
  (function injectStyles() {
    if (document.getElementById('globex-toast-styles')) return;
    var style = document.createElement('style');
    style.id = 'globex-toast-styles';
    style.textContent = '@keyframes globexSlideIn{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}';
    document.head.appendChild(style);
  }());

  document.addEventListener('DOMContentLoaded', function () { ErrorHandler.init(); });

  window.GlobexErrorHandler = ErrorHandler;
}());
