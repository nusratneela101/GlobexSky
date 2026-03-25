/**
 * Globex Sky — backend-status.js
 * Checks if backend API is reachable and shows status indicator.
 * Include after config.js and api-client.js
 */
(function BackendStatus() {
  'use strict';

  const CHECK_INTERVAL = 60000; // 1 minute
  let isOnline = null;
  let statusEl = null;

  function createStatusBanner() {
    if (document.getElementById('gs-backend-status')) return;

    statusEl = document.createElement('div');
    statusEl.id = 'gs-backend-status';
    statusEl.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
      padding: 8px 16px; text-align: center; font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: transform 0.3s ease, opacity 0.3s ease;
      transform: translateY(100%); opacity: 0;
    `;
    document.body.appendChild(statusEl);
  }

  function showBanner(message, type) {
    if (!statusEl) createStatusBanner();

    const colors = {
      error: { bg: '#dc3545', color: '#fff' },
      warning: { bg: '#ffc107', color: '#000' },
      success: { bg: '#28a745', color: '#fff' },
    };

    const c = colors[type] || colors.warning;
    statusEl.style.backgroundColor = c.bg;
    statusEl.style.color = c.color;
    statusEl.textContent = message;
    statusEl.style.transform = 'translateY(0)';
    statusEl.style.opacity = '1';

    if (type === 'success') {
      setTimeout(() => {
        statusEl.style.transform = 'translateY(100%)';
        statusEl.style.opacity = '0';
      }, 3000);
    }
  }

  async function checkStatus() {
    if (!window.GlobexConfig) return;

    const result = await window.GlobexConfig.checkBackendHealth();
    const wasOnline = isOnline;
    isOnline = result.online;

    if (!isOnline) {
      showBanner('⚠️ Backend server is not reachable. Some features may not work.', 'error');
    } else if (wasOnline === false && isOnline) {
      showBanner('✅ Backend connection restored!', 'success');
    }
  }

  // Initial check after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkStatus, 1000);
    });
  } else {
    setTimeout(checkStatus, 1000);
  }

  // Periodic checks
  setInterval(checkStatus, CHECK_INTERVAL);

  // Expose for manual check
  window.GlobexBackendStatus = { check: checkStatus, isOnline: () => isOnline };
})();
