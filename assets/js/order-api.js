/**
 * Globex Sky — order-api.js
 * Wires up checkout, order history, order tracking, and order detail pages
 * to the real backend API via window.API.
 */

(function () {
  'use strict';

  /* ─── Utility Helpers ────────────────────────────────────────────────── */

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function formatPrice(amount, currency) {
    currency = currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    } catch (_) {
      return `${currency} ${Number(amount).toFixed(2)}`;
    }
  }

  function formatDate(isoString) {
    if (!isoString) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      }).format(new Date(isoString));
    } catch (_) {
      return isoString;
    }
  }

  function statusBadge(status) {
    const map = {
      pending: 'warning',
      processing: 'info',
      shipped: 'primary',
      delivered: 'success',
      cancelled: 'danger',
      refunded: 'secondary',
    };
    const variant = map[status] || 'secondary';
    return `<span class="badge badge--${variant}">${status}</span>`;
  }

  function showAlert(selector, message, type) {
    const el = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if (!el) return;
    el.className = `api-message api-message--${type}`;
    el.textContent = message;
    el.style.display = 'block';
  }

  /* ─── Checkout Page ──────────────────────────────────────────────────── */

  function initCheckoutPage() {
    const checkoutForm = document.getElementById('checkout-form') ||
      document.querySelector('.checkout-form');
    if (!checkoutForm) return;

    // Populate order summary from cart
    renderCheckoutSummary();

    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = checkoutForm.querySelector('[type="submit"]');
      const alertBox = document.getElementById('checkout-alert') ||
        checkoutForm.querySelector('.api-message');

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Placing order…'; }

      try {
        const cart = getCart();
        if (!cart.length) {
          showAlert(alertBox, 'Your cart is empty.', 'error');
          return;
        }

        const formData = new FormData(checkoutForm);
        const orderPayload = {
          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
          })),
          shipping_address: {
            full_name: formData.get('full_name') || '',
            address_line1: formData.get('address_line1') || '',
            address_line2: formData.get('address_line2') || '',
            city: formData.get('city') || '',
            state: formData.get('state') || '',
            postal_code: formData.get('postal_code') || '',
            country: formData.get('country') || '',
            phone: formData.get('phone') || '',
          },
          payment_method: formData.get('payment_method') || 'stripe',
          notes: formData.get('notes') || '',
        };

        if (!window.API) throw new Error('API client not loaded.');
        const res = await window.API.orders.create(orderPayload);
        const order = res.data || res;

        // Clear cart after successful order
        localStorage.removeItem('globexCart');
        document.querySelectorAll('.cart-badge, [data-cart-count]').forEach((el) => {
          el.textContent = '0';
          el.style.display = 'none';
        });

        // Redirect to confirmation page
        const orderId = order.id || order.order_id || '';
        window.location.href =
          `/pages/sourcing/order-confirmation.html?order_id=${orderId}`;
      } catch (err) {
        const msg = (err && err.message) || 'Failed to place order. Please try again.';
        showAlert(alertBox, msg, 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Place Order'; }
      }
    });
  }

  function renderCheckoutSummary() {
    const summaryEl = document.getElementById('checkout-summary') ||
      document.querySelector('.checkout-summary');
    if (!summaryEl) return;

    const cart = getCart();
    if (!cart.length) {
      summaryEl.innerHTML = '<p>Your cart is empty.</p>';
      return;
    }

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const itemsHtml = cart.map((item) =>
      `<div class="checkout-item">
        <img src="${item.image || '/assets/images/placeholder.jpg'}"
             alt="${item.name}" class="checkout-item__img" loading="lazy"/>
        <div class="checkout-item__info">
          <span class="checkout-item__name">${item.name}</span>
          <span class="checkout-item__qty">× ${item.quantity}</span>
        </div>
        <span class="checkout-item__price">${formatPrice(item.price * item.quantity)}</span>
      </div>`
    ).join('');

    summaryEl.innerHTML = `
      ${itemsHtml}
      <div class="checkout-totals">
        <div class="checkout-total-row">
          <span>Subtotal</span><span>${formatPrice(subtotal)}</span>
        </div>
        <div class="checkout-total-row checkout-total-row--grand">
          <strong>Grand Total</strong><strong>${formatPrice(subtotal)}</strong>
        </div>
      </div>`;
  }

  /* ─── Order Confirmation Page ────────────────────────────────────────── */

  async function initOrderConfirmationPage() {
    const confirmRoot = document.getElementById('order-confirmation') ||
      document.querySelector('.order-confirmation');
    if (!confirmRoot) return;

    const orderId = getParam('order_id') || getParam('session_id');
    if (!orderId) return;

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.orders.get(orderId);
      const order = res.data || res;

      document.querySelectorAll('[data-order-id]').forEach((el) => {
        el.textContent = order.id || orderId;
      });
      document.querySelectorAll('[data-order-total]').forEach((el) => {
        el.textContent = formatPrice(order.total_amount || order.grand_total || 0);
      });
      document.querySelectorAll('[data-order-date]').forEach((el) => {
        el.textContent = formatDate(order.created_at);
      });
      document.querySelectorAll('[data-order-status]').forEach((el) => {
        el.innerHTML = statusBadge(order.status || 'pending');
      });
    } catch (err) {
      console.error('[order-api] confirmation error:', err);
    }
  }

  /* ─── Order History Page ─────────────────────────────────────────────── */

  async function initOrderHistoryPage() {
    const tableBody = document.getElementById('orders-tbody') ||
      document.querySelector('.orders-table tbody, [data-orders-list]');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading orders…</td></tr>';

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.orders.list({ limit: 20 });
      const orders = res.data || res.orders || res || [];

      if (!orders.length) {
        tableBody.innerHTML = '<tr><td colspan="6" class="no-data">No orders yet.</td></tr>';
        return;
      }

      tableBody.innerHTML = orders.map((order) =>
        `<tr>
          <td><a href="/pages/sourcing/order-tracking.html?order_id=${order.id}">#${order.id}</a></td>
          <td>${formatDate(order.created_at)}</td>
          <td>${statusBadge(order.status)}</td>
          <td>${order.items_count || '—'}</td>
          <td>${formatPrice(order.total_amount || order.grand_total || 0)}</td>
          <td>
            <a href="/pages/sourcing/order-tracking.html?order_id=${order.id}"
               class="btn btn-sm btn-secondary">Track</a>
          </td>
        </tr>`
      ).join('');
    } catch (err) {
      tableBody.innerHTML = '<tr><td colspan="6" class="api-error">Failed to load orders.</td></tr>';
      console.error('[order-api] history error:', err);
    }
  }

  /* ─── Order Tracking Page ────────────────────────────────────────────── */

  async function initOrderTrackingPage() {
    const trackingRoot = document.getElementById('order-tracking') ||
      document.querySelector('.order-tracking, .tracking-timeline');
    if (!trackingRoot) return;

    // Support manual tracking number input
    const trackForm = document.getElementById('tracking-form') ||
      document.querySelector('form[data-track="order"]');
    if (trackForm) {
      trackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const orderId = trackForm.querySelector('[name="order_id"], [name="tracking_number"]')?.value.trim() || '';
        if (orderId) loadOrderTracking(orderId);
      });
    }

    // Auto-load from URL param
    const orderId = getParam('order_id') || getParam('id');
    if (orderId) loadOrderTracking(orderId);
  }

  async function loadOrderTracking(orderId) {
    const trackingRoot = document.getElementById('order-tracking') ||
      document.querySelector('.order-tracking, .tracking-timeline');

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.orders.track(orderId);
      const tracking = res.data || res;

      // Populate order info
      document.querySelectorAll('[data-order-id]').forEach((el) => {
        el.textContent = orderId;
      });
      document.querySelectorAll('[data-tracking-number]').forEach((el) => {
        el.textContent = tracking.tracking_number || orderId;
      });
      document.querySelectorAll('[data-tracking-carrier]').forEach((el) => {
        el.textContent = tracking.carrier || '—';
      });
      document.querySelectorAll('[data-tracking-status]').forEach((el) => {
        el.innerHTML = statusBadge(tracking.status || 'pending');
      });
      document.querySelectorAll('[data-tracking-eta]').forEach((el) => {
        el.textContent = formatDate(tracking.estimated_delivery);
      });

      // Render timeline events
      if (trackingRoot && tracking.events && tracking.events.length) {
        const eventsHtml = tracking.events.map((ev) =>
          `<div class="tracking-event">
            <div class="tracking-event__dot tracking-event__dot--${ev.status || 'default'}"></div>
            <div class="tracking-event__content">
              <strong>${ev.description || ev.status}</strong>
              <span>${ev.location || ''}</span>
              <time>${formatDate(ev.timestamp)}</time>
            </div>
          </div>`
        ).join('');
        const timelineEl = trackingRoot.querySelector('.timeline') || trackingRoot;
        timelineEl.innerHTML = eventsHtml;
      }
    } catch (err) {
      if (trackingRoot) {
        trackingRoot.innerHTML = `<p class="api-error">Tracking information not available for order #${orderId}.</p>`;
      }
      console.error('[order-api] tracking error:', err);
    }
  }

  /* ─── Cart Helpers (shared with product-api.js) ──────────────────────── */

  function getCart() {
    if (window.GlobexProducts && window.GlobexProducts.getCart) {
      return window.GlobexProducts.getCart();
    }
    try {
      return JSON.parse(localStorage.getItem('globexCart') || '[]');
    } catch (_) {
      return [];
    }
  }

  /* ─── Init ────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    initCheckoutPage();
    initOrderConfirmationPage();
    initOrderHistoryPage();
    initOrderTrackingPage();
  });

  /* ─── Exports ─────────────────────────────────────────────────────────── */
  window.GlobexOrders = { loadOrderTracking };
})();
