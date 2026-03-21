/**
 * Globex Sky — admin-api.js
 * Wires up the admin dashboard pages to the real backend API via window.API.
 * Handles stats, user management, order management, and product moderation.
 */

(function () {
  'use strict';

  /* ─── Guard: admin-only pages ────────────────────────────────────────── */

  function isAdminUser() {
    try {
      const user = JSON.parse(localStorage.getItem('globexUser') || 'null');
      return user && (user.role === 'admin' || user.role === 'super_admin');
    } catch (_) {
      return false;
    }
  }

  function requireAdmin() {
    if (!isAdminUser()) {
      window.location.href = '/pages/auth/login.html?redirect=' +
        encodeURIComponent(window.location.pathname + window.location.search);
      return false;
    }
    return true;
  }

  /* ─── Utility Helpers ────────────────────────────────────────────────── */

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function formatPrice(amount) {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    } catch (_) {
      return `$${Number(amount).toFixed(2)}`;
    }
  }

  function formatDate(isoString) {
    if (!isoString) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(isoString));
    } catch (_) {
      return isoString;
    }
  }

  function statusBadge(status) {
    const map = {
      active: 'success', inactive: 'secondary', suspended: 'danger',
      pending: 'warning', approved: 'success', rejected: 'danger',
    };
    return `<span class="badge badge--${map[status] || 'secondary'}">${status}</span>`;
  }

  function showToast(message, type) {
    if (window.GlobexSky && window.GlobexSky.showToast) {
      window.GlobexSky.showToast(message, type);
    } else {
      console.info(`[admin] ${type}: ${message}`);
    }
  }

  /* ─── Dashboard Stats ────────────────────────────────────────────────── */

  async function loadDashboardStats() {
    const statsCards = document.querySelectorAll('[data-stat]');
    if (!statsCards.length) return;

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.analytics.dashboard();
      const stats = res.data || res;

      statsCards.forEach((card) => {
        const key = card.dataset.stat;
        if (stats[key] !== undefined) {
          const valueEl = card.querySelector('.stat-value, [data-stat-value]') || card;
          valueEl.textContent = typeof stats[key] === 'number' && key.includes('revenue')
            ? formatPrice(stats[key])
            : stats[key].toLocaleString();
        }
      });
    } catch (err) {
      console.error('[admin-api] stats error:', err);
    }
  }

  /* ─── User Management ────────────────────────────────────────────────── */

  async function loadUsers(page) {
    page = page || parseInt(getParam('page')) || 1;
    const tableBody = document.getElementById('users-tbody') ||
      document.querySelector('[data-users-table] tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading users…</td></tr>';

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.get(`/admin/users?page=${page}&limit=20`);
      const users = res.data || res.users || res || [];
      const total = res.total || res.meta?.total || users.length;

      if (!users.length) {
        tableBody.innerHTML = '<tr><td colspan="7" class="no-data">No users found.</td></tr>';
        return;
      }

      tableBody.innerHTML = users.map((user) =>
        `<tr data-user-id="${user.id}">
          <td>${user.id}</td>
          <td>${user.full_name || user.name || '—'}</td>
          <td>${user.email || '—'}</td>
          <td>${user.role || 'buyer'}</td>
          <td>${statusBadge(user.status || 'active')}</td>
          <td>${formatDate(user.created_at)}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-secondary btn-view-user"
                    data-id="${user.id}">View</button>
            <button class="btn btn-sm ${user.status === 'active' ? 'btn-warning' : 'btn-success'} btn-toggle-user"
                    data-id="${user.id}"
                    data-status="${user.status || 'active'}">
              ${user.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
          </td>
        </tr>`
      ).join('');

      renderAdminPagination(total, page, 20, 'loadUsers');
    } catch (err) {
      tableBody.innerHTML = '<tr><td colspan="7" class="api-error">Failed to load users.</td></tr>';
      console.error('[admin-api] users error:', err);
    }
  }

  async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      if (!window.API) throw new Error('API not available');
      await window.API.put(`/admin/users/${userId}`, { status: newStatus });
      showToast(`User ${newStatus === 'active' ? 'activated' : 'suspended'}.`, 'success');
      loadUsers();
    } catch (err) {
      showToast((err && err.message) || 'Failed to update user status.', 'error');
    }
  }

  /* ─── Order Management ───────────────────────────────────────────────── */

  async function loadAdminOrders(page) {
    page = page || parseInt(getParam('page')) || 1;
    const tableBody = document.getElementById('orders-tbody') ||
      document.querySelector('[data-admin-orders] tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading orders…</td></tr>';

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.get(`/admin/orders?page=${page}&limit=20`);
      const orders = res.data || res.orders || res || [];
      const total = res.total || res.meta?.total || orders.length;

      if (!orders.length) {
        tableBody.innerHTML = '<tr><td colspan="7" class="no-data">No orders found.</td></tr>';
        return;
      }

      tableBody.innerHTML = orders.map((order) =>
        `<tr data-order-id="${order.id}">
          <td><a href="/pages/sourcing/order-tracking.html?order_id=${order.id}">#${order.id}</a></td>
          <td>${order.buyer_name || order.buyer_email || '—'}</td>
          <td>${order.items_count || '—'} items</td>
          <td>${statusBadge(order.status)}</td>
          <td>${formatPrice(order.total_amount || order.grand_total || 0)}</td>
          <td>${formatDate(order.created_at)}</td>
          <td class="table-actions">
            <select class="form-select form-select-sm order-status-select"
                    data-id="${order.id}">
              ${['pending','processing','shipped','delivered','cancelled']
                .map((s) => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`)
                .join('')}
            </select>
          </td>
        </tr>`
      ).join('');

      renderAdminPagination(total, page, 20, 'loadAdminOrders');
    } catch (err) {
      tableBody.innerHTML = '<tr><td colspan="7" class="api-error">Failed to load orders.</td></tr>';
      console.error('[admin-api] orders error:', err);
    }
  }

  async function updateOrderStatus(orderId, newStatus) {
    try {
      if (!window.API) throw new Error('API not available');
      await window.API.put(`/admin/orders/${orderId}`, { status: newStatus });
      showToast('Order status updated.', 'success');
    } catch (err) {
      showToast((err && err.message) || 'Failed to update order.', 'error');
    }
  }

  /* ─── Product Moderation ─────────────────────────────────────────────── */

  async function loadAdminProducts(page) {
    page = page || parseInt(getParam('page')) || 1;
    const tableBody = document.getElementById('products-tbody') ||
      document.querySelector('[data-admin-products] tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading products…</td></tr>';

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.get(`/admin/products?page=${page}&limit=20`);
      const products = res.data || res.products || res || [];
      const total = res.total || res.meta?.total || products.length;

      if (!products.length) {
        tableBody.innerHTML = '<tr><td colspan="7" class="no-data">No products found.</td></tr>';
        return;
      }

      tableBody.innerHTML = products.map((p) =>
        `<tr data-product-id="${p.id}">
          <td>${p.id}</td>
          <td>
            <img src="${p.main_image || '/assets/images/placeholder.jpg'}"
                 alt="${p.name}" class="admin-thumb" loading="lazy"/>
            ${p.name}
          </td>
          <td>${p.supplier_name || '—'}</td>
          <td>${p.category_name || '—'}</td>
          <td>$${(p.min_price || p.price || 0).toFixed(2)}</td>
          <td>${statusBadge(p.status || 'active')}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-secondary btn-edit-product"
                    data-id="${p.id}">Edit</button>
            <button class="btn btn-sm btn-danger btn-delete-product"
                    data-id="${p.id}">Delete</button>
          </td>
        </tr>`
      ).join('');

      renderAdminPagination(total, page, 20, 'loadAdminProducts');
    } catch (err) {
      tableBody.innerHTML = '<tr><td colspan="7" class="api-error">Failed to load products.</td></tr>';
      console.error('[admin-api] products error:', err);
    }
  }

  async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
    try {
      if (!window.API) throw new Error('API not available');
      await window.API.delete(`/admin/products/${productId}`);
      showToast('Product deleted successfully.', 'success');
      loadAdminProducts();
    } catch (err) {
      showToast((err && err.message) || 'Failed to delete product.', 'error');
    }
  }

  /* ─── Pagination ─────────────────────────────────────────────────────── */

  function renderAdminPagination(total, currentPage, limit, loaderFn) {
    const container = document.getElementById('admin-pagination') ||
      document.querySelector('.admin-pagination');
    if (!container) return;

    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const buttons = [];
    if (currentPage > 1) {
      buttons.push(`<button class="btn btn-sm btn-secondary pagination-btn"
                            data-page="${currentPage - 1}"
                            data-loader="${loaderFn}">Prev</button>`);
    }
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      buttons.push(`<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-btn"
                            data-page="${i}"
                            data-loader="${loaderFn}">${i}</button>`);
    }
    if (currentPage < totalPages) {
      buttons.push(`<button class="btn btn-sm btn-secondary pagination-btn"
                            data-page="${currentPage + 1}"
                            data-loader="${loaderFn}">Next</button>`);
    }
    container.innerHTML = buttons.join(' ');
  }

  /* ─── Delegated Event Listeners ──────────────────────────────────────── */

  function initAdminEvents() {
    document.addEventListener('click', (e) => {
      // Pagination
      const pageBtn = e.target.closest('.pagination-btn[data-loader]');
      if (pageBtn) {
        const page = parseInt(pageBtn.dataset.page, 10);
        const loader = pageBtn.dataset.loader;
        if (loader === 'loadUsers') loadUsers(page);
        else if (loader === 'loadAdminOrders') loadAdminOrders(page);
        else if (loader === 'loadAdminProducts') loadAdminProducts(page);
      }

      // Toggle user status
      const toggleBtn = e.target.closest('.btn-toggle-user');
      if (toggleBtn) {
        toggleUserStatus(toggleBtn.dataset.id, toggleBtn.dataset.status);
      }

      // Delete product
      const deleteBtn = e.target.closest('.btn-delete-product');
      if (deleteBtn) {
        deleteProduct(deleteBtn.dataset.id);
      }
    });

    // Order status change
    document.addEventListener('change', (e) => {
      const select = e.target.closest('.order-status-select');
      if (select) {
        updateOrderStatus(select.dataset.id, select.value);
      }
    });
  }

  /* ─── Init ────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    // Only run on admin pages
    const isAdminPage = window.location.pathname.startsWith('/pages/admin/');
    if (!isAdminPage) return;

    if (!requireAdmin()) return;

    initAdminEvents();
    loadDashboardStats();
    loadUsers();
    loadAdminOrders();
    loadAdminProducts();
  });

  /* ─── Exports ─────────────────────────────────────────────────────────── */
  window.GlobexAdmin = {
    loadDashboardStats,
    loadUsers,
    loadAdminOrders,
    loadAdminProducts,
  };
})();
