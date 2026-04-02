/**
 * supplier.js - Supplier Management Frontend Logic
 * Globex Sky Platform
 */

const SupplierAPI = {
  get BASE_URL() {
    return (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';
  },

  get SUPPLIERS_URL() {
    return this.BASE_URL + '/suppliers';
  },

  getHeaders(json = true) {
    let token = null;
    try {
      const sess = JSON.parse(localStorage.getItem('globexSession') || 'null');
      token = (sess && sess.token) || localStorage.getItem('globexToken') || localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
            const sb = JSON.parse(localStorage.getItem(k) || 'null');
            if (sb && sb.access_token) { token = sb.access_token; break; }
          }
        }
      }
    } catch (_) {}
    const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  },

  // ── Public directory ────────────────────────────────────────────────────────

  async listSuppliers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${this.SUPPLIERS_URL}${qs ? '?' + qs : ''}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load suppliers');
    return res.json();
  },

  async getSupplier(id) {
    const res = await fetch(`${this.SUPPLIERS_URL}/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Supplier not found');
    return res.json();
  },

  async getSupplierPublicProducts(id, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${this.SUPPLIERS_URL}/${id}/products${qs ? '?' + qs : ''}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load supplier products');
    return res.json();
  },

  async contactSupplier(id, data) {
    const res = await fetch(`${this.SUPPLIERS_URL}/${id}/contact`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send inquiry' }));
      throw new Error(err.error || 'Failed to send inquiry');
    }
    return res.json();
  },

  // ── Supplier registration ───────────────────────────────────────────────────

  async register(data) {
    const res = await fetch(`${this.SUPPLIERS_URL}/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  // ── Supplier dashboard (authenticated) ─────────────────────────────────────

  async getDashboard() {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/stats`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load dashboard');
    return res.json();
  },

  async getProfile() {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/profile`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load profile');
    return res.json();
  },

  async updateProfile(data) {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  // Products (supplier's own products)
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/products${query ? '?' + query : ''}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load products');
    return res.json();
  },

  async createProduct(data) {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/products`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create product');
    return res.json();
  },

  async updateProduct(id, data) {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/products/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },

  async deleteProduct(id) {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/products/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return res.json();
  },

  // Orders
  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/orders${query ? '?' + query : ''}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load orders');
    return res.json();
  },

  async updateOrderStatus(orderId, status, notes = '') {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/orders/${orderId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status, notes })
    });
    if (!res.ok) throw new Error('Failed to update order status');
    return res.json();
  },

  // Analytics
  async getAnalytics(period = '30d') {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/analytics?period=${period}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load analytics');
    return res.json();
  },

  // Earnings
  async getEarnings() {
    const res = await fetch(`${this.SUPPLIERS_URL}/dashboard/earnings`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load earnings');
    return res.json();
  },
};

/**
 * Format supplier verification status
 */
function formatSupplierStatus(status) {
  const statuses = {
    pending: { label: 'Pending Review', class: 'badge-warning', icon: 'fa-clock' },
    under_review: { label: 'Under Review', class: 'badge-info', icon: 'fa-search' },
    verified: { label: 'Verified', class: 'badge-success', icon: 'fa-check-circle' },
    rejected: { label: 'Rejected', class: 'badge-danger', icon: 'fa-times-circle' },
    suspended: { label: 'Suspended', class: 'badge-danger', icon: 'fa-ban' }
  };
  return statuses[status] || { label: status, class: 'badge-secondary', icon: 'fa-question' };
}

/**
 * Format supplier tier badge
 */
function formatSupplierTier(tier) {
  const tiers = {
    free: { label: 'Free', color: '#94a3b8', bg: '#f1f5f9' },
    basic: { label: 'Basic', color: '#374151', bg: '#e5e7eb' },
    gold: { label: 'Gold', color: '#92400e', bg: '#fef3c7' },
    platinum: { label: 'Platinum', color: '#1e3a8a', bg: '#dbeafe' },
    diamond: { label: 'Diamond', color: '#6b21a8', bg: '#ede9fe' }
  };
  return tiers[tier] || tiers.free;
}

/**
 * Format order status
 */
function formatOrderStatus(status) {
  const statuses = {
    pending: { label: 'Pending', class: 'badge-warning' },
    confirmed: { label: 'Confirmed', class: 'badge-info' },
    production: { label: 'In Production', class: 'badge-info' },
    quality_check: { label: 'Quality Check', class: 'badge-warning' },
    ready_to_ship: { label: 'Ready to Ship', class: 'badge-success' },
    shipped: { label: 'Shipped', class: 'badge-success' },
    delivered: { label: 'Delivered', class: 'badge-success' },
    cancelled: { label: 'Cancelled', class: 'badge-danger' },
    refunded: { label: 'Refunded', class: 'badge-danger' }
  };
  return statuses[status] || { label: status, class: 'badge-secondary' };
}

/**
 * Calculate supplier performance score
 */
function calcPerformanceScore(supplier) {
  const weights = {
    rating: 0.3,
    delivery: 0.3,
    response: 0.2,
    completion: 0.2
  };
  const score =
    (supplier.rating / 5 * 100) * weights.rating +
    (supplier.on_time_delivery_rate || 0) * weights.delivery +
    (supplier.response_rate || 0) * weights.response +
    (supplier.order_completion_rate || 0) * weights.completion;
  return Math.round(score);
}

/**
 * Render supplier card for marketplace
 */
function renderSupplierCard(supplier) {
  const tierInfo = formatSupplierTier(supplier.tier);
  const statusInfo = formatSupplierStatus(supplier.verification_status);
  return `
    <div class="supplier-card">
      <div class="supplier-header">
        <div class="supplier-logo">
          ${supplier.logo_url
            ? `<img src="${supplier.logo_url}" alt="${supplier.company_name}">`
            : `<div class="supplier-avatar">${supplier.company_name?.substring(0, 2).toUpperCase()}</div>`
          }
        </div>
        <div>
          <div class="supplier-name">${supplier.company_name}</div>
          <div class="supplier-location"><i class="fas fa-map-marker-alt"></i> ${supplier.city || ''}, ${supplier.country || ''}</div>
        </div>
        ${supplier.verification_status === 'verified' ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
      </div>
      <div class="supplier-stats">
        <span><i class="fas fa-star" style="color:#f59e0b"></i> ${supplier.rating || '—'}</span>
        <span><i class="fas fa-shopping-bag"></i> ${supplier.total_orders || 0} Orders</span>
        <span class="tier-badge" style="background:${tierInfo.bg};color:${tierInfo.color}">${tierInfo.label}</span>
      </div>
      <div class="supplier-categories">
        ${(supplier.main_categories || []).slice(0, 3).map(c => `<span class="category-tag">${c}</span>`).join('')}
      </div>
    </div>
  `;
}

/**
 * Load and render supplier dashboard stats
 */
async function loadSupplierDashboard() {
  try {
    const res = await SupplierAPI.getDashboard();
    const data = res.data || res.stats || res;
    if (!data) return;
    function formatCurrency(val) {
      if (val == null) return null;
      return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    const revenue = formatCurrency(data.total_earned != null ? data.total_earned : data.revenue);
    // Support both dashboard.html IDs and index.html IDs
    const updates = {
      'dashTotalOrders': data.total_orders,
      'dashPendingOrders': data.pending_orders,
      'dashRevenue': revenue,
      'dashRating': data.rating || '—',
      'dashTotalProducts': data.total_products,
      'dashResponseRate': data.response_rate ? `${data.response_rate}%` : '—',
      // Alternative IDs used on index.html
      'stat-orders': data.total_orders,
      'stat-earnings': formatCurrency(data.total_earned),
      'stat-products': data.total_products,
      'stat-rating': data.rating,
    };
    Object.entries(updates).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val != null) el.textContent = val;
    });
  } catch (e) {
    console.warn('Dashboard load error:', e);
  }
}

/**
 * Load supplier products list into a table body (tbody element by id)
 */
async function loadSupplierProducts(tbodyId, emptyMessage) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  try {
    const res = await SupplierAPI.getProducts();
    const products = res.data || [];
    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8">${emptyMessage || 'No products yet.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = products.map(p => {
      const statusClass = { active: 'badge-green', inactive: 'badge-orange', pending: 'badge-orange', rejected: 'badge-red' }[p.status] || 'badge-gray';
      return `<tr>
        <td>${escHtml(p.title || 'Untitled')}</td>
        <td>$${parseFloat(p.price || 0).toFixed(2)}</td>
        <td>${p.stock_quantity != null ? p.stock_quantity : '—'}</td>
        <td><span class="badge ${statusClass}">${escHtml(p.status || 'pending')}</span></td>
        <td>
          <a href="products-edit.html?id=${escHtml(p.id)}" class="btn btn-sm btn-secondary">Edit</a>
          <button class="btn btn-sm btn-danger" data-product-id="${escHtml(p.id)}">Delete</button>
        </td>
      </tr>`;
    }).join('');
    // Attach delete handlers via addEventListener (no inline onclick)
    tbody.querySelectorAll('button[data-product-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteSupplierProduct(btn.getAttribute('data-product-id'), btn));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8">Failed to load products.</td></tr>`;
    console.warn('Products load error:', e);
  }
}

/**
 * Delete a supplier product with confirmation
 */
async function deleteSupplierProduct(id, btn) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await SupplierAPI.deleteProduct(id);
    const row = btn && btn.closest('tr');
    if (row) row.remove();
  } catch (e) {
    alert('Failed to delete product: ' + e.message);
  }
}

/**
 * Load supplier orders into a table body
 */
async function loadSupplierOrders(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  try {
    const res = await SupplierAPI.getOrders();
    const orders = res.data || [];
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">No orders yet.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => {
      const statusInfo = formatOrderStatus(o.status);
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      return `<tr>
        <td><a href="orders-detail.html?id=${escHtml(o.id)}" style="color:#0052CC;font-weight:600">#${escHtml(o.id.substring(0, 8).toUpperCase())}</a></td>
        <td>$${parseFloat(o.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td><span class="badge ${statusInfo.class}">${statusInfo.label}</span></td>
        <td>${date}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="markOrderShipped('${escHtml(o.id)}',this)">Mark Shipped</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">Failed to load orders.</td></tr>';
    console.warn('Orders load error:', e);
  }
}

/**
 * Mark an order as shipped
 */
async function markOrderShipped(orderId, btn) {
  try {
    await SupplierAPI.updateOrderStatus(orderId, 'shipped');
    const row = btn && btn.closest('tr');
    if (row) {
      const statusCell = row.querySelector('.badge');
      if (statusCell) { statusCell.className = 'badge badge-blue'; statusCell.textContent = 'Shipped'; }
    }
  } catch (e) {
    alert('Failed to update order: ' + e.message);
  }
}

/**
 * Load the public supplier directory into a grid container
 */
async function loadSupplierDirectory(gridId, params) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Loading suppliers...</p></div>';
  try {
    const res = await SupplierAPI.listSuppliers(params || {});
    const suppliers = res.data || [];
    if (!suppliers.length) {
      grid.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">No suppliers found.</div>';
      return;
    }
    grid.innerHTML = suppliers.map(s => renderSupplierCard(s)).join('');
  } catch (e) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Failed to load suppliers.</div>';
    console.warn('Supplier directory load error:', e);
  }
}

/**
 * Load and populate supplier profile page from ?id= URL param
 */
async function loadSupplierProfilePage() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return;
  try {
    const res = await SupplierAPI.getSupplier(id);
    const s = res.data || res.supplier || res;
    if (!s) return;
    // Update common fields
    const fields = { 'supplier-company-name': s.company_name, 'supplier-country': s.country, 'supplier-city': s.city, 'supplier-rating': s.rating, 'supplier-orders': s.total_orders };
    Object.entries(fields).forEach(([id2, val]) => { const el = document.getElementById(id2); if (el && val != null) el.textContent = val; });
    // Set contact form supplier id
    const contactForm = document.getElementById('contact-supplier-form');
    if (contactForm) contactForm.setAttribute('data-supplier-id', s.id);
  } catch (e) {
    console.warn('Supplier profile load error:', e);
  }
}

/**
 * Submit contact supplier form
 */
async function submitContactSupplier(form) {
  const supplierId = form.getAttribute('data-supplier-id') || new URLSearchParams(window.location.search).get('id');
  if (!supplierId) { alert('Cannot identify supplier.'); return; }
  const data = {
    subject: (form.querySelector('[name="subject"]') || {}).value || 'Product Inquiry',
    message: (form.querySelector('[name="message"]') || {}).value,
    product_reference: (form.querySelector('[name="product_reference"]') || {}).value || null,
    email: (form.querySelector('[name="email"]') || {}).value || null,
  };
  if (!data.message) { alert('Please enter a message.'); return; }
  try {
    await SupplierAPI.contactSupplier(supplierId, data);
    alert('Your inquiry has been sent!');
    form.reset();
  } catch (e) {
    alert('Failed to send inquiry: ' + e.message);
  }
}

/**
 * HTML escape utility
 */
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Validate supplier registration form
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

// Export for use in pages
window.SupplierAPI = SupplierAPI;
window.formatSupplierStatus = formatSupplierStatus;
window.formatSupplierTier = formatSupplierTier;
window.formatOrderStatus = formatOrderStatus;
window.calcPerformanceScore = calcPerformanceScore;
window.renderSupplierCard = renderSupplierCard;
window.loadSupplierDashboard = loadSupplierDashboard;
window.loadSupplierProducts = loadSupplierProducts;
window.deleteSupplierProduct = deleteSupplierProduct;
window.loadSupplierOrders = loadSupplierOrders;
window.markOrderShipped = markOrderShipped;
window.loadSupplierDirectory = loadSupplierDirectory;
window.loadSupplierProfilePage = loadSupplierProfilePage;
window.submitContactSupplier = submitContactSupplier;
window.validateSupplierForm = validateSupplierForm;
window.escHtml = escHtml;
