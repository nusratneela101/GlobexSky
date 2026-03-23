/**
 * Globex Sky — payment-gateways.js
 * Unified frontend payment gateway module.
 *
 * Provides:
 *  - Stripe Elements with 3D Secure
 *  - PayPal Smart Buttons
 *  - bKash mobile payment (Bangladesh)
 *  - Nagad mobile payment (Bangladesh)
 *  - COD (Cash on Delivery) verification
 *  - Payment method selection UI
 *  - Payment retry logic
 *  - Multi-currency display helper
 *
 * Usage:
 *   import { initGateways, selectMethod } from './payment-gateways.js';
 *   initGateways({ orderId, amount, currency, containerId });
 */

import { API_BASE } from './config.js';

/* ─── Constants ───────────────────────────────────────────────────────── */
const STRIPE_PUBLISHABLE_KEY = window.GLOBEX_CONFIG?.stripe_publishable_key || '';
const PAYPAL_CLIENT_ID       = window.GLOBEX_CONFIG?.paypal_client_id       || '';
const MAX_RETRY_ATTEMPTS     = 3;

/* ─── State ───────────────────────────────────────────────────────────── */
let _state = {
  orderId:   null,
  amount:    0,
  currency:  'USD',
  method:    null,
  retryCount: 0,
};

/* ─── Auth ────────────────────────────────────────────────────────────── */
function getAuthToken() {
  return localStorage.getItem('globex_token') || sessionStorage.getItem('globex_token') || '';
}

/* ─── API Helper ──────────────────────────────────────────────────────── */
async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

/* ─── Init ────────────────────────────────────────────────────────────── */

/**
 * Initialize all payment gateways for the given order.
 * @param {object} opts
 * @param {string}   opts.orderId
 * @param {number}   opts.amount
 * @param {string}   [opts.currency]  - ISO currency, default 'USD'
 * @param {Function} [opts.onSuccess] - Called with { orderId, ref, gateway }
 * @param {Function} [opts.onError]   - Called with error message
 */
export function initGateways({ orderId, amount, currency = 'USD', onSuccess, onError }) {
  _state.orderId  = orderId;
  _state.amount   = amount;
  _state.currency = currency;
  _state.onSuccess = onSuccess || defaultSuccess;
  _state.onError   = onError   || defaultError;

  if (STRIPE_PUBLISHABLE_KEY) initStripe();
  if (PAYPAL_CLIENT_ID)       initPayPal();
  initBkash();
  initNagad();
  initCod();
}

/* ─── Stripe ──────────────────────────────────────────────────────────── */
let _stripe, _cardElement;

function initStripe() {
  if (!window.Stripe || !STRIPE_PUBLISHABLE_KEY) return;
  _stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);

  const elements = _stripe.elements();
  _cardElement = elements.create('card', {
    style: {
      base: {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: '#1a1a2e',
        '::placeholder': { color: '#94a3b8' },
      },
      invalid: { color: '#ef4444' },
    },
  });

  const mountEl = document.getElementById('stripe-card-element');
  if (mountEl) _cardElement.mount('#stripe-card-element');

  _cardElement.addEventListener('change', e => {
    const errEl = document.getElementById('stripe-errors');
    if (errEl) errEl.textContent = e.error ? e.error.message : '';
  });

  const stripeForm = document.getElementById('stripe-form');
  if (stripeForm) {
    stripeForm.addEventListener('submit', async e => {
      e.preventDefault();
      await submitStripePayment();
    });
  }
}

export async function submitStripePayment() {
  if (!_stripe || !_cardElement) return;
  showSpinner(true);
  setPayBtnDisabled(true);

  try {
    const { data, success, error } = await apiPost('/payments/stripe/create-intent', {
      order_id: _state.orderId,
      currency: _state.currency.toLowerCase(),
    });
    if (!success) throw new Error(error || 'Failed to create payment intent.');

    const { error: stripeErr, paymentIntent } = await _stripe.confirmCardPayment(data.client_secret, {
      payment_method: {
        card: _cardElement,
        billing_details: {
          name: document.getElementById('card-holder-name')?.value || '',
        },
      },
    });

    if (stripeErr) throw new Error(stripeErr.message);

    if (paymentIntent.status === 'succeeded') {
      _state.onSuccess({ orderId: _state.orderId, ref: paymentIntent.id, gateway: 'stripe' });
    } else {
      _state.onError('Payment requires additional verification.');
    }
  } catch (err) {
    _state.retryCount++;
    setPayBtnDisabled(false);
    showSpinner(false);
    if (_state.retryCount < MAX_RETRY_ATTEMPTS) {
      showError(`${err.message} (Attempt ${_state.retryCount}/${MAX_RETRY_ATTEMPTS})`);
    } else {
      showError(`Payment failed after ${MAX_RETRY_ATTEMPTS} attempts. Please try a different method.`);
    }
  }
}

/* ─── PayPal ──────────────────────────────────────────────────────────── */

function initPayPal() {
  if (!window.paypal) return;

  const container = document.getElementById('paypal-button-container');
  if (!container) return;

  window.paypal.Buttons({
    style: {
      layout: 'vertical',
      color:  'blue',
      shape:  'rect',
      label:  'paypal',
    },
    createOrder: async () => {
      const { data, success, error } = await apiPost('/payments/paypal/create', {
        order_id: _state.orderId,
        currency: _state.currency,
      });
      if (!success) throw new Error(error);
      return data.paypal_order_id;
    },
    onApprove: async data => {
      showSpinner(true);
      const { success, error } = await apiPost('/payments/paypal/capture', {
        paypal_order_id: data.orderID,
      });
      if (success) {
        _state.onSuccess({ orderId: _state.orderId, ref: data.orderID, gateway: 'paypal' });
      } else {
        showError(error || 'PayPal capture failed.');
        showSpinner(false);
      }
    },
    onError: err => {
      showError('PayPal error: ' + (err.message || String(err)));
    },
    onCancel: () => {
      showError('PayPal payment was cancelled.');
    },
  }).render('#paypal-button-container');
}

/* ─── bKash ───────────────────────────────────────────────────────────── */

function initBkash() {
  const form = document.getElementById('bkash-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    await submitBkashPayment();
  });
}

export async function submitBkashPayment() {
  showSpinner(true);
  setPayBtnDisabled(true);

  try {
    const callbackURL = `${window.location.origin}/api/v1/payments/bkash/callback?order_id=${_state.orderId}`;

    const { data, success, error } = await apiPost('/payments/bkash/create', {
      order_id: _state.orderId,
      amount: _state.amount,
      callback_url: callbackURL,
    });

    if (!success) throw new Error(error || 'Failed to initiate bKash payment.');

    // Redirect to bKash URL (bKash handles the mobile UI)
    if (data.bkash_url) {
      window.location.href = data.bkash_url;
    } else {
      throw new Error('bKash checkout URL not received.');
    }
  } catch (err) {
    showError(err.message);
    setPayBtnDisabled(false);
    showSpinner(false);
  }
}

/* ─── Nagad ───────────────────────────────────────────────────────────── */

function initNagad() {
  const form = document.getElementById('nagad-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    await submitNagadPayment();
  });
}

export async function submitNagadPayment() {
  showSpinner(true);
  setPayBtnDisabled(true);

  try {
    const callbackURL = `${window.location.origin}/api/v1/payments/nagad/callback?order_id=${_state.orderId}`;

    const { data, success, error } = await apiPost('/payments/nagad/initialize', {
      order_id: _state.orderId,
      amount: _state.amount,
      callback_url: callbackURL,
    });

    if (!success) throw new Error(error || 'Failed to initiate Nagad payment.');

    if (data.nagad_url) {
      window.location.href = data.nagad_url;
    } else {
      throw new Error('Nagad checkout URL not received.');
    }
  } catch (err) {
    showError(err.message);
    setPayBtnDisabled(false);
    showSpinner(false);
  }
}

/* ─── COD (Cash on Delivery) ─────────────────────────────────────────── */

function initCod() {
  const form = document.getElementById('cod-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    await submitCodPayment();
  });
}

export async function submitCodPayment() {
  showSpinner(true);
  setPayBtnDisabled(true);

  try {
    const { success, error } = await apiPost('/cod/place', {
      order_id: _state.orderId,
    });
    if (!success) throw new Error(error || 'Failed to confirm COD order.');
    _state.onSuccess({ orderId: _state.orderId, ref: 'cod', gateway: 'cod' });
  } catch (err) {
    showError(err.message);
    setPayBtnDisabled(false);
    showSpinner(false);
  }
}

/* ─── Payment Method Selection ────────────────────────────────────────── */

/**
 * Programmatically select a payment method and show its section.
 * @param {string} method - 'card' | 'paypal' | 'bkash' | 'nagad' | 'bank' | 'escrow' | 'cod'
 */
export function selectMethod(method) {
  _state.method = method;

  document.querySelectorAll('.method-card').forEach(card => {
    const active = card.dataset.method === method;
    card.classList.toggle('active', active);
    card.setAttribute('aria-pressed', String(active));
  });

  document.querySelectorAll('.payment-section').forEach(section => {
    section.classList.remove('active');
  });

  const activeSection = document.getElementById(`section-${method}`);
  if (activeSection) activeSection.classList.add('active');
}

/* ─── Currency Display ────────────────────────────────────────────────── */

/**
 * Format an amount with the specified currency for display.
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() })
    .format(amount);
}

/* ─── UI Helpers ──────────────────────────────────────────────────────── */

export function showSpinner(show) {
  const spinner = document.getElementById('payment-spinner');
  const form    = document.getElementById('payment-form');
  if (spinner) spinner.classList.toggle('visible', show);
  if (form && show) form.style.opacity = '0.5';
  else if (form)    form.style.opacity = '';
}

export function setPayBtnDisabled(disabled) {
  document.querySelectorAll('.btn-pay').forEach(btn => {
    btn.disabled = disabled;
    btn.classList.toggle('disabled', disabled);
  });
}

export function showError(message) {
  const errEl = document.getElementById('payment-error') || document.getElementById('stripe-errors');
  if (errEl) {
    errEl.textContent = message;
    errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    alert(message);
  }
}

function defaultSuccess({ orderId, ref }) {
  const params = new URLSearchParams({ order_id: orderId, ref });
  window.location.href = `payment-success.html?${params}`;
}

function defaultError(message) {
  showError(message);
  setPayBtnDisabled(false);
  showSpinner(false);
}
