/**
 * js/orders.js — Real Supabase orders module.
 *
 * Depends on:
 *   - Supabase CDN + js/supabase.js (window.supabaseClient)
 *   - js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexOrders.createOrder(cartItems, address)
 *   GlobexOrders.getMyOrders(params?)
 *   GlobexOrders.getOrderById(id)
 *   GlobexOrders.cancelOrder(id, reason?)
 *   GlobexOrders.renderStatusBadge(status)
 *   GlobexOrders.renderOrderRow(order)
 *   GlobexOrders.loadOrdersTable(tbodyEl, limit)
 */

(function (global) {
  'use strict';

  function _client() { return global.supabaseClient || null; }

  function _userId() {
    var user = global.GlobexUtils ? global.GlobexUtils.getUser() : null;
    return user ? user.id : null;
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Create order ──────────────────────────────────────────────────────────

  /**
   * Create a new order from cart items.
   * @param {object[]} cartItems
   * @param {object} address  Shipping address object
   * @returns {Promise<object>}
   */
  function createOrder(cartItems, address) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    var uid = _userId();
    if (!uid) return Promise.reject(new Error('User not authenticated'));

    var total = cartItems.reduce(function (acc, item) {
      return acc + (Number(item.price || 0) * (item.quantity || 1));
    }, 0);

    return sb.from('orders').insert({
      user_id: uid,
      items: JSON.parse(JSON.stringify(cartItems)),
      total_amount: total,
      status: 'pending',
      shipping_address: address || {},
      payment_status: 'unpaid',
    }).select().single()
      .then(function (result) {
        if (result.error) throw new Error(result.error.message);
        return result.data;
      });
  }

  // ─── Get orders ────────────────────────────────────────────────────────────

  /**
   * Get current user's orders.
   * @param {object} [params]  { limit, page, status }
   * @returns {Promise<object[]>}
   */
  function getMyOrders(params) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    var uid = _userId();
    if (!uid) return Promise.resolve([]);

    params = params || {};
    var limit = params.limit || 20;
    var page  = params.page  || 1;
    var from  = (page - 1) * limit;

    var query = sb.from('orders').select('*').eq('user_id', uid);
    if (params.status) query = query.eq('status', params.status);
    query = query.order('created_at', { ascending: false }).range(from, from + limit - 1);

    return query.then(function (result) {
      if (result.error) throw new Error(result.error.message);
      return result.data || [];
    });
  }

  /**
   * Get a single order by ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  function getOrderById(id) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    return sb.from('orders').select('*').eq('id', id).single()
      .then(function (result) {
        if (result.error) throw new Error(result.error.message);
        return result.data || null;
      });
  }

  /**
   * Cancel an order.
   * @param {string} id
   * @param {string} [reason]
   * @returns {Promise<object>}
   */
  function cancelOrder(id, reason) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    return sb.from('orders').update({ status: 'cancelled', cancel_reason: reason || '' }).eq('id', id).select().single()
      .then(function (result) {
        if (result.error) throw new Error(result.error.message);
        return result.data;
      });
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  var STATUS_COLORS = {
    pending:    { bg: '#fef9c3', text: '#854d0e' },
    confirmed:  { bg: '#dbeafe', text: '#1e40af' },
    processing: { bg: '#ede9fe', text: '#6d28d9' },
    shipped:    { bg: '#d1fae5', text: '#065f46' },
    delivered:  { bg: '#dcfce7', text: '#166534' },
    cancelled:  { bg: '#fee2e2', text: '#991b1b' },
  };

  function renderStatusBadge(status) {
    var s = STATUS_COLORS[status] || { bg: '#f1f5f9', text: '#475569' };
    var label = status ? _esc(status.charAt(0).toUpperCase() + status.slice(1)) : '—';
    return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:.78rem;font-weight:600;' +
      'background:' + s.bg + ';color:' + s.text + '">' + label + '</span>';
  }

  function renderOrderRow(order) {
    var fmt  = global.GlobexUtils ? global.GlobexUtils.formatCurrency : function (n) { return '$' + n; };
    var date = global.GlobexUtils ? global.GlobexUtils.formatDate(order.created_at) : (order.created_at || '—');
    var id   = _esc(String(order.id || ''));
    var shortId = id.substring(0, 8);
    var items = Array.isArray(order.items) ? order.items.length : '?';
    return '<tr>' +
      '<td><a href="/pages/order/details.html?id=' + id + '">#' + shortId + '…</a></td>' +
      '<td>' + date + '</td>' +
      '<td>' + items + ' item(s)</td>' +
      '<td>' + fmt(order.total_amount || 0) + '</td>' +
      '<td>' + renderStatusBadge(order.status) + '</td>' +
      '<td><a href="/pages/order/details.html?id=' + id + '" class="btn btn-sm btn-secondary" ' +
        'style="padding:4px 12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-size:.8rem;text-decoration:none;color:#374151">View</a></td>' +
    '</tr>';
  }

  function loadOrdersTable(tbodyEl, limit) {
    if (typeof tbodyEl === 'string') tbodyEl = document.querySelector(tbodyEl);
    if (!tbodyEl) return Promise.resolve();

    tbodyEl.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">' +
      '<i class="fas fa-spinner fa-spin"></i></td></tr>';

    return getMyOrders({ limit: limit || 10 })
      .then(function (orders) {
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
    renderStatusBadge: renderStatusBadge,
    renderOrderRow:    renderOrderRow,
    loadOrdersTable:   loadOrdersTable,
  };

}(typeof window !== 'undefined' ? window : this));
