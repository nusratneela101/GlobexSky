/**
 * js/orders.js — Order module.
 *
 * Depends on: js/config.js (GlobexCfg), js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexOrders.createOrder(data)     → POST /api/v1/orders
 *   GlobexOrders.getMyOrders(params?)  → GET  /api/v1/orders
 *   GlobexOrders.getOrderById(id)      → GET  /api/v1/orders/:id
 *   GlobexOrders.cancelOrder(id)       → PUT  /api/v1/orders/:id/cancel
 *   GlobexOrders.getOrderTracking(id)  → GET  /api/v1/orders/:id/tracking
 */

(function (global) {
  'use strict';

  function _api(method, path, data) {
    if (global.GlobexUtils && global.GlobexUtils.apiCall) {
      return global.GlobexUtils.apiCall(method, path, data);
    }
    return Promise.reject(new Error('GlobexUtils not loaded'));
  }

  function _qs(obj) {
    if (!obj) return '';
    var parts = [];
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
      }
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  // ─── Create order ──────────────────────────────────────────────────────────

  /**
   * Create a new order.
   * @param {object} data  Order payload (items, shippingAddress, paymentMethod, etc.)
   * @returns {Promise<object>}  Created order
   */
  function createOrder(data) {
    return _api('POST', '/orders', data);
  }

  // ─── Get my orders ─────────────────────────────────────────────────────────

  /**
   * Get the current user's orders.
   * @param {object} [params]  { page, limit, status, sort }
   * @returns {Promise<{data: object[], total: number}>}
   */
  function getMyOrders(params) {
    return _api('GET', '/orders' + _qs(params));
  }

  // ─── Get order by ID ───────────────────────────────────────────────────────

  /**
   * Get a specific order by ID.
   * @param {string|number} id
   * @returns {Promise<object>}
   */
  function getOrderById(id) {
    return _api('GET', '/orders/' + id);
  }

  // ─── Cancel order ──────────────────────────────────────────────────────────

  /**
   * Request cancellation of an order.
   * @param {string|number} id
   * @param {string} [reason]
   * @returns {Promise<object>}
   */
  function cancelOrder(id, reason) {
    return _api('PUT', '/orders/' + id + '/cancel', { reason: reason || '' });
  }

  // ─── Order tracking ────────────────────────────────────────────────────────

  /**
   * Get shipping tracking info for an order.
   * @param {string|number} id
   * @returns {Promise<object>}
   */
  function getOrderTracking(id) {
    return _api('GET', '/orders/' + id + '/tracking');
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  var STATUS_COLORS = {
    pending:    { bg: '#fef9c3', text: '#854d0e' },
    confirmed:  { bg: '#dbeafe', text: '#1e40af' },
    processing: { bg: '#ede9fe', text: '#6d28d9' },
    shipped:    { bg: '#d1fae5', text: '#065f46' },
    delivered:  { bg: '#dcfce7', text: '#166534' },
    cancelled:  { bg: '#fee2e2', text: '#991b1b' },
    refunded:   { bg: '#f1f5f9', text: '#475569' },
  };

  /**
   * Render a status badge HTML string.
   * @param {string} status
   * @returns {string}
   */
  function renderStatusBadge(status) {
    var s = STATUS_COLORS[status] || { bg: '#f1f5f9', text: '#475569' };
    var label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
    return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:.78rem;font-weight:600;' +
      'background:' + s.bg + ';color:' + s.text + '">' + label + '</span>';
  }

  /**
   * Render an order row HTML string for use in order tables.
   * @param {object} order
   * @returns {string}
   */
  function renderOrderRow(order) {
    var fmt = global.GlobexUtils ? global.GlobexUtils.formatCurrency : function (n) { return '$' + n; };
    var date = global.GlobexUtils ? global.GlobexUtils.formatDate(order.created_at) : (order.created_at || '—');
    return '<tr>' +
      '<td><a href="/pages/account/order-detail.html?id=' + order.id + '">#' + (order.order_number || order.id) + '</a></td>' +
      '<td>' + date + '</td>' +
      '<td>' + (order.item_count || 1) + ' item(s)</td>' +
      '<td>' + fmt(order.total_amount || order.total || 0) + '</td>' +
      '<td>' + renderStatusBadge(order.status) + '</td>' +
      '<td><a href="/pages/account/order-detail.html?id=' + order.id + '" class="btn btn-sm btn-secondary">View</a></td>' +
    '</tr>';
  }

  /**
   * Load the user's recent orders and render them into a table body.
   * @param {HTMLElement|string} tbodyEl  Element or CSS selector
   * @param {number} [limit]
   * @returns {Promise<void>}
   */
  function loadOrdersTable(tbodyEl, limit) {
    if (typeof tbodyEl === 'string') tbodyEl = document.querySelector(tbodyEl);
    if (!tbodyEl) return Promise.resolve();

    tbodyEl.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">' +
      '<i class="fas fa-spinner fa-spin"></i></td></tr>';

    return getMyOrders({ limit: limit || 10, page: 1 })
      .then(function (res) {
        var orders = (res && (res.data || res.orders || res)) || [];
        if (!Array.isArray(orders)) orders = [];
        if (orders.length === 0) {
          tbodyEl.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">No orders yet.</td></tr>';
          return;
        }
        tbodyEl.innerHTML = orders.map(renderOrderRow).join('');
      })
      .catch(function (err) {
        console.warn('[GlobexOrders] Load failed:', err.message);
        tbodyEl.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:24px">Could not load orders.</td></tr>';
      });
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexOrders = {
    createOrder:       createOrder,
    getMyOrders:       getMyOrders,
    getOrderById:      getOrderById,
    cancelOrder:       cancelOrder,
    getOrderTracking:  getOrderTracking,
    renderStatusBadge: renderStatusBadge,
    renderOrderRow:    renderOrderRow,
    loadOrdersTable:   loadOrdersTable,
  };

}(typeof window !== 'undefined' ? window : this));
