/**
 * Admin Users JS
 * Fetches user data from the API and populates the users table.
 */

const API_BASE = window.API_BASE || '/api/v1';
let currentPage = 1;
let currentFilters = {};

async function authHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function statusBadge(status) {
  const map = {
    active: 'badge-green', inactive: 'badge-gray',
    suspended: 'badge-orange', banned: 'badge-red',
  };
  return `<span class="badge-pill ${map[status] || 'badge-gray'}">${status ?? 'unknown'}</span>`;
}

function roleBadge(role) {
  const map = {
    buyer: 'badge-blue', supplier: 'badge-orange',
    carrier: 'badge-teal', admin: 'badge-purple', super_admin: 'badge-purple',
  };
  return `<span class="badge-pill ${map[role] || 'badge-gray'}">${role ?? '—'}</span>`;
}

function initials(name) {
  return (name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const colors = ['#dbeafe', '#ffedd5', '#d1fae5', '#ede9fe', '#ccfbf1'];
const textColors = ['#0052CC', '#f97316', '#059669', '#7c3aed', '#0d9488'];

async function loadUsers(page = 1, filters = {}) {
  currentPage = page;
  currentFilters = filters;

  const params = new URLSearchParams({ page, limit: 20, ...filters });
  const tbody = document.getElementById('usersTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">Loading…</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/admin/users?${params}`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load users.');

    const users = json.data || [];
    const meta = json.meta || {};

    if (tbody) {
      tbody.innerHTML = users.length
        ? users.map((u, i) => `
          <tr>
            <td><input type="checkbox" name="user-select" value="${u.id}"/></td>
            <td>
              <div class="user-cell">
                <div class="user-initials-sm" style="background:${colors[i % 5]};color:${textColors[i % 5]}">${initials(u.full_name)}</div>
                <a href="user-detail.html?id=${u.id}" class="user-cell-name" style="text-decoration:none;color:inherit">${u.full_name || '—'}</a>
              </div>
            </td>
            <td>${u.email || '—'}</td>
            <td>${roleBadge(u.role)}</td>
            <td>${statusBadge(u.status || 'active')}</td>
            <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
            <td>
              <div class="btn-action-group">
                <a href="user-detail.html?id=${u.id}" class="btn-sm btn-secondary"><i class="fas fa-eye"></i></a>
                <button class="btn-sm btn-success" onclick="verifyUser('${u.id}')"><i class="fas fa-check"></i></button>
                <button class="btn-sm btn-warning" onclick="suspendUser('${u.id}')"><i class="fas fa-ban"></i></button>
                <button class="btn-sm btn-danger" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>`)
          .join('')
        : '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">No users found.</td></tr>';
    }

    renderPagination(meta.total || 0, page, 20);
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#ef4444">${err.message}</td></tr>`;
  }
}

function renderPagination(total, page, limit) {
  const container = document.getElementById('paginationContainer');
  if (!container) return;

  const pages = Math.ceil(total / limit);
  if (pages <= 1) { container.innerHTML = ''; return; }

  let html = '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;padding:12px 0">';
  html += `<span style="font-size:.85rem;color:#64748b">Showing page ${page} of ${pages} (${total} total)</span>`;
  html += `<button class="btn-sm btn-secondary" ${page <= 1 ? 'disabled' : ''} onclick="loadUsers(${page - 1}, currentFilters)"><i class="fas fa-chevron-left"></i></button>`;
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
    html += `<button class="btn-sm ${i === page ? 'btn-primary' : 'btn-secondary'}" onclick="loadUsers(${i}, currentFilters)">${i}</button>`;
  }
  html += `<button class="btn-sm btn-secondary" ${page >= pages ? 'disabled' : ''} onclick="loadUsers(${page + 1}, currentFilters)"><i class="fas fa-chevron-right"></i></button>`;
  html += '</div>';
  container.innerHTML = html;
}

async function changeUserStatus(id, status) {
  const res = await fetch(`${API_BASE}/admin/users/${id}/status`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  });
  const json = await res.json();
  if (json.success) { loadUsers(currentPage, currentFilters); }
  else { alert(json.error || 'Operation failed.'); }
}

window.verifyUser = (id) => changeUserStatus(id, 'active');
window.suspendUser = (id) => {
  if (confirm('Suspend this user?')) changeUserStatus(id, 'suspended');
};
window.deleteUser = async (id) => {
  if (!confirm('Permanently delete this user? This cannot be undone.')) return;
  const res = await fetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE', headers: await authHeaders() });
  const json = await res.json();
  if (json.success) loadUsers(currentPage, currentFilters);
  else alert(json.error || 'Delete failed.');
};

function initSearch() {
  const searchEl = document.getElementById('userSearch');
  const roleEl = document.getElementById('roleFilter');
  const statusEl = document.getElementById('statusFilter');
  const applyBtn = document.getElementById('applyFilters');

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const filters = {};
      if (searchEl?.value) filters.search = searchEl.value;
      if (roleEl?.value) filters.role = roleEl.value;
      if (statusEl?.value) filters.status = statusEl.value;
      loadUsers(1, filters);
    });
  }

  if (searchEl) {
    searchEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') applyBtn?.click();
    });
  }
}

function initExport() {
  document.getElementById('exportBtn')?.addEventListener('click', async () => {
    const params = new URLSearchParams({ ...currentFilters, format: 'csv' });
    window.location.href = `${API_BASE}/admin/users/export?${params}`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  initSearch();
  initExport();
});
