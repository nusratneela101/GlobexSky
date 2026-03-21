/**
 * Admin Settings JS
 * Loads and saves system settings grouped by tab.
 */

const API_BASE = window.API_BASE || '/api/v1';

async function authHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
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
});
