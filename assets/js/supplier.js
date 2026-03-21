/**
 * supplier.js - Supplier Management Frontend Logic
 * Globex Sky Platform
 */

const SupplierAPI = {
  BASE_URL: '/api/v1/suppliers',

  getHeaders(json = true) {
    const token = localStorage.getItem('auth_token');
    const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  },

  async register(data) {
    const res = await fetch(`${this.BASE_URL}/register`, {
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

  async getDashboard() {
    const res = await fetch(`${this.BASE_URL}/dashboard`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load dashboard');
    return res.json();
  },

  async getProfile() {
    const res = await fetch(`${this.BASE_URL}/profile`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load profile');
    return res.json();
  },

  async updateProfile(data) {
    const res = await fetch(`${this.BASE_URL}/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  // Products
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${this.BASE_URL}/products?${query}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load products');
    return res.json();
  },

  async createProduct(data) {
    const res = await fetch(`${this.BASE_URL}/products`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create product');
    return res.json();
  },

  async updateProduct(id, data) {
    const res = await fetch(`${this.BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },

  async deleteProduct(id) {
    const res = await fetch(`${this.BASE_URL}/products/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return res.json();
  },

  // Orders
  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${this.BASE_URL}/orders?${query}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load orders');
    return res.json();
  },

  async updateOrderStatus(orderId, status, notes = '') {
    const res = await fetch(`${this.BASE_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status, notes })
    });
    if (!res.ok) throw new Error('Failed to update order status');
    return res.json();
  },

  // Analytics
  async getAnalytics(period = '30d') {
    const res = await fetch(`${this.BASE_URL}/analytics?period=${period}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load analytics');
    return res.json();
  }
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
    const { data } = await SupplierAPI.getDashboard();
    if (!data) return;
    // Update DOM elements if they exist
    const updates = {
      'dashTotalOrders': data.total_orders,
      'dashPendingOrders': data.pending_orders,
      'dashRevenue': data.revenue ? `$${data.revenue.toLocaleString()}` : '$0',
      'dashRating': data.rating || '—',
      'dashTotalProducts': data.total_products,
      'dashResponseRate': data.response_rate ? `${data.response_rate}%` : '—'
    };
    Object.entries(updates).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.textContent = val;
    });
  } catch (e) {
    console.warn('Dashboard load error:', e);
  }
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
window.validateSupplierForm = validateSupplierForm;
