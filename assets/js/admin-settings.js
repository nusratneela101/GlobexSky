/**
 * Admin Settings JS
 * Loads and saves system settings grouped by tab.
 */

const API_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || window.API_BASE || '/api/v1';

async function authHeaders() {
  // Support both the new globexSession format (ApiClient) and legacy token keys
  let token = null;
  try {
    const session = JSON.parse(localStorage.getItem('globexSession') || 'null');
    token = (session && session.token) || null;
  } catch (_) {}
  if (!token) {
    token = localStorage.getItem('token') || sessionStorage.getItem('token') || null;
  }
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Tab switching ─────────────────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('[data-settings-tab]');
  const panes = document.querySelectorAll('[data-settings-pane]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.settingsTab;
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-settings-pane="${target}"]`)?.classList.add('active');
    });
  });
}

// ─── Load all settings ─────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, { headers: await authHeaders() });
    const json = await res.json();
    if (!json.success) return;

    const settings = (json.data || []).reduce((acc, s) => {
      const keyWithoutGroup = s.key.replace(`${s.group}.`, '');
      acc[s.group] = acc[s.group] || {};
      acc[s.group][keyWithoutGroup] = s.value;
      return acc;
    }, {});

    populateForm(settings);
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function populateForm(settings) {
  Object.entries(settings).forEach(([group, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      const el = document.getElementById(`setting-${group}-${key}`) ||
                 document.querySelector(`[name="${group}.${key}"]`);
      if (!el) return;

      if (el.type === 'checkbox') {
        el.checked = value === 'true' || value === true;
      } else {
        el.value = value ?? '';
      }
    });
  });
}

// ─── Save settings ─────────────────────────────────────────────────────────────
async function saveSettings(group) {
  const form = document.getElementById(`form-${group}`);
  if (!form) return;

  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v; });

  // Also capture checkboxes that aren't checked (FormData omits them)
  form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    data[cb.name] = cb.checked ? 'true' : 'false';
  });

  showToast('Saving…', 'info');

  try {
    const res = await fetch(`${API_BASE}/admin/settings/${group}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    showToast(json.success ? 'Settings saved.' : (json.error || 'Save failed.'), json.success ? 'success' : 'error');
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  }
}

// ─── Test Email ────────────────────────────────────────────────────────────────
async function sendTestEmail() {
  const to = document.getElementById('testEmailTo')?.value;
  if (!to) { showToast('Enter a recipient email.', 'warning'); return; }

  try {
    const res = await fetch(`${API_BASE}/admin/settings/email/test`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ to }),
    });
    const json = await res.json();
    showToast(json.success ? 'Test email sent!' : (json.error || 'Failed.'), json.success ? 'success' : 'error');
  } catch (err) {
    showToast('Network error.', 'error');
  }
}

// ─── Backup ────────────────────────────────────────────────────────────────────
async function createBackup(type = 'full') {
  showToast('Creating backup…', 'info');
  try {
    const res = await fetch(`${API_BASE}/admin/settings/backup`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ type }),
    });
    const json = await res.json();
    showToast(json.success ? 'Backup job queued!' : (json.error || 'Failed.'), json.success ? 'success' : 'error');
    if (json.success) loadBackups();
  } catch (err) {
    showToast('Network error.', 'error');
  }
}

async function loadBackups() {
  try {
    const res = await fetch(`${API_BASE}/admin/settings/backups`, { headers: await authHeaders() });
    const json = await res.json();
    if (!json.success) return;

    const tbody = document.getElementById('backupsTableBody');
    if (!tbody) return;

    const backups = json.data || [];
    tbody.innerHTML = backups.length
      ? backups.map(b => `
          <tr>
            <td>${b.filename}</td>
            <td>${b.type}</td>
            <td>${b.size ? (b.size / 1024 / 1024).toFixed(2) + ' MB' : '—'}</td>
            <td><span class="badge-pill ${b.status === 'completed' ? 'badge-green' : b.status === 'failed' ? 'badge-red' : 'badge-orange'}">${b.status}</span></td>
            <td>${new Date(b.created_at).toLocaleString()}</td>
            <td>
              ${b.status === 'completed' ? `<button class="btn-sm btn-secondary" onclick="restoreBackup('${b.id}')"><i class="fas fa-undo"></i> Restore</button>` : ''}
            </td>
          </tr>`)
        .join('')
      : '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8">No backups yet.</td></tr>';
  } catch (_) {}
}

window.restoreBackup = async (id) => {
  if (!confirm('Restore from this backup? Current data will be overwritten.')) return;
  const res = await fetch(`${API_BASE}/admin/settings/restore/${id}`, { method: 'POST', headers: await authHeaders() });
  const json = await res.json();
  showToast(json.success ? 'Restore started.' : (json.error || 'Failed.'), json.success ? 'success' : 'error');
};

// ─── Toast notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const colors = { success: '#059669', error: '#ef4444', warning: '#f97316', info: '#0052CC' };
  const toast = Object.assign(document.createElement('div'), {
    textContent: message,
    style: `position:fixed;bottom:24px;right:24px;padding:12px 20px;background:${colors[type]};color:#fff;border-radius:10px;font-size:.875rem;font-weight:500;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .3s`,
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ─── Platform Settings (API Keys / Service Configuration) ─────────────────────
//
//  Provides:
//    - loadPlatformSettings()    — fetch & render all service settings
//    - savePlatformCategory()    — save keys for one category
//    - testPlatformConnection()  — test connectivity for a service
//    - toggleGlobalMode()        — flip test ↔ live globally
//
// The active mode per category is driven by the data-mode attribute on the
// toggle switch rendered in the HTML tab.

let _platformMode = {}; // { stripe: 'test', paypal: 'live', ... }

async function loadPlatformSettings() {
  try {
    const res  = await fetch(`${API_BASE}/admin/settings/platform`, { headers: await authHeaders() });
    const json = await res.json();
    if (!json.success) return;

    const globalMode = json.mode || 'test';
    updateGlobalModeIndicator(globalMode);

    Object.entries(json.data || {}).forEach(([category, rows]) => {
      // Determine the mode for this category
      const catMode = rows.length > 0 ? rows[0].mode : globalMode;
      _platformMode[category] = catMode;

      // Update mode toggle switch if present
      const modeToggle = document.getElementById(`mode-toggle-${category}`);
      if (modeToggle) {
        modeToggle.checked = catMode === 'live';
        _updateModeLabel(category, catMode);
      }

      // Populate input fields
      rows.forEach(({ setting_key, setting_value }) => {
        const el = document.getElementById(`pk-${category}-${setting_key}`);
        if (el && setting_value && setting_value !== '••••••••') {
          el.value = setting_value;
        }
      });
    });
  } catch (err) {
    console.error('[platform-settings] Load error:', err);
  }
}

function _updateModeLabel(category, mode) {
  const label = document.getElementById(`mode-label-${category}`);
  if (!label) return;
  if (mode === 'live') {
    label.textContent = '🟢 Live';
    label.style.color = '#059669';
  } else {
    label.textContent = '🔧 Test';
    label.style.color = '#f97316';
  }
}

function updateGlobalModeIndicator(mode) {
  const el = document.getElementById('globalModeIndicator');
  if (!el) return;
  el.textContent  = mode === 'live' ? '🟢 Live Mode' : '🔧 Test Mode';
  el.style.background = mode === 'live' ? '#d1fae5' : '#fff7ed';
  el.style.color      = mode === 'live' ? '#059669'  : '#f97316';
}

/** Called when a per-category Test/Live toggle is flipped. */
window.onModeToggle = function(category, checkbox) {
  const mode = checkbox.checked ? 'live' : 'test';
  _platformMode[category] = mode;
  _updateModeLabel(category, mode);
};

/** Save API keys for one service category. */
window.savePlatformCategory = async function(category) {
  const form = document.getElementById(`pk-form-${category}`);
  if (!form) return;

  const mode = _platformMode[category] || 'test';
  const settings = {};
  form.querySelectorAll('input[data-pk-key]').forEach(el => {
    const key = el.getAttribute('data-pk-key');
    const val = el.value.trim();
    if (val && val !== '••••••••') settings[key] = val;
  });
  form.querySelectorAll('select[data-pk-key]').forEach(el => {
    settings[el.getAttribute('data-pk-key')] = el.value;
  });

  if (Object.keys(settings).length === 0) {
    showToast('No values to save.', 'warning');
    return;
  }

  _setStatusIcon(category, 'loading');
  showToast('Saving…', 'info');

  try {
    const res  = await fetch(`${API_BASE}/admin/settings/platform/${category}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ mode, settings }),
    });
    const json = await res.json();
    if (json.success) {
      showToast(`${category} settings saved (${mode} mode).`, 'success');
      _setStatusIcon(category, 'saved');
    } else {
      showToast(json.error || 'Save failed.', 'error');
      _setStatusIcon(category, 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
    _setStatusIcon(category, 'error');
  }
};

/** Test connectivity for a service. */
window.testPlatformConnection = async function(category) {
  const mode = _platformMode[category] || 'test';
  _setStatusIcon(category, 'loading');
  showToast(`Testing ${category} connection…`, 'info');

  try {
    const res  = await fetch(`${API_BASE}/admin/settings/platform/test-connection`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ category, mode }),
    });
    const json = await res.json();
    const ok   = json.result?.ok;
    const msg  = json.result?.message || (ok ? 'Connected.' : 'Failed.');
    showToast(`${category}: ${msg}`, ok ? 'success' : 'error');
    _setStatusIcon(category, ok ? 'ok' : 'error');
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
    _setStatusIcon(category, 'error');
  }
};

/** Toggle global test / live mode. */
window.toggleGlobalMode = async function() {
  try {
    const res  = await fetch(`${API_BASE}/admin/settings/platform/toggle-mode`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Switched to ${json.currentMode} mode.`, 'success');
      updateGlobalModeIndicator(json.currentMode);
    } else {
      showToast(json.error || 'Failed to toggle mode.', 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  }
};

function _setStatusIcon(category, state) {
  const el = document.getElementById(`status-icon-${category}`);
  if (!el) return;
  const map = {
    ok:      { icon: '✅', color: '#059669' },
    error:   { icon: '❌', color: '#ef4444' },
    loading: { icon: '⏳', color: '#94a3b8' },
    saved:   { icon: '💾', color: '#0052CC' },
  };
  const s = map[state] || map.loading;
  el.textContent  = s.icon;
  el.style.color  = s.color;
}

// ─── Feature toggles ──────────────────────────────────────────────────────────
async function loadFeatureToggles() {
  try {
    const res = await fetch(`${API_BASE}/feature-toggles`, { headers: await authHeaders() });
    const json = await res.json();
    if (!json.success) return;

    (json.data || []).forEach(ft => {
      const el = document.querySelector(`[data-feature="${ft.feature_name}"]`);
      if (el) el.checked = !!ft.is_enabled;
    });
  } catch (_) {}
}

async function toggleFeature(featureName, enabled) {
  try {
    await fetch(`${API_BASE}/admin/feature-toggles`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ feature_name: featureName, is_enabled: enabled }),
    });
  } catch (_) {}
}

// Bind feature toggle switches
document.querySelectorAll('[data-feature]').forEach(el => {
  el.addEventListener('change', () => toggleFeature(el.dataset.feature, el.checked));
});

// Expose globals for inline onclick handlers
window.saveSettings = saveSettings;
window.sendTestEmail = sendTestEmail;
window.createBackup = createBackup;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadSettings();
  loadBackups();
  loadFeatureToggles();
  loadPlatformSettings();
});
