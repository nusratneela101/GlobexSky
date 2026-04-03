/**
 * supplier.js - Supplier Management Frontend Logic
 * Globex Sky Platform
 */

const SupplierAPI = {
  get BASE_URL() {
    return (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';
  },

  getHeaders(json = true) {
    let token = null;
    try {
      token = (JSON.parse(localStorage.getItem('globexSession') || 'null') || {}).token
        || localStorage.getItem('globexToken')
        || localStorage.getItem('token');
      if (!token) {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
            const s = JSON.parse(localStorage.getItem(k) || 'null');
            if (s && s.access_token) { token = s.access_token; break; }
          }
        }
      }
    } catch (_) { /* ignore */ }
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  },

  async _fetch(path, options = {}) {
    const res = await fetch(`${this.BASE_URL}${path}`, {
      headers: this.getHeaders(options.method !== 'DELETE'),
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return { success: true };
    return res.json();
  },

  // ── Public supplier directory ──────────────────────────────────────────────

  async listSuppliers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._fetch(`/suppliers${qs ? '?' + qs : ''}`);
  },

  async getSupplier(id) {
    return this._fetch(`/suppliers/${id}`);
  },

  async getSupplierProducts(id, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._fetch(`/suppliers/${id}/products${qs ? '?' + qs : ''}`);
  },

  async contactSupplier(id, data) {
    return this._fetch(`/suppliers/${id}/contact`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ── Supplier registration ──────────────────────────────────────────────────

  async register(data) {
    return this._fetch('/suppliers/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ── Supplier dashboard (authenticated) ────────────────────────────────────

  async getDashboard() {
    return this._fetch('/suppliers/dashboard/stats');
  },

  async getProfile() {
    // Profile is returned as part of dashboard stats or use GET /suppliers/:id
    return this._fetch('/suppliers/dashboard/stats');
  },

  async updateProfile(data) {
    return this._fetch('/suppliers/dashboard/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Products
  async getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._fetch(`/suppliers/dashboard/products${qs ? '?' + qs : ''}`);
  },

  async createProduct(data) {
    return this._fetch('/suppliers/dashboard/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProduct(id, data) {
    return this._fetch(`/suppliers/dashboard/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProduct(id) {
    return this._fetch(`/suppliers/dashboard/products/${id}`, { method: 'DELETE' });
  },

  // Orders
  async getOrders(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._fetch(`/suppliers/dashboard/orders${qs ? '?' + qs : ''}`);
  },

  async updateOrderStatus(orderId, status, notes = '') {
    return this._fetch(`/suppliers/dashboard/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  },

  // Analytics
  async getAnalytics(period = '30d') {
    return this._fetch(`/suppliers/dashboard/analytics?period=${period}`);
  },

  async getEarnings() {
    return this._fetch('/suppliers/dashboard/earnings');
  },
};

// ── Helper formatters ──────────────────────────────────────────────────────────

function formatSupplierStatus(status) {
  const statuses = {
    pending:      { label: 'Pending Review', class: 'badge-warning', icon: 'fa-clock' },
    under_review: { label: 'Under Review',   class: 'badge-info',    icon: 'fa-search' },
    verified:     { label: 'Verified',       class: 'badge-success', icon: 'fa-check-circle' },
    rejected:     { label: 'Rejected',       class: 'badge-danger',  icon: 'fa-times-circle' },
    suspended:    { label: 'Suspended',      class: 'badge-danger',  icon: 'fa-ban' },
  };
  return statuses[status] || { label: status || 'Unknown', class: 'badge-secondary', icon: 'fa-question' };
}

function formatSupplierTier(tier) {
  const tiers = {
    free:     { label: 'Free',     color: '#94a3b8', bg: '#f1f5f9' },
    basic:    { label: 'Basic',    color: '#374151', bg: '#e5e7eb' },
    gold:     { label: 'Gold',     color: '#92400e', bg: '#fef3c7' },
    platinum: { label: 'Platinum', color: '#1e3a8a', bg: '#dbeafe' },
    diamond:  { label: 'Diamond',  color: '#6b21a8', bg: '#ede9fe' },
  };
  return tiers[tier] || tiers.free;
}

function formatOrderStatus(status) {
  const statuses = {
    pending:        { label: 'Pending',         class: 'badge-warning' },
    confirmed:      { label: 'Confirmed',        class: 'badge-info' },
    production:     { label: 'In Production',    class: 'badge-info' },
    quality_check:  { label: 'Quality Check',    class: 'badge-warning' },
    ready_to_ship:  { label: 'Ready to Ship',    class: 'badge-success' },
    shipped:        { label: 'Shipped',          class: 'badge-success' },
    delivered:      { label: 'Delivered',        class: 'badge-success' },
    cancelled:      { label: 'Cancelled',        class: 'badge-danger' },
    refunded:       { label: 'Refunded',         class: 'badge-danger' },
  };
  return statuses[status] || { label: status || '—', class: 'badge-secondary' };
}

function calcPerformanceScore(supplier) {
  const weights = { rating: 0.3, delivery: 0.3, response: 0.2, completion: 0.2 };
  const score =
    (supplier.rating / 5 * 100) * weights.rating +
    (supplier.on_time_delivery_rate || 0) * weights.delivery +
    (supplier.response_rate || 0) * weights.response +
    (supplier.order_completion_rate || 0) * weights.completion;
  return Math.round(score);
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSupplierCard(supplier) {
  const tierInfo = formatSupplierTier(supplier.plan_type || supplier.tier);
  const isVerified = supplier.verification_status === 'verified';
  const initials = (supplier.company_name || 'S').substring(0, 2).toUpperCase();
  const safeId = encodeURIComponent(supplier.id || '');
  return `
    <div class="supplier-card" data-supplier-id="${escHtml(supplier.id)}" data-supplier-name="${escHtml(supplier.company_name)}" role="button" tabindex="0">
      <div class="supplier-header">
        <div class="supplier-logo">
          ${supplier.logo_url
            ? `<img src="${escHtml(supplier.logo_url)}" alt="${escHtml(supplier.company_name)}" loading="lazy">`
            : `<div class="supplier-avatar">${initials}</div>`}
        </div>
        <div>
          <div class="supplier-name">${escHtml(supplier.company_name)}</div>
          <div class="supplier-location"><i class="fas fa-map-marker-alt"></i> ${escHtml(supplier.city || '')}${supplier.city && supplier.country ? ', ' : ''}${escHtml(supplier.country || '')}</div>
        </div>
        ${isVerified ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
      </div>
      <div class="supplier-stats">
        <span><i class="fas fa-star" style="color:#f59e0b"></i> ${escHtml(supplier.rating || supplier.score || '—')}</span>
        <span><i class="fas fa-shopping-bag"></i> ${escHtml(supplier.total_transactions || 0)} Orders</span>
        <span class="tier-badge" style="background:${tierInfo.bg};color:${tierInfo.color}">${tierInfo.label}</span>
      </div>
      ${supplier.description ? `<p class="supplier-desc">${escHtml(supplier.description).substring(0, 100)}${supplier.description.length > 100 ? '…' : ''}</p>` : ''}
      <div style="margin-top:12px;display:flex;gap:8px">
        <a href="../supplier/storefront.html?id=${safeId}" class="btn btn-primary btn-sm js-view-profile">View Profile</a>
        <button class="btn btn-secondary btn-sm js-contact-supplier">Contact</button>
      </div>
    </div>`;
}

// ── Page init functions ────────────────────────────────────────────────────────

/**
 * Load supplier dashboard stats and populate DOM stat elements.
 */
async function loadSupplierDashboard() {
  try {
    const result = await SupplierAPI.getDashboard();
    const data = result && (result.data || result);
    if (!data) return;

    const map = {
      'stat-orders':    data.total_orders,
      'stat-products':  data.total_products,
      'stat-earnings':  data.total_earned != null ? `$${Number(data.total_earned).toLocaleString()}` : null,
      'stat-rating':    data.rating,
      // dashboard.html IDs
      'dashTotalOrders':    data.total_orders,
      'dashPendingOrders':  data.pending_orders,
      'dashRevenue':        data.total_earned != null ? `$${Number(data.total_earned).toLocaleString()}` : null,
      'dashRating':         data.rating,
      'dashTotalProducts':  data.total_products,
      'dashResponseRate':   data.response_rate != null ? `${data.response_rate}%` : null,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val != null) el.textContent = val;
    });

    // Recent orders table
    const tbody = document.getElementById('recent-orders-tbody');
    const orders = data.recent_orders || [];
    if (tbody && orders.length) {
      tbody.innerHTML = orders.map(o => {
        const st = formatOrderStatus(o.status);
        return `<tr>
          <td>${escHtml(o.id || o.order_id || '')}</td>
          <td>${escHtml(o.total || o.amount || '')}</td>
          <td><span class="badge ${escHtml(st.class)}">${escHtml(st.label)}</span></td>
        </tr>`;
      }).join('');
    }
  } catch (e) {
    console.warn('Supplier dashboard load error:', e.message);
  }
}

/**
 * Load supplier's products into a container element.
 * @param {string} containerId - ID of the container element
 */
async function loadSupplierProducts(containerId = 'products-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const result = await SupplierAPI.getProducts();
    const products = (result && (result.data || result)) || [];

    if (!products.length) {
      container.innerHTML = '<p class="empty-state">No products yet. <a href="products-add.html">Add your first product</a>.</p>';
      return;
    }

    container.innerHTML = products.map(p => `
      <tr>
        <td>${escHtml(p.title || p.name || '')}</td>
        <td>$${escHtml(Number(p.price || 0).toLocaleString())}</td>
        <td>${escHtml(p.stock_quantity != null ? p.stock_quantity : '—')}</td>
        <td><span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-secondary'}">${escHtml(p.status || '—')}</span></td>
        <td>
          <a href="products-edit.html?id=${encodeURIComponent(p.id)}" class="btn btn-sm btn-secondary">Edit</a>
          <button class="btn btn-sm btn-danger js-delete-product" data-product-id="${escHtml(p.id)}">Delete</button>
        </td>
      </tr>`).join('');

    // Event delegation for delete buttons
    container.querySelectorAll('.js-delete-product').forEach(btn => {
      btn.addEventListener('click', function () {
        deleteProduct(this.dataset.productId);
      });
    });
  } catch (e) {
    container.innerHTML = `<tr><td colspan="5" class="text-danger">Failed to load products: ${escHtml(e.message)}</td></tr>`;
  }
}

/**
 * Delete a supplier product with confirmation.
 */
async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await SupplierAPI.deleteProduct(id);
    // Reload products list
    await loadSupplierProducts('products-container');
  } catch (e) {
    alert('Failed to delete product: ' + e.message);
  }
}

/**
 * Load supplier's orders into a container element.
 * @param {string} containerId - ID of the container element
 */
async function loadSupplierOrders(containerId = 'orders-tbody') {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const result = await SupplierAPI.getOrders();
    const orders = (result && (result.data || result)) || [];

    if (!orders.length) {
      container.innerHTML = '<tr><td colspan="5" class="empty-state">No orders yet.</td></tr>';
      return;
    }

    container.innerHTML = orders.map(o => {
      const st = formatOrderStatus(o.status);
      return `<tr>
        <td>${escHtml(o.id || '')}</td>
        <td>$${escHtml(Number(o.total || 0).toLocaleString())}</td>
        <td>${escHtml(o.created_at ? new Date(o.created_at).toLocaleDateString() : '—')}</td>
        <td><span class="badge ${escHtml(st.class)}">${escHtml(st.label)}</span></td>
        <td>
          <select class="form-control form-control-sm js-order-status" data-order-id="${escHtml(o.id)}" style="width:auto">
            <option value="">Change status…</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </td>
      </tr>`;
    }).join('');

    // Event delegation for status selects
    container.querySelectorAll('.js-order-status').forEach(sel => {
      sel.addEventListener('change', function () {
        updateOrderStatus(this.dataset.orderId, this.value);
      });
    });
  } catch (e) {
    container.innerHTML = `<tr><td colspan="5" class="text-danger">Failed to load orders: ${escHtml(e.message)}</td></tr>`;
  }
}

/**
 * Update an order's status via the API.
 */
async function updateOrderStatus(orderId, status) {
  if (!status) return;
  try {
    await SupplierAPI.updateOrderStatus(orderId, status);
    await loadSupplierOrders('orders-tbody');
  } catch (e) {
    alert('Failed to update order: ' + e.message);
  }
}

/**
 * Load the public supplier directory.
 * @param {string} containerId - ID of the grid/container element
 */
async function loadSupplierDirectory(containerId = 'suppliers-grid') {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const params = {};
    const searchEl = document.getElementById('supplier-search');
    if (searchEl && searchEl.value.trim()) params.search = searchEl.value.trim();
    const countryEl = document.getElementById('filter-country');
    if (countryEl && countryEl.value) params.country = countryEl.value;
    const verifiedEl = document.getElementById('filter-verified');
    if (verifiedEl && verifiedEl.checked) params.verified = true;

    container.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Loading suppliers…</p>';

    const result = await SupplierAPI.listSuppliers(params);
    const suppliers = (result && (result.data || result)) || [];

    if (!suppliers.length) {
      container.innerHTML = '<p class="empty-state">No suppliers found matching your criteria.</p>';
      return;
    }

    container.innerHTML = suppliers.map(renderSupplierCard).join('');

    // Update count display
    const countEl = document.getElementById('supplier-count');
    if (countEl && result.meta) countEl.textContent = result.meta.total;

    // Event delegation: card click → view profile, contact button → modal
    container.addEventListener('click', function (e) {
      const contactBtn = e.target.closest('.js-contact-supplier');
      const card = e.target.closest('.supplier-card[data-supplier-id]');

      if (contactBtn) {
        e.stopPropagation();
        const c = contactBtn.closest('.supplier-card[data-supplier-id]');
        if (c) openContactModal(c.dataset.supplierId, c.dataset.supplierName);
        return;
      }

      if (card && !e.target.closest('.js-view-profile')) {
        const safeId = encodeURIComponent(card.dataset.supplierId);
        window.location.href = `../supplier/storefront.html?id=${safeId}`;
      }
    }, false);
  } catch (e) {
    container.innerHTML = `<p class="text-danger">Failed to load suppliers: ${escHtml(e.message)}</p>`;
  }
}

/**
 * Load a supplier's public profile page (reads ?id= from URL).
 */
async function loadSupplierProfilePage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return;

  try {
    const [profileRes, productsRes] = await Promise.all([
      SupplierAPI.getSupplier(id),
      SupplierAPI.getSupplierProducts(id, { limit: 8 }),
    ]);

    const s = profileRes && (profileRes.data || profileRes);
    if (!s) return;

    const setEl = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = val;
    };
    const setAttr = (sel, attr, val) => {
      const el = document.querySelector(sel);
      if (el) el[attr] = val;
    };

    setEl('#supplier-name', s.company_name || '');
    setEl('#supplier-location', [s.city, s.country].filter(Boolean).join(', '));
    setEl('#supplier-description', s.description || '');
    setEl('#supplier-rating', s.rating || s.score || '—');
    setEl('#supplier-orders', s.total_transactions || 0);
    setAttr('#supplier-logo', 'src', s.logo_url || '');

    const statusInfo = formatSupplierStatus(s.verification_status);
    const statusEl = document.getElementById('supplier-status');
    if (statusEl) {
      statusEl.textContent = statusInfo.label;
      statusEl.className = `badge ${statusInfo.class}`;
    }

    // Products section
    const productsContainer = document.getElementById('supplier-products-grid');
    const products = (productsRes && (productsRes.data || productsRes)) || [];
    if (productsContainer && products.length) {
      productsContainer.innerHTML = products.map(p => `
        <div class="product-card">
          ${p.images && p.images[0] ? `<img src="${escHtml(p.images[0])}" alt="${escHtml(p.title)}" loading="lazy">` : ''}
          <div class="product-info">
            <div class="product-name">${escHtml(p.title || '')}</div>
            <div class="product-price">$${escHtml(Number(p.price || 0).toLocaleString())}</div>
          </div>
        </div>`).join('');
    }

    // Wire contact button
    const contactBtn = document.getElementById('contact-supplier-btn');
    if (contactBtn) {
      contactBtn.onclick = () => openContactModal(id, s.company_name);
    }
  } catch (e) {
    console.warn('Supplier profile load error:', e.message);
  }
}

/**
 * Open the contact supplier modal.
 */
function openContactModal(supplierId, supplierName) {
  const modal = document.getElementById('contactModal');
  if (!modal) {
    // Fallback: navigate to contact form
    window.location.href = `../supplier/storefront.html?id=${supplierId}&contact=1`;
    return;
  }
  const nameEl = document.getElementById('contactSupplierName');
  if (nameEl) nameEl.textContent = supplierName || '';
  const idEl = document.getElementById('contactSupplierId');
  if (idEl) idEl.value = supplierId;
  modal.classList.add('open');
  modal.style.display = 'flex';
}

/**
 * Close the contact supplier modal.
 */
function closeContactModal() {
  const modal = document.getElementById('contactModal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
}

/**
 * Submit the contact supplier form.
 */
async function submitContactSupplier(formId = 'contactForm') {
  const form = document.getElementById(formId);
  if (!form) return;

  const supplierId = (document.getElementById('contactSupplierId') || {}).value;
  if (!supplierId) return;

  const data = {
    subject:      (form.querySelector('[name="subject"]') || {}).value || 'Product Inquiry',
    message:      (form.querySelector('[name="message"]') || {}).value || '',
    product_id:   (form.querySelector('[name="product_id"]') || {}).value || undefined,
    buyer_name:   (form.querySelector('[name="buyer_name"]') || {}).value || '',
    buyer_email:  (form.querySelector('[name="buyer_email"]') || {}).value || '',
    buyer_phone:  (form.querySelector('[name="buyer_phone"]') || {}).value || '',
  };

  if (!data.message.trim()) {
    alert('Please enter a message.');
    return;
  }

  const btn = form.querySelector('[type="submit"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }

  try {
    await SupplierAPI.contactSupplier(supplierId, data);
    closeContactModal();
    // Show success
    const toast = document.getElementById('toast') || document.getElementById('successMsg');
    if (toast) {
      toast.textContent = 'Your inquiry has been sent!';
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 4000);
    } else {
      alert('Your inquiry has been sent!');
    }
    form.reset();
  } catch (e) {
    alert('Failed to send inquiry: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Inquiry'; }
  }
}

/**
 * Validate supplier registration form.
 */
function validateSupplierForm(formData) {
  const errors = [];
  if (!formData.get('company_name')?.trim()) errors.push('Company name is required');
  if (!formData.get('business_type')) errors.push('Business type is required');
  if (!formData.get('country')) errors.push('Country is required');
  if (!formData.get('email')?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errors.push('Valid email is required');
  if (!formData.get('phone')?.trim()) errors.push('Phone number is required');
  return errors;
}

// ── Auto-init on page load ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  // Use data attribute if explicitly set on <body data-page="...">
  const pageAttr = document.body && document.body.dataset.page;
  const path = window.location.pathname;

  // Normalize path to just the filename for reliable matching
  const filename = path.split('/').pop() || 'index.html';

  if (pageAttr === 'supplier-dashboard' || filename === 'index.html' && path.includes('/supplier/')) {
    loadSupplierDashboard();
  } else if (pageAttr === 'supplier-products' || filename === 'products.html' && path.includes('/supplier/')) {
    loadSupplierProducts('products-tbody');
  } else if (pageAttr === 'supplier-orders' || filename === 'orders.html' && path.includes('/supplier/')) {
    loadSupplierOrders('orders-tbody');
  } else if (pageAttr === 'supplier-directory' || filename === 'index.html' && path.includes('/suppliers/')) {
    loadSupplierDirectory('suppliers-grid');
  } else if (pageAttr === 'supplier-storefront' || filename === 'storefront.html' && path.includes('/supplier/')) {
    loadSupplierProfilePage();
  }
});

// ── Exports ────────────────────────────────────────────────────────────────────

window.SupplierAPI = SupplierAPI;
window.formatSupplierStatus = formatSupplierStatus;
window.formatSupplierTier = formatSupplierTier;
window.formatOrderStatus = formatOrderStatus;
window.calcPerformanceScore = calcPerformanceScore;
window.escHtml = escHtml;
window.renderSupplierCard = renderSupplierCard;
window.loadSupplierDashboard = loadSupplierDashboard;
window.loadSupplierProducts = loadSupplierProducts;
window.loadSupplierOrders = loadSupplierOrders;
window.updateOrderStatus = updateOrderStatus;
window.deleteProduct = deleteProduct;
window.loadSupplierDirectory = loadSupplierDirectory;
window.loadSupplierProfilePage = loadSupplierProfilePage;
window.openContactModal = openContactModal;
window.closeContactModal = closeContactModal;
window.submitContactSupplier = submitContactSupplier;
window.validateSupplierForm = validateSupplierForm;
