/**
 * Globex Sky - orders.js
 * Buyer order management: list, filter, and view orders.
 */

const API_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';

/** Get the auth token from the session store used by ApiClient. */
function _getAuthToken() {
  try {
    const session = JSON.parse(localStorage.getItem('globexSession') || 'null');
    return (session && session.token) || null;
  } catch (_) {
    return null;
  }
}

let ordersState = {
  orders: [],
  currentFilter: 'all',
  currentPage: 1,
  totalPages: 1,
  searchQuery: '',
};

/* ──────────────────────────────────────────────
   INIT
────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadOrders();
  initOrderEvents();
});

/* ──────────────────────────────────────────────
   DATA LOADING
────────────────────────────────────────────── */
async function loadOrders(page = 1) {
  const token = _getAuthToken();
  if (!token) {
    window.location.href = '/pages/auth/login.html?redirect=/pages/account/orders.html';
    return;
  }

  showOrdersLoading(true);

  try {
    const params = new URLSearchParams({ page, limit: 20 });
    if (ordersState.currentFilter !== 'all') params.set('status', ordersState.currentFilter);
    if (ordersState.searchQuery) params.set('search', ordersState.searchQuery);

    const res = await fetch(`${API_BASE}/orders?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();

    if (json.success) {
      ordersState.orders = json.data || [];
      ordersState.currentPage = json.meta?.page || 1;
      ordersState.totalPages = json.meta?.total_pages || 1;
      renderOrders();
      renderPagination();
    } else {
      showOrdersError(json.error || 'Failed to load orders.');
    }
  } catch (err) {
    console.error(err);
    showOrdersError('Network error. Please refresh.');
  } finally {
    showOrdersLoading(false);
  }
}

async function loadOrderDetail(orderId) {
  const token = _getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) renderOrderDetail(json.data);
    else showOrdersError(json.error || 'Order not found.');
  } catch (err) {
    showOrdersError('Failed to load order details.');
  }
}

/* ──────────────────────────────────────────────
   RENDER: ORDER LIST
────────────────────────────────────────────── */
function renderOrders() {
  const container = document.getElementById('orders-list');
  if (!container) return;

  if (!ordersState.orders.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-shopping-bag"></i></div>
        <h3>No orders found</h3>
        <p>You haven't placed any orders yet.</p>
        <a href="/pages/sourcing/products.html" class="btn btn-primary">Browse Products</a>
      </div>`;
    return;
  }

  container.innerHTML = ordersState.orders.map((order) => `
    <div class="order-card" data-order-id="${order.id}">
      <div class="order-card-header">
        <div>
          <div class="order-number">#${escapeHtml(order.order_number || order.id.slice(0, 8).toUpperCase())}</div>
          <div class="order-date">${formatDate(order.created_at)}</div>
        </div>
        <span class="status-badge status-${order.status}">${formatStatus(order.status)}</span>
      </div>
      <div class="order-items-preview">
        ${(order.items || []).slice(0, 3).map((item) => `
          <div class="order-item-preview">
            <img src="${item.product?.images?.[0] || '/assets/images/placeholder.png'}"
                 alt="${escapeHtml(item.product?.title || 'Product')}"
                 onerror="this.src='/assets/images/placeholder.png'" loading="lazy">
          </div>
        `).join('')}
        ${order.items?.length > 3 ? `<div class="more-items">+${order.items.length - 3}</div>` : ''}
      </div>
      <div class="order-card-footer">
        <div class="order-total"><strong>$${Number(order.total || 0).toFixed(2)}</strong></div>
        <a href="/pages/account/order-detail.html?id=${order.id}" class="btn btn-outline btn-sm">
          View Details
        </a>
      </div>
    </div>
  `).join('');
}

/* ──────────────────────────────────────────────
   RENDER: ORDER DETAIL
────────────────────────────────────────────── */
function renderOrderDetail(order) {
  // Order number & status
  setElText('#detail-order-number', '#' + (order.order_number || order.id.slice(0, 8).toUpperCase()));
  setElText('#detail-order-date', formatDate(order.created_at));

  const statusBadge = document.querySelector('#detail-status-badge');
  if (statusBadge) {
    statusBadge.textContent = formatStatus(order.status);
    statusBadge.className = `status-badge status-${order.status}`;
  }

  // Items
  const itemsEl = document.getElementById('detail-items');
  if (itemsEl) {
    itemsEl.innerHTML = (order.items || []).map((item) => `
      <div class="detail-item">
        <img src="${item.product?.images?.[0] || '/assets/images/placeholder.png'}"
             alt="${escapeHtml(item.product?.title || 'Product')}"
             onerror="this.src='/assets/images/placeholder.png'" loading="lazy">
        <div class="detail-item-info">
          <div class="detail-item-name">${escapeHtml(item.product?.title || 'Product')}</div>
          <div class="detail-item-meta">Qty: ${item.quantity} × $${Number(item.unit_price).toFixed(2)}</div>
        </div>
        <div class="detail-item-total">$${Number(item.total_price || item.unit_price * item.quantity).toFixed(2)}</div>
      </div>
    `).join('');
  }

  // Totals
  setElText('#detail-subtotal', `$${Number(order.subtotal || 0).toFixed(2)}`);
  setElText('#detail-shipping', order.shipping_fee > 0 ? `$${Number(order.shipping_fee).toFixed(2)}` : 'FREE');
  setElText('#detail-tax', `$${Number(order.tax || 0).toFixed(2)}`);
  setElText('#detail-discount', order.discount > 0 ? `-$${Number(order.discount).toFixed(2)}` : '-');
  setElText('#detail-total', `$${Number(order.total || 0).toFixed(2)}`);

  // Address
  const addrEl = document.getElementById('detail-shipping-address');
  if (addrEl && order.shipping_address) {
    const a = order.shipping_address;
    addrEl.innerHTML = `
      <strong>${escapeHtml(a.full_name)}</strong><br>
      ${escapeHtml(a.address_line1)}${a.address_line2 ? '<br>' + escapeHtml(a.address_line2) : ''}<br>
      ${escapeHtml(a.city)}, ${a.state ? escapeHtml(a.state) + ', ' : ''}${escapeHtml(a.postal_code)}<br>
      ${escapeHtml(a.country)}
    `;
  }

  // Tracking
  setElText('#detail-tracking-number', order.tracking_number || 'Not available');
  setElText('#detail-carrier', order.carrier || 'N/A');
  setElText('#detail-payment-method', formatPaymentMethod(order.payment_method));

  // Timeline
  renderOrderTimeline(order.timeline || []);
}

function renderOrderTimeline(timeline) {
  const el = document.getElementById('order-timeline');
  if (!el) return;

  if (!timeline.length) {
    el.innerHTML = '<p class="text-muted">No timeline available.</p>';
    return;
  }

  el.innerHTML = timeline.map((entry) => `
    <div class="timeline-entry">
      <div class="timeline-dot status-${entry.status}"></div>
      <div class="timeline-content">
        <div class="timeline-status">${formatStatus(entry.status)}</div>
        ${entry.description ? `<div class="timeline-description">${escapeHtml(entry.description)}</div>` : ''}
        <div class="timeline-date">${formatDate(entry.created_at)}</div>
      </div>
    </div>
  `).join('');
}

function renderPagination() {
  const el = document.getElementById('orders-pagination');
  if (!el) return;

  const { currentPage, totalPages } = ordersState;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = '';
  if (currentPage > 1) {
    html += `<button class="pagination-btn" data-page="${currentPage - 1}">‹ Prev</button>`;
  }
  for (let p = Math.max(1, currentPage - 2); p <= Math.min(totalPages, currentPage + 2); p++) {
    html += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }
  if (currentPage < totalPages) {
    html += `<button class="pagination-btn" data-page="${currentPage + 1}">Next ›</button>`;
  }
  el.innerHTML = html;
}

/* ──────────────────────────────────────────────
   ACTIONS
────────────────────────────────────────────── */
async function cancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order?')) return;
  const token = _getAuthToken();
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) {
      showSuccess('Order cancelled successfully.');
      loadOrderDetail(orderId);
    } else {
      showOrdersError(json.error || 'Failed to cancel order.');
    }
  } catch (err) {
    showOrdersError('Network error.');
  }
}

async function requestRefund(orderId) {
  const reason = prompt('Please provide a reason for your refund request:');
  if (!reason) return;
  const token = _getAuthToken();
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (json.success) showSuccess('Refund request submitted.');
    else showOrdersError(json.error || 'Failed to submit refund request.');
  } catch (err) {
    showOrdersError('Network error.');
  }
}

/* ──────────────────────────────────────────────
   EVENTS
────────────────────────────────────────────── */
function initOrderEvents() {
  // Filter tabs
  document.addEventListener('click', (e) => {
    const filterTab = e.target.closest('[data-filter]');
    if (filterTab) {
      document.querySelectorAll('[data-filter]').forEach((el) => el.classList.remove('active'));
      filterTab.classList.add('active');
      ordersState.currentFilter = filterTab.dataset.filter;
      loadOrders(1);
    }

    const pageBtn = e.target.closest('.pagination-btn');
    if (pageBtn) loadOrders(parseInt(pageBtn.dataset.page, 10));

    const cancelBtn = e.target.closest('[data-action="cancel-order"]');
    if (cancelBtn) cancelOrder(cancelBtn.dataset.orderId);

    const refundBtn = e.target.closest('[data-action="request-refund"]');
    if (refundBtn) requestRefund(refundBtn.dataset.orderId);
  });

  // Search
  const searchInput = document.getElementById('orders-search');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        ordersState.searchQuery = searchInput.value.trim();
        loadOrders(1);
      }, 400);
    });
  }

  // Load detail page
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');
  if (orderId) loadOrderDetail(orderId);
}

/* ──────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────── */
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatStatus(status) {
  const map = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };
  return map[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');
}

function formatPaymentMethod(method) {
  const map = {
    credit_card: 'Credit / Debit Card',
    paypal: 'PayPal',
    bank_transfer: 'Bank Transfer',
    escrow: 'Escrow / Trade Assurance',
  };
  return map[method] || method || 'N/A';
}

function setElText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showOrdersLoading(show) {
  const el = document.getElementById('orders-loading');
  if (el) el.style.display = show ? 'block' : 'none';
}

function showOrdersError(msg) {
  const el = document.getElementById('orders-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showSuccess(msg) {
  const el = document.getElementById('orders-success');
  if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 3000); }
}

/* ──────────────────────────────────────────────
   EXPORTS
────────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};
Object.assign(window.GlobexSky, { loadOrders, cancelOrder, requestRefund });
