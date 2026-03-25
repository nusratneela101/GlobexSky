/**
 * Globex Sky — assets/js/admin/api-settings.js
 * Handles the Test/Live mode toggle UI in the admin API Settings page.
 */

const apiSettings = (() => {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getBaseUrl = () => window.GlobexConfig?.API_BASE_URL || 'http://localhost:5000/api/v1';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('globex_token') || sessionStorage.getItem('globex_token') || '';
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const showToast = (message, type = 'success') => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast ${type} show`;
    setTimeout(() => { el.className = 'toast'; }, 3500);
  };

  // ─── Mode Badge ─────────────────────────────────────────────────────────────

  const applyModeToBadge = (mode) => {
    const badge = document.getElementById('modeBadge');
    const badgeText = document.getElementById('modeBadgeText');
    const toggle = document.getElementById('modeToggle');
    const warning = document.getElementById('liveModeWarning');
    if (!badge || !badgeText || !toggle) return;

    const isLive = mode === 'live';
    toggle.checked = isLive;
    badgeText.textContent = isLive ? 'LIVE' : 'TEST';
    badge.className = `mode-badge ${isLive ? 'live' : 'test'}`;
    if (warning) warning.className = `warning-banner${isLive ? ' visible' : ''}`;
  };

  // ─── Fetch current mode ──────────────────────────────────────────────────────

  const loadMode = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/admin/app-mode`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) applyModeToBadge(json.data.mode);
    } catch (_err) {
      // Backend unreachable — UI stays in default TEST state
    }
  };

  // ─── Toggle change handler ───────────────────────────────────────────────────

  const onToggleChange = async () => {
    const toggle = document.getElementById('modeToggle');
    if (!toggle) return;
    const newMode = toggle.checked ? 'live' : 'test';

    if (newMode === 'live') {
      const confirmed = confirm(
        '⚠️ You are switching to LIVE mode.\n\n' +
        'Real transactions will occur using your live API keys.\n\n' +
        'Are you sure you want to continue?'
      );
      if (!confirmed) {
        toggle.checked = false;
        return;
      }
    }

    try {
      const res = await fetch(`${getBaseUrl()}/admin/app-mode`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mode: newMode }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      applyModeToBadge(json.data.mode);
      showToast(`✅ Switched to ${json.data.mode.toUpperCase()} mode`, 'success');
      // Refresh key list to reflect new mode
      loadPublicKeys();
    } catch (err) {
      // Revert toggle on failure
      toggle.checked = !toggle.checked;
      showToast(`❌ Failed to switch mode: ${err.message}`, 'error');
    }
  };

  // ─── Mask a key for display ──────────────────────────────────────────────────

  const maskKey = (key) => {
    if (!key || key.startsWith('your-') || key.includes('placeholder')) return null;
    if (key.length <= 8) return '***';
    return `${key.slice(0, 8)}***${key.slice(-4)}`;
  };

  // ─── Render key list ────────────────────────────────────────────────────────

  const renderKeys = (data) => {
    const container = document.getElementById('keyList');
    if (!container) return;

    const keys = [
      { name: 'Supabase URL',          value: data?.supabase?.url },
      { name: 'Supabase Anon Key',     value: data?.supabase?.anonKey },
      { name: 'Stripe Publishable',    value: data?.stripe?.publishableKey },
      { name: 'Agora App ID',          value: data?.agora?.appId },
      { name: 'Cloudinary Cloud Name', value: data?.cloudinary?.cloudName },
    ];

    container.innerHTML = keys.map(({ name, value }) => {
      const masked = maskKey(value);
      const configured = Boolean(masked);
      return `
        <div class="key-item">
          <span class="key-name">${name}</span>
          <span class="key-value">${configured ? masked : '<em style="color:#94a3b8">not configured</em>'}</span>
          <span class="key-status ${configured ? 'configured' : 'missing'}" title="${configured ? 'Configured' : 'Missing'}"></span>
        </div>
      `;
    }).join('');
  };

  // ─── Fetch public config ────────────────────────────────────────────────────

  const loadPublicKeys = async () => {
    const container = document.getElementById('keyList');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;color:#94a3b8;font-size:.875rem">
          <i class="fas fa-spinner fa-spin" style="font-size:1.2rem;margin-bottom:8px;display:block"></i>
          Loading keys…
        </div>
      `;
    }
    try {
      const res = await fetch(`${getBaseUrl()}/config/public`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) renderKeys(json.data);
    } catch (_err) {
      if (container) {
        container.innerHTML = `
          <div style="text-align:center;padding:24px;color:#ef4444;font-size:.875rem">
            <i class="fas fa-exclamation-circle" style="margin-right:6px"></i>
            Unable to reach the backend. Showing fallback defaults.
          </div>
        `;
      }
    }
  };

  // ─── Test connection ────────────────────────────────────────────────────────

  const testConnection = async () => {
    const statusEl = document.getElementById('connectionStatus');
    const apiBase = getBaseUrl().replace('/api/v1', '');
    if (statusEl) statusEl.textContent = 'Testing…';
    try {
      const res = await fetch(`${apiBase}/health`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.success) {
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-check-circle" style="color:#16a34a;margin-right:4px"></i><span style="color:#16a34a">Connected</span>';
        showToast('✅ Backend is reachable', 'success');
      } else {
        throw new Error('Unhealthy response');
      }
    } catch (_err) {
      if (statusEl) statusEl.innerHTML = '<i class="fas fa-times-circle" style="color:#ef4444;margin-right:4px"></i><span style="color:#ef4444">Unreachable</span>';
      showToast('❌ Backend is unreachable', 'error');
    }
  };

  // ─── Refresh keys manually ───────────────────────────────────────────────────

  const refreshKeys = () => loadPublicKeys();

  // ─── Init ────────────────────────────────────────────────────────────────────

  const init = () => {
    loadMode();
    loadPublicKeys();
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { onToggleChange, testConnection, refreshKeys };
})();
