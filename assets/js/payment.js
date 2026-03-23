/**
 * Globex Sky — payment.js
 * Frontend payment page logic: Stripe Elements, PayPal, bKash, Nagad,
 * Bank Transfer, Escrow, payment history, and result pages.
 *
 * GLOBEX_CONFIG must be defined before this module is loaded, e.g.:
 *   <script>
 *     window.GLOBEX_CONFIG = {
 *       stripe_publishable_key: 'pk_live_...',
 *       paypal_client_id: 'AaBbCc...'
 *     };
 *   </script>
 * See assets/js/config.js for the default configuration object.
 */

import { API_BASE } from './config.js';
import { initGateways, selectMethod, showSpinner, setPayBtnDisabled, showError } from './payment-gateways.js';

/* ─── Constants ───────────────────────────────────────────────────────── */
const STRIPE_PUBLISHABLE_KEY = window.GLOBEX_CONFIG?.stripe_publishable_key || '';
const PAYPAL_CLIENT_ID       = window.GLOBEX_CONFIG?.paypal_client_id       || '';

/* ─── DOM Helpers ─────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ─── Auth token ──────────────────────────────────────────────────────── */
function getAuthToken() {
  return localStorage.getItem('globex_token') || sessionStorage.getItem('globex_token') || '';
}

/* ─── Payment Page ────────────────────────────────────────────────────── */
export function initPaymentPage() {
  const orderId  = new URLSearchParams(window.location.search).get('order_id');
  const amountEl = $('payment-amount');
  const form     = $('payment-form');
  if (!form) return;

  const amount   = parseFloat(amountEl?.dataset.amount || amountEl?.textContent?.replace(/[^0-9.]/g, '') || '0');
  const currency = amountEl?.dataset.currency || 'USD';

  // Init unified gateway module
  initGateways({
    orderId,
    amount,
    currency,
    onSuccess: ({ orderId: oid, ref, gateway }) => redirectToSuccess(oid, ref, gateway),
    onError:   (msg) => { showError(msg); setPayBtnDisabled(false); showSpinner(false); },
  });

  // Method selection (delegate to gateway module)
  document.querySelectorAll('.method-card').forEach(card => {
    card.addEventListener('click', () => {
      selectMethod(card.dataset.method);
    });
  });

  // Bank transfer form submit
  const bankForm = $('bank-transfer-form');
  if (bankForm) {
    bankForm.addEventListener('submit', async e => {
      e.preventDefault();
      await submitBankTransfer(orderId, bankForm);
    });
  }

  // Escrow form submit
  const escrowForm = $('escrow-form');
  if (escrowForm) {
    escrowForm.addEventListener('submit', async e => {
      e.preventDefault();
      await submitEscrow(orderId, escrowForm);
    });
  }

  // Copy bank details
  document.querySelectorAll('.bank-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.copy;
      if (target) {
        navigator.clipboard.writeText(target).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      }
    });
  });
}

/* ─── Stripe Integration ──────────────────────────────────────────────── */
// Stripe is now handled by payment-gateways.js (initGateways)
// This section kept for backwards-compatibility with any existing inline scripts.

/* ─── Bank Transfer ───────────────────────────────────────────────────── */
async function submitBankTransfer(orderId, form) {
  showSpinner(true);
  const bankRef = form.querySelector('#bank-reference')?.value;

  try {
    const res = await fetch(`${API_BASE}/payments/bank-transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ order_id: orderId, bank_reference: bankRef }),
    });
    const { success, error } = await res.json();
    if (!success) throw new Error(error);
    redirectToSuccess(orderId, bankRef || 'bank_transfer');
  } catch (err) {
    showError(err.message);
    showSpinner(false);
  }
}

/* ─── Escrow ──────────────────────────────────────────────────────────── */
async function submitEscrow(orderId, form) {
  showSpinner(true);
  const sellerId   = form.querySelector('#seller-id')?.value;
  const conditions = form.querySelector('#release-conditions')?.value;

  try {
    const res = await fetch(`${API_BASE}/payments/escrow/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ order_id: orderId, seller_id: sellerId, release_conditions: conditions }),
    });
    const { success, error } = await res.json();
    if (!success) throw new Error(error);
    redirectToSuccess(orderId, 'escrow');
  } catch (err) {
    showError(err.message);
    showSpinner(false);
  }
}

/* ─── Payment History ─────────────────────────────────────────────────── */
export async function loadPaymentHistory() {
  const tbody = $('history-tbody');
  if (!tbody) return;

  try {
    const params = new URLSearchParams();
    const statusFilter = $('filter-status')?.value;
    const methodFilter = $('filter-method')?.value;
    if (statusFilter) params.set('status', statusFilter);
    if (methodFilter) params.set('method', methodFilter);

    const res = await fetch(`${API_BASE}/payments/history?${params}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    const { data, success } = await res.json();
    if (!success || !data?.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#64748b">No payment records found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(p => `
      <tr>
        <td style="font-family:monospace;font-size:.82rem">${p.id.slice(0, 8)}...</td>
        <td>${p.orders?.order_number || p.order_id?.slice(0, 8) + '...' || '-'}</td>
        <td><strong>$${parseFloat(p.amount).toFixed(2)}</strong> ${p.currency}</td>
        <td>${formatMethod(p.method)}</td>
        <td>${formatStatus(p.status)}</td>
        <td>${new Date(p.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#ef4444">${err.message}</td></tr>`;
  }
}

/* ─── UI Helpers ──────────────────────────────────────────────────────── */
// showSpinner, setPayBtnDisabled, showError are imported from payment-gateways.js

function redirectToSuccess(orderId, ref, gateway) {
  const params = new URLSearchParams({ order_id: orderId, ref });
  if (gateway) params.set('gateway', gateway);
  window.location.href = `payment-success.html?${params}`;
}

function redirectToFailed(orderId, ref) {
  const params = new URLSearchParams({ order_id: orderId, ref });
  window.location.href = `payment-failed.html?${params}`;
}

function formatMethod(method) {
  const map = {
    card:           '<i class="fas fa-credit-card" style="color:#0052CC"></i> Card',
    paypal:         '<i class="fab fa-paypal" style="color:#0369a1"></i> PayPal',
    bkash:          '<i class="fas fa-mobile-alt" style="color:#e2136e"></i> bKash',
    mobile_banking: '<i class="fas fa-mobile-alt" style="color:#e2136e"></i> Mobile Banking',
    nagad:          '<i class="fas fa-mobile-screen" style="color:#f05829"></i> Nagad',
    bank_transfer:  '<i class="fas fa-university" style="color:#059669"></i> Bank Transfer',
    escrow:         '<i class="fas fa-shield-alt" style="color:#7c3aed"></i> Escrow',
    cod:            '<i class="fas fa-money-bill" style="color:#d97706"></i> COD',
  };
  return map[method] || method;
}

function formatStatus(status) {
  const map = {
    completed: '<span class="badge badge-success">Completed</span>',
    pending:   '<span class="badge badge-pending">Pending</span>',
    failed:    '<span class="badge badge-failed">Failed</span>',
    refunded:  '<span class="badge badge-refunded">Refunded</span>',
    held:      '<span class="badge badge-held">In Escrow</span>',
    cancelled: '<span class="badge" style="background:#f1f5f9;color:#64748b">Cancelled</span>',
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

/* ─── Result Pages ────────────────────────────────────────────────────── */
export function initSuccessPage() {
  const params  = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');
  const ref     = params.get('ref');

  const refEl    = $('payment-ref');
  const orderEl  = $('payment-order-id');
  const dateEl   = $('payment-date');

  if (refEl)   refEl.textContent   = ref   || '—';
  if (orderEl) orderEl.textContent = orderId ? orderId.slice(0, 8).toUpperCase() + '...' : '—';
  if (dateEl)  dateEl.textContent  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Update order links
  document.querySelectorAll('[data-order-link]').forEach(el => {
    if (orderId) el.href = `../account/orders.html?order_id=${orderId}`;
  });
}

export function initFailedPage() {
  const params  = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');

  document.querySelectorAll('[data-retry-link]').forEach(el => {
    if (orderId) el.href = `payment.html?order_id=${orderId}`;
  });

  document.querySelectorAll('[data-order-link]').forEach(el => {
    if (orderId) el.href = `../account/orders.html?order_id=${orderId}`;
  });
}

/* ─── Auto-init ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;

  if (path.includes('payment.html') && !path.includes('payment-success') && !path.includes('payment-failed')) {
    initPaymentPage();
  } else if (path.includes('payment-success')) {
    initSuccessPage();
  } else if (path.includes('payment-failed')) {
    initFailedPage();
  } else if (path.includes('/payment/history')) {
    loadPaymentHistory();
    document.querySelectorAll('.filter-select').forEach(sel => {
      sel.addEventListener('change', loadPaymentHistory);
    });
  }
});
