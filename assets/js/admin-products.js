/**
 * Admin Products JS
 * Manages product listing, moderation, and category operations.
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
    pending: 'badge-orange', rejected: 'badge-red', deleted: 'badge-red',
  };
  return `<span class="badge-pill ${map[status] || 'badge-gray'}">${status ?? 'unknown'}</span>`;
}

async function loadProducts(page = 1, filters = {}) {
  currentPage = page;
  currentFilters = filters;

  const params = new URLSearchParams({ page, limit: 20, ...filters });
  const tbody = document.getElementById('productsTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8">Loading…</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/admin/products?${params}`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load products.');

    const products = json.data || [];
    const meta = json.meta || {};

    if (tbody) {
      tbody.innerHTML = products.length
        ? products.map(p => `
          <tr>
            <td><input type="checkbox" value="${p.id}"/></td>
            <td>
              <a href="product-detail.html?id=${p.id}" style="font-weight:600;text-decoration:none;color:#0a0e27">
                ${p.name || '—'}
              </a>
              <div style="font-size:.78rem;color:#94a3b8">${p.sku || ''}</div>
            </td>
            <td>${p.category?.name || '—'}</td>
            <td>${p.supplier?.company_name || '—'}</td>
            <td>$${(+p.price || 0).toFixed(2)}</td>
            <td>${p.stock_quantity ?? 0}</td>
            <td>${statusBadge(p.status)}</td>
            <td>
              <div class="btn-action-group">
                ${p.status === 'pending' ? `<button class="btn-sm btn-success" onclick="approveProduct('${p.id}')"><i class="fas fa-check"></i> Approve</button>` : ''}
                <a href="product-detail.html?id=${p.id}" class="btn-sm btn-secondary"><i class="fas fa-eye"></i></a>
                <button class="btn-sm btn-warning" onclick="toggleFeatured('${p.id}', ${!p.is_featured})">
                  <i class="fas fa-${p.is_featured ? 'star' : 'star'}" style="color:${p.is_featured ? '#f59e0b' : 'inherit'}"></i>
                </button>
                <button class="btn-sm btn-danger" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>`)
          .join('')
        : '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8">No products found.</td></tr>';
    }

    renderPagination(meta.total || 0, page, 20);
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#ef4444">${err.message}</td></tr>`;
  }
}

function renderPagination(total, page, limit) {
  const container = document.getElementById('paginationContainer');
  if (!container) return;
  const pages = Math.ceil(total / limit);
  if (pages <= 1) { container.innerHTML = ''; return; }

  let html = '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;padding:12px 0">';
  html += `<span style="font-size:.85rem;color:#64748b">Page ${page} of ${pages}</span>`;
  html += `<button class="btn-sm btn-secondary" ${page <= 1 ? 'disabled' : ''} onclick="loadProducts(${page - 1}, currentFilters)"><i class="fas fa-chevron-left"></i></button>`;
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
    html += `<button class="btn-sm ${i === page ? 'btn-primary' : 'btn-secondary'}" onclick="loadProducts(${i}, currentFilters)">${i}</button>`;
  }
  html += `<button class="btn-sm btn-secondary" ${page >= pages ? 'disabled' : ''} onclick="loadProducts(${page + 1}, currentFilters)"><i class="fas fa-chevron-right"></i></button>`;
  html += '</div>';
  container.innerHTML = html;
}

window.approveProduct = async (id) => {
  const res = await fetch(`${API_BASE}/admin/products/${id}/approve`, { method: 'PUT', headers: await authHeaders() });
  const json = await res.json();
  if (json.success) loadProducts(currentPage, currentFilters);
  else alert(json.error || 'Approval failed.');
};

window.toggleFeatured = async (id, value) => {
  const res = await fetch(`${API_BASE}/admin/products/${id}/feature`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ is_featured: value }),
  });
  const json = await res.json();
  if (json.success) loadProducts(currentPage, currentFilters);
  else alert(json.error || 'Update failed.');
};

window.deleteProduct = async (id) => {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const res = await fetch(`${API_BASE}/admin/products/${id}`, { method: 'DELETE', headers: await authHeaders() });
  const json = await res.json();
  if (json.success) loadProducts(currentPage, currentFilters);
  else alert(json.error || 'Delete failed.');
};

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/admin/products/categories`, { headers: await authHeaders() });
    const json = await res.json();
    if (!json.success) return;

    const select = document.getElementById('categoryFilter');
    if (select) {
      const options = (json.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      select.innerHTML = `<option value="">All Categories</option>${options}`;
    }
  } catch (_) {}
}

function initFilters() {
  const searchEl = document.getElementById('productSearch');
  const categoryEl = document.getElementById('categoryFilter');
  const statusEl = document.getElementById('statusFilter');
  const applyBtn = document.getElementById('applyFilters');

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const filters = {};
      if (searchEl?.value) filters.search = searchEl.value;
      if (categoryEl?.value) filters.category_id = categoryEl.value;
      if (statusEl?.value) filters.status = statusEl.value;
      loadProducts(1, filters);
    });
  }
}

function initPendingTab() {
  const btn = document.getElementById('pendingTabBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const params = new URLSearchParams({ page: 1, limit: 20 });
    try {
      const res = await fetch(`${API_BASE}/admin/products/pending?${params}`, { headers: await authHeaders() });
      const json = await res.json();
      // Switch to pending view
      if (json.success) {
        currentFilters = { status: 'pending' };
        loadProducts(1, { status: 'pending' });
      }
    } catch (_) {}
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadCategories();
  initFilters();
  initPendingTab();
});
