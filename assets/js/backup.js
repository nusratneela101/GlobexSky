/**
 * Backup & Restore JS
 * Handles automated backup scheduling, manual backups,
 * download, restore, and backup history display.
 */

const API_BASE = window.API_BASE || '/api/v1';

async function authHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function showToast(msg, isError = false) {
  const el = document.getElementById('toast-msg') || document.getElementById('backup-toast');
  if (!el) return;
  const icon = isError ? 'fa-exclamation-circle' : 'fa-check-circle';
  const color = isError ? '#ef4444' : '#00C9A7';
  el.innerHTML = `<i class="fas ${icon}" style="color:${color};margin-right:6px"></i>${escHtml(msg)}`;
  el.style.transform = 'translateY(0)';
  el.style.opacity = '1';
  setTimeout(() => { el.style.transform = 'translateY(80px)'; el.style.opacity = '0'; }, 3500);
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/* ────────────────────────────────────────────────────────────
   BACKUP LIST
   ──────────────────────────────────────────────────────────── */
async function loadBackups() {
  const tbody = document.getElementById('backupBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">Loading…</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/admin/backups`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load backups');
    const backups = json.data || [];
    if (tbody) {
      tbody.innerHTML = backups.length
        ? backups.map(b => {
            const statusMap = {
              completed: 'badge-green', failed: 'badge-red',
              running: 'badge-blue', pending: 'badge-orange',
            };
            const typeMap = { full: 'badge-purple', incremental: 'badge-teal', manual: 'badge-blue' };
            return `
              <tr>
                <td><strong>${escHtml(b.id?.slice(0, 8) || '—')}</strong></td>
                <td><span class="badge-pill ${typeMap[b.type] || 'badge-gray'}">${escHtml(b.type || 'full')}</span></td>
                <td>${b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</td>
                <td>${formatBytes(b.size_bytes)}</td>
                <td>${formatDuration(b.duration_ms)}</td>
                <td><span class="badge-pill ${statusMap[b.status] || 'badge-gray'}">${escHtml(b.status || 'unknown')}</span></td>
                <td>
                  ${b.status === 'completed' ? `
                    <button class="btn-sm btn-primary" onclick="downloadBackup('${escHtml(b.id)}')"><i class="fas fa-download"></i></button>
                    <button class="btn-sm btn-warning" onclick="restoreBackup('${escHtml(b.id)}')"><i class="fas fa-undo"></i> Restore</button>
                  ` : ''}
                  <button class="btn-sm btn-danger" onclick="deleteBackup('${escHtml(b.id)}')"><i class="fas fa-trash"></i></button>
                </td>
              </tr>`;
          }).join('')
        : '<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8">No backups found.</td></tr>';
    }
    updateBackupMetrics(backups);
  } catch (err) {
    showToast(err.message, true);
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#ef4444">Failed to load backups.</td></tr>';
  }
}

function updateBackupMetrics(backups) {
  const completed = backups.filter(b => b.status === 'completed');
  const totalSize = completed.reduce((s, b) => s + (b.size_bytes || 0), 0);
  const last = completed[0];

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('backup-total-count', backups.length);
  setEl('backup-success-count', completed.length);
  setEl('backup-total-size', formatBytes(totalSize));
  setEl('backup-last-date', last ? new Date(last.created_at).toLocaleDateString() : '—');
}

/* ────────────────────────────────────────────────────────────
   CREATE MANUAL BACKUP
   ──────────────────────────────────────────────────────────── */
async function createBackup(type = 'full') {
  const btn = document.getElementById('createBackupBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'; }
  try {
    const res = await fetch(`${API_BASE}/admin/backups`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ type }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Backup failed');
    showToast('Backup started successfully');
    loadBackups();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Create Backup'; }
  }
}

/* ────────────────────────────────────────────────────────────
   DOWNLOAD BACKUP
   ──────────────────────────────────────────────────────────── */
async function downloadBackup(backupId) {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const url = `${API_BASE}/admin/backups/${backupId}/download`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `backup-${backupId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    showToast('Backup download started');
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   RESTORE BACKUP
   ──────────────────────────────────────────────────────────── */
async function restoreBackup(backupId) {
  if (!confirm('Restore from this backup? This will overwrite current data. Are you sure?')) return;
  const confirmText = prompt('Type "RESTORE" to confirm:');
  if (confirmText !== 'RESTORE') { showToast('Restore cancelled', true); return; }
  try {
    const res = await fetch(`${API_BASE}/admin/backups/${backupId}/restore`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Restore failed');
    showToast('Restore initiated. System will restart shortly.');
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   DELETE BACKUP
   ──────────────────────────────────────────────────────────── */
async function deleteBackup(backupId) {
  if (!confirm('Delete this backup? This cannot be undone.')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/backups/${backupId}`, { method: 'DELETE', headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Delete failed');
    showToast('Backup deleted');
    loadBackups();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   SCHEDULE
   ──────────────────────────────────────────────────────────── */
async function loadSchedule() {
  try {
    const res = await fetch(`${API_BASE}/admin/backups/schedule`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) return;
    const s = json.data || json;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    setChecked('schedEnabled', s.enabled);
    setVal('schedFrequency', s.frequency || 'daily');
    setVal('schedTime', s.time || '02:00');
    setVal('retentionDays', s.retention_days ?? s.retentionDays ?? 30);
    if (s.cron) setVal('cronExpr', s.cron);
    if (s.enabled) {
      const t = new Date();
      t.setDate(t.getDate() + (s.frequency === 'daily' ? 1 : s.frequency === 'weekly' ? 7 : 30));
      const el = document.getElementById('nextScheduled');
      if (el) el.textContent = t.toLocaleDateString();
    }
  } catch (_) { /* schedule info unavailable */ }
}

async function saveSchedule(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('scheduleForm');
  if (!form) return;
  const payload = {
    enabled: form.schedEnabled?.checked ?? document.getElementById('schedEnabled')?.checked,
    frequency: form.schedFrequency?.value ?? document.getElementById('schedFrequency')?.value,
    time: form.schedTime?.value ?? document.getElementById('schedTime')?.value,
    retention_days: parseInt(form.retentionDays?.value ?? document.getElementById('retentionDays')?.value || '30', 10),
    cron: form.cronExpr?.value?.trim() ?? document.getElementById('cronExpr')?.value?.trim(),
  };
  try {
    const res = await fetch(`${API_BASE}/admin/backups/schedule`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to save schedule');
    showToast('Backup schedule saved');
    loadSchedule();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   BACKUP SIZE CHART
   ──────────────────────────────────────────────────────────── */
async function renderBackupSizeChart() {
  const ctx = document.getElementById('backupSizeChart');
  if (!ctx || typeof Chart === 'undefined') return;
  try {
    const res = await fetch(`${API_BASE}/admin/backups`, { headers: await authHeaders() });
    const json = await res.json();
    const backups = (json.data || []).slice(0, 10).reverse();
    if (ctx._chartInstance) ctx._chartInstance.destroy();
    ctx._chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: backups.map(b => b.created_at ? new Date(b.created_at).toLocaleDateString() : 'Unknown'),
        datasets: [{
          label: 'Backup Size (MB)',
          data: backups.map(b => b.size_bytes ? Math.round(b.size_bytes / 1048576) : 0),
          backgroundColor: backups.map(b => b.status === 'completed' ? '#0052CC' : '#ef4444'),
        }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  } catch (_) { /* chart unavailable */ }
}

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadBackups();
  loadSchedule();
  renderBackupSizeChart();

  document.getElementById('scheduleForm')?.addEventListener('submit', saveSchedule);
  document.getElementById('createBackupBtn')?.addEventListener('click', () => {
    const type = document.getElementById('backupTypeSelect')?.value || 'full';
    createBackup(type);
  });
  document.getElementById('createIncrementalBtn')?.addEventListener('click', () => createBackup('incremental'));
  document.getElementById('refreshBackupsBtn')?.addEventListener('click', loadBackups);
});
