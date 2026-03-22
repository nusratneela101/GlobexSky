/**
 * Globex Sky — paypalService.js
 * PayPal payment integration service via PayPal REST API.
 * Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in environment variables.
 * Set PAYPAL_MODE to 'sandbox' (default) or 'live'.
 */

const PAYPAL_BASE_URL =
  (process.env.PAYPAL_MODE || 'sandbox') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

/** Cache access token with expiry */
let _accessToken = null;
let _tokenExpiry = 0;

/**
 * Obtain a PayPal OAuth 2.0 access token.
 * @returns {string} Access token
 */
async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable is not set.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }

  const data = await response.json();
  _accessToken = data.access_token;
  // Expire 60s before actual expiry for safety
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}

/**
 * Create a PayPal order.
 * @param {number} amount - Decimal amount (e.g. 99.99)
 * @param {string} currency - ISO currency code (default: 'USD')
 * @param {string} referenceId - Your internal reference (order_id)
 * @returns {object} PayPal order object (contains id and approve link)
 */
export async function createOrder({ amount, currency = 'USD', referenceId }) {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: referenceId,
          amount: {
            currency_code: currency.toUpperCase(),
            value: parseFloat(amount).toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/pages/payment/payment-success.html`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://globexsky.com'}/pages/payment/payment-failed.html`,
        brand_name: 'Globex Sky',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`PayPal createOrder failed: ${JSON.stringify(err)}`);
  }

  return response.json();
}

/**
 * Capture a PayPal order (complete payment).
 * @param {string} orderId - PayPal order ID
 * @returns {object} Capture result
 */
export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`PayPal captureOrder failed: ${JSON.stringify(err)}`);
  }

  return response.json();
}

/**
 * Get PayPal order details.
 * @param {string} orderId
 */
export async function getOrder(orderId) {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to retrieve PayPal order.');
  return response.json();
}

/**
 * Verify a PayPal webhook signature.
 * @param {object} headers - Request headers
 * @param {string} rawBody - Raw request body string
 * @returns {boolean} True if verified
 */
export async function verifyWebhook(headers, rawBody) {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhook_id: process.env.PAYPAL_WEBHOOK_ID || '',
      transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'],
      transmission_sig: headers['paypal-transmission-sig'],
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.verification_status === 'SUCCESS';
}
