/**
 * Globex Sky — paypal.service.js  (payment layer)
 * Full PayPal integration:
 *  - Create order
 *  - Capture payment
 *  - Process refunds
 *  - Subscription management
 *  - Webhook handling
 *  - Payout to suppliers
 */

import supabase from '../../config/supabase.js';
import { paypalConfig } from '../../config/integrations.js';

// ─── Token Cache ──────────────────────────────────────────────────────────────

let _accessToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  const { clientId, clientSecret, baseUrl } = paypalConfig;
  if (!clientId || !clientSecret) throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not set.');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${text}`);
  }

  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}

async function _request(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalConfig.baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`PayPal ${method} ${path} failed: ${JSON.stringify(err)}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * Create a PayPal order.
 * @param {object} opts
 * @param {number}   opts.amount
 * @param {string}   [opts.currency='USD']
 * @param {string}   opts.referenceId  - Your internal order ID
 * @param {string}   [opts.returnUrl]
 * @param {string}   [opts.cancelUrl]
 * @returns PayPal order object (contains id and approve link)
 */
export async function createOrder({ amount, currency = 'USD', referenceId, returnUrl, cancelUrl }) {
  const baseUrl = process.env.FRONTEND_URL || 'https://globexsky.com';
  return _request('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: referenceId,
      amount: { currency_code: currency.toUpperCase(), value: parseFloat(amount).toFixed(2) },
    }],
    application_context: {
      return_url: returnUrl || `${baseUrl}/pages/payment/payment-success.html`,
      cancel_url: cancelUrl || `${baseUrl}/pages/payment/payment-failed.html`,
      brand_name: 'Globex Sky',
      landing_page: 'LOGIN',
      user_action: 'PAY_NOW',
    },
  });
}

/**
 * Capture a PayPal order.
 */
export async function captureOrder(orderId) {
  const result = await _request('POST', `/v2/checkout/orders/${orderId}/capture`);
  const capture = result?.purchase_units?.[0]?.payments?.captures?.[0];
  if (capture) {
    await supabase.from('payments').update({ status: 'completed', paypal_capture_id: capture.id })
      .eq('paypal_order_id', orderId);
  }
  return result;
}

/**
 * Get order details.
 */
export async function getOrder(orderId) {
  return _request('GET', `/v2/checkout/orders/${orderId}`);
}

// ─── Refunds ─────────────────────────────────────────────────────────────────

/**
 * Refund a captured PayPal payment.
 * @param {string} captureId - PayPal capture ID
 * @param {number|null} amount - Decimal amount; omit for full refund
 * @param {string} [currency='USD']
 * @param {string} [noteToPayer]
 */
export async function refundCapture(captureId, amount, currency = 'USD', noteToPayer = '') {
  const body = {};
  if (amount) body.amount = { value: parseFloat(amount).toFixed(2), currency_code: currency.toUpperCase() };
  if (noteToPayer) body.note_to_payer = noteToPayer;
  return _request('POST', `/v2/payments/captures/${captureId}/refund`, body);
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

/**
 * Create a PayPal subscription.
 * @param {object} opts
 * @param {string} opts.planId       - PayPal billing plan ID
 * @param {string} opts.subscriberEmail
 * @param {string} opts.subscriberName
 * @param {string} [opts.returnUrl]
 * @param {string} [opts.cancelUrl]
 */
export async function createSubscription({ planId, subscriberEmail, subscriberName, returnUrl, cancelUrl }) {
  const baseUrl = process.env.FRONTEND_URL || 'https://globexsky.com';
  return _request('POST', '/v1/billing/subscriptions', {
    plan_id: planId,
    subscriber: { name: { given_name: subscriberName }, email_address: subscriberEmail },
    application_context: {
      brand_name: 'Globex Sky',
      return_url: returnUrl || `${baseUrl}/pages/payment/payment-success.html`,
      cancel_url: cancelUrl || `${baseUrl}/pages/payment/payment-failed.html`,
    },
  });
}

/**
 * Cancel a PayPal subscription.
 */
export async function cancelSubscription(subscriptionId, reason = 'User requested') {
  await _request('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, { reason });
  await supabase.from('subscriptions').update({ status: 'cancelled' })
    .eq('paypal_subscription_id', subscriptionId);
}

/**
 * Get details of a subscription.
 */
export async function getSubscription(subscriptionId) {
  return _request('GET', `/v1/billing/subscriptions/${subscriptionId}`);
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

/**
 * Payout funds to one or more suppliers.
 * @param {Array<{ receiverEmail: string, amount: number, currency: string, note: string, senderItemId: string }>} items
 * @param {string} batchId - Unique payout batch reference
 */
export async function createPayout(items, batchId) {
  const payoutItems = items.map(item => ({
    recipient_type: 'EMAIL',
    amount: { value: parseFloat(item.amount).toFixed(2), currency: (item.currency || 'USD').toUpperCase() },
    note: item.note || 'Globex Sky Payout',
    receiver: item.receiverEmail,
    sender_item_id: item.senderItemId,
  }));

  return _request('POST', '/v1/payments/payouts', {
    sender_batch_header: {
      sender_batch_id: batchId,
      email_subject: 'You have a payout from Globex Sky',
      email_message: 'Your earnings have been transferred to your PayPal account.',
    },
    items: payoutItems,
  });
}

/**
 * Get payout batch status.
 */
export async function getPayoutBatch(batchId) {
  return _request('GET', `/v1/payments/payouts/${batchId}`);
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

/**
 * Verify a PayPal webhook signature.
 * @param {object} headers - Request headers
 * @param {string} rawBody - Raw request body string
 * @returns {boolean}
 */
export async function verifyWebhook(headers, rawBody) {
  try {
    const result = await _request('POST', '/v1/notifications/verify-webhook-signature', {
      webhook_id: paypalConfig.webhookId,
      transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'],
      transmission_sig: headers['paypal-transmission-sig'],
      webhook_event: JSON.parse(rawBody),
    });
    return result?.verification_status === 'SUCCESS';
  } catch (_) {
    return false;
  }
}

/**
 * Handle a verified PayPal webhook event and update local records.
 * @param {object} event - Parsed PayPal webhook event body
 */
export async function handleWebhookEvent(event) {
  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const capture = event.resource;
      await supabase.from('payments').update({ status: 'completed', paypal_capture_id: capture.id })
        .eq('paypal_order_id', capture.supplementary_data?.related_ids?.order_id || '');
      break;
    }
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.DECLINED': {
      const capture = event.resource;
      await supabase.from('payments').update({ status: 'failed' })
        .eq('paypal_capture_id', capture.id);
      break;
    }
    case 'PAYMENT.CAPTURE.REFUNDED': {
      const refund = event.resource;
      await supabase.from('payments').update({ status: 'refunded' })
        .eq('paypal_capture_id', refund.links?.find(l => l.rel === 'up')?.href?.split('/').pop() || '');
      break;
    }
    case 'BILLING.SUBSCRIPTION.ACTIVATED': {
      const sub = event.resource;
      await supabase.from('subscriptions').update({ status: 'active', paypal_subscription_id: sub.id })
        .eq('paypal_subscription_id', sub.id);
      break;
    }
    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      const sub = event.resource;
      await supabase.from('subscriptions').update({ status: 'cancelled' })
        .eq('paypal_subscription_id', sub.id);
      break;
    }
    default:
      break;
  }
}
