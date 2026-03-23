/**
 * Globex Sky — bkash.service.js  (payment layer)
 * bKash Tokenized Checkout API integration (Bangladesh).
 *
 * Supports:
 *  - Token grant / refresh
 *  - Create payment
 *  - Execute payment
 *  - Query payment status
 *  - Refund / void
 *  - Agreement-based recurring payments (tokenized)
 *
 * Required env vars:
 *   BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD
 *   BKASH_MODE — 'sandbox' (default) or 'live'
 */

import supabase from '../../config/supabase.js';
import { bkashConfig } from '../../config/integrations.js';

// ─── Token Cache ──────────────────────────────────────────────────────────────

let _idToken     = null;
let _refreshToken = null;
let _tokenExpiry  = 0;

async function grantToken() {
  const { baseUrl, appKey, appSecret, username, password } = bkashConfig;
  if (!appKey || !appSecret || !username || !password) {
    throw new Error('bKash credentials (BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD) are not set.');
  }

  const res = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username,
      password,
    },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`bKash token grant failed: ${text}`);
  }

  const data = await res.json();
  if (data.statusCode !== '0000') {
    throw new Error(`bKash token grant error: ${data.statusMessage || JSON.stringify(data)}`);
  }

  _idToken      = data.id_token;
  _refreshToken = data.refresh_token;
  // id_token is valid for 1 hour; expire 60s early
  _tokenExpiry  = Date.now() + (3600 - 60) * 1000;
  return _idToken;
}

async function refreshToken() {
  const { baseUrl, appKey, appSecret, username, password } = bkashConfig;

  const res = await fetch(`${baseUrl}/tokenized/checkout/token/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username,
      password,
    },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret, refresh_token: _refreshToken }),
  });

  if (!res.ok) {
    // Fall back to full grant on refresh failure
    return grantToken();
  }

  const data = await res.json();
  if (data.statusCode !== '0000') {
    return grantToken();
  }

  _idToken     = data.id_token;
  _refreshToken = data.refresh_token;
  _tokenExpiry  = Date.now() + (3600 - 60) * 1000;
  return _idToken;
}

async function getToken() {
  if (_idToken && Date.now() < _tokenExpiry) return _idToken;
  if (_refreshToken) return refreshToken();
  return grantToken();
}

// ─── Internal Request Helper ─────────────────────────────────────────────────

async function _request(path, body) {
  const token = await getToken();
  const { baseUrl, appKey } = bkashConfig;

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: token,
      'X-APP-Key': appKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`bKash API ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── Create Payment ───────────────────────────────────────────────────────────

/**
 * Initiate a bKash payment.
 * @param {object} opts
 * @param {string}  opts.orderId       - Your internal order ID
 * @param {number}  opts.amount        - Amount in BDT (e.g. 500.00)
 * @param {string}  opts.currency      - Currency code, default 'BDT'
 * @param {string}  opts.intent        - 'sale' (default) or 'authorization'
 * @param {string}  opts.callbackURL   - Merchant callback URL after user authentication
 * @param {string}  [opts.merchantInvoice] - Merchant invoice number
 * @returns {object} bKash create payment response (contains bkashURL for redirect)
 */
export async function createPayment({ orderId, amount, currency = 'BDT', intent = 'sale', callbackURL, merchantInvoice }) {
  const data = await _request('/tokenized/checkout/create', {
    mode: '0011',            // Checkout URL mode
    payerReference: orderId,
    callbackURL: callbackURL || bkashConfig.callbackURL,
    amount: parseFloat(amount).toFixed(2),
    currency,
    intent,
    merchantInvoiceNumber: merchantInvoice || orderId,
  });

  if (data.statusCode !== '0000') {
    throw new Error(`bKash createPayment error: ${data.statusMessage || JSON.stringify(data)}`);
  }

  return data;
}

// ─── Execute Payment ──────────────────────────────────────────────────────────

/**
 * Execute a bKash payment after user authentication.
 * @param {string} paymentID - bKash payment ID returned from createPayment
 * @returns {object} Execute payment response
 */
export async function executePayment(paymentID) {
  const data = await _request('/tokenized/checkout/execute', { paymentID });

  if (!['0000', '0024'].includes(data.statusCode)) {
    throw new Error(`bKash executePayment error: ${data.statusMessage || JSON.stringify(data)}`);
  }

  return data;
}

// ─── Query Payment ────────────────────────────────────────────────────────────

/**
 * Query the status of a bKash payment.
 * @param {string} paymentID
 * @returns {object} Payment details
 */
export async function queryPayment(paymentID) {
  const data = await _request('/tokenized/checkout/payment/status', { paymentID });
  return data;
}

// ─── Refund Payment ───────────────────────────────────────────────────────────

/**
 * Refund a bKash payment (full or partial).
 * @param {object} opts
 * @param {string}  opts.paymentID  - bKash payment ID
 * @param {string}  opts.trxID      - bKash transaction ID
 * @param {string}  opts.orderId    - Internal order ID
 * @param {number}  opts.amount     - Refund amount in BDT
 * @param {string}  opts.reason     - Refund reason
 * @returns {object} Refund response
 */
export async function refundPayment({ paymentID, trxID, orderId, amount, reason }) {
  const data = await _request('/tokenized/checkout/payment/refund', {
    paymentID,
    trxID,
    amount: parseFloat(amount).toFixed(2),
    currency: 'BDT',
    reason: reason || 'Customer requested refund',
    sku: orderId,
  });

  if (!['0000', '0003'].includes(data.statusCode)) {
    throw new Error(`bKash refund error: ${data.statusMessage || JSON.stringify(data)}`);
  }

  return data;
}

// ─── Agreement (Tokenized) ────────────────────────────────────────────────────

/**
 * Create a bKash agreement for recurring / tokenized payments.
 * @param {object} opts
 * @param {string}  opts.payerReference - Your customer identifier
 * @param {string}  opts.callbackURL    - Callback after agreement
 * @returns {object} Agreement response (contains bkashURL)
 */
export async function createAgreement({ payerReference, callbackURL }) {
  const data = await _request('/tokenized/checkout/create', {
    mode: '0000',            // Agreement mode
    payerReference,
    callbackURL: callbackURL || bkashConfig.callbackURL,
  });

  if (data.statusCode !== '0000') {
    throw new Error(`bKash createAgreement error: ${data.statusMessage || JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Execute a bKash agreement.
 * @param {string} paymentID
 * @returns {object} Agreement execute response (contains agreementID)
 */
export async function executeAgreement(paymentID) {
  const data = await _request('/tokenized/checkout/execute', { paymentID });

  if (!['0000', '0024'].includes(data.statusCode)) {
    throw new Error(`bKash executeAgreement error: ${data.statusMessage || JSON.stringify(data)}`);
  }

  return data;
}

// ─── Webhook / Callback Handling ─────────────────────────────────────────────

/**
 * Process a bKash callback after user completes payment on bKash UI.
 * Called by the controller when the user is redirected back to our callbackURL.
 *
 * @param {object} opts
 * @param {string}  opts.paymentID  - From callback query param
 * @param {string}  opts.status     - 'success' | 'failure' | 'cancel'
 * @param {string}  opts.orderId    - Internal order ID
 * @returns {{ success: boolean, payment?: object }}
 */
export async function handleCallback({ paymentID, status, orderId }) {
  if (status !== 'success') {
    await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', paymentID);
    return { success: false };
  }

  const result = await executePayment(paymentID);

  if (result.transactionStatus === 'Completed') {
    await supabase.from('payments').update({
      status: 'completed',
      metadata: { bkash_trx_id: result.trxID, bkash_payment_id: result.paymentID },
    }).eq('provider_id', paymentID);

    if (orderId) {
      await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', orderId);
    }

    return { success: true, payment: result };
  }

  await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', paymentID);
  return { success: false };
}
