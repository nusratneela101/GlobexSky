/**
 * Globex Sky — nagad.service.js  (payment layer)
 * Nagad Payment Gateway integration (Bangladesh).
 *
 * Nagad uses RSA encryption:
 *  - Merchant public key encrypts sensitive data sent to Nagad
 *  - Nagad's public key is used to verify responses
 *
 * Supports:
 *  - Payment initialization
 *  - Payment completion
 *  - Payment status query
 *  - Refund
 *
 * Required env vars:
 *   NAGAD_MERCHANT_ID
 *   NAGAD_MERCHANT_PRIVATE_KEY  — PEM formatted (base64 encoded) merchant private key
 *   NAGAD_PUBLIC_KEY            — PEM formatted (base64 encoded) Nagad public key
 *   NAGAD_MODE                  — 'sandbox' (default) or 'live'
 */

import crypto from 'crypto';
import supabase from '../../config/supabase.js';
import { nagadConfig } from '../../config/integrations.js';

// ─── RSA Helpers ──────────────────────────────────────────────────────────────

function _pemPrivate(b64pem) {
  const pem = b64pem.startsWith('-----')
    ? b64pem
    : `-----BEGIN RSA PRIVATE KEY-----\n${b64pem}\n-----END RSA PRIVATE KEY-----`;
  return pem;
}

function _pemPublic(b64pem) {
  const pem = b64pem.startsWith('-----')
    ? b64pem
    : `-----BEGIN PUBLIC KEY-----\n${b64pem}\n-----END PUBLIC KEY-----`;
  return pem;
}

/** Encrypt data with Nagad's RSA public key (PKCS1_OAEP). */
function encryptWithNagadPublicKey(plaintext) {
  const { nagadPublicKey } = nagadConfig;
  if (!nagadPublicKey) throw new Error('NAGAD_PUBLIC_KEY is not set.');
  const publicKey = crypto.createPublicKey(_pemPublic(nagadPublicKey));
  return crypto
    .publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(plaintext))
    .toString('base64');
}

/** Sign data with merchant's RSA private key (SHA256). */
function signWithMerchantKey(plaintext) {
  const { merchantPrivateKey } = nagadConfig;
  if (!merchantPrivateKey) throw new Error('NAGAD_MERCHANT_PRIVATE_KEY is not set.');
  const privateKey = crypto.createPrivateKey(_pemPrivate(merchantPrivateKey));
  const sign = crypto.createSign('SHA256');
  sign.update(plaintext);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

// ─── Internal Request Helper ─────────────────────────────────────────────────

async function _request(method, path, body) {
  const { baseUrl, merchantId } = nagadConfig;
  const datetime = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000').replace('T', ' ');

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-KM-Api-Version': 'v-0.2.0',
    'X-KM-IP-V4': '127.0.0.1',
    'X-KM-Client-Type': 'PC_WEB',
    'X-KM-MC-Id': merchantId,
    datetime,
  };

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nagad API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── Initialize Payment ───────────────────────────────────────────────────────

/**
 * Initialize a Nagad payment order.
 * @param {object} opts
 * @param {string}  opts.orderId        - Your internal order ID
 * @param {number}  opts.amount         - Amount in BDT (e.g. 500.00)
 * @param {string}  opts.callbackURL    - Callback URL after user pays
 * @returns {{ callBackUrl: string, merchantId: string }} Response with redirect URL
 */
export async function initializePayment({ orderId, amount, callbackURL }) {
  const { merchantId } = nagadConfig;
  const datetime = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000').replace('T', ' ');

  const sensitiveData = {
    merchantId,
    datetime,
    orderId,
    challenge: crypto.randomBytes(32).toString('hex'),
  };

  const encryptedData  = encryptWithNagadPublicKey(JSON.stringify(sensitiveData));
  const signature      = signWithMerchantKey(JSON.stringify(sensitiveData));

  const data = await _request('POST', `/api/v1/pos/order/initialize/${merchantId}/${orderId}`, {
    dateTime: datetime,
    sensitiveData: encryptedData,
    signature,
    merchantCallbackURL: callbackURL || nagadConfig.callbackURL,
    additionalMerchantInfo: { mobileNo: '' },
  });

  if (!data.sensitiveData) {
    throw new Error(`Nagad initializePayment error: ${JSON.stringify(data)}`);
  }

  return data;
}

// ─── Complete Payment ─────────────────────────────────────────────────────────

/**
 * Complete a Nagad payment (called after redirect from Nagad checkout).
 * @param {string} paymentReferenceId - From Nagad callback query param
 * @returns {object} Completion response
 */
export async function completePayment(paymentReferenceId) {
  const { merchantId } = nagadConfig;
  const datetime = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000').replace('T', ' ');

  const sensitiveData = {
    merchantId,
    orderId: paymentReferenceId,
    challenge: crypto.randomBytes(32).toString('hex'),
  };

  const encryptedData = encryptWithNagadPublicKey(JSON.stringify(sensitiveData));
  const signature     = signWithMerchantKey(JSON.stringify(sensitiveData));

  const data = await _request('POST', `/api/v1/pos/order/complete/${paymentReferenceId}`, {
    dateTime: datetime,
    sensitiveData: encryptedData,
    signature,
  });

  return data;
}

// ─── Query Payment Status ─────────────────────────────────────────────────────

/**
 * Check the status of a Nagad payment.
 * @param {string} paymentReferenceId
 * @returns {object} Status details
 */
export async function queryPaymentStatus(paymentReferenceId) {
  const { merchantId } = nagadConfig;
  const data = await _request('GET', `/api/v1/pos/order/status/${merchantId}/${paymentReferenceId}`);
  return data;
}

// ─── Refund ───────────────────────────────────────────────────────────────────

/**
 * Refund a Nagad payment.
 * @param {object} opts
 * @param {string}  opts.paymentReferenceId
 * @param {number}  opts.amount    - Refund amount in BDT
 * @param {string}  opts.reason    - Refund reason
 * @returns {object} Refund response
 */
export async function refundPayment({ paymentReferenceId, amount, reason }) {
  const { merchantId } = nagadConfig;
  const datetime = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000').replace('T', ' ');

  const sensitiveData = {
    merchantId,
    orderId: paymentReferenceId,
    amount: parseFloat(amount).toFixed(2),
    challenge: crypto.randomBytes(32).toString('hex'),
  };

  const encryptedData = encryptWithNagadPublicKey(JSON.stringify(sensitiveData));
  const signature     = signWithMerchantKey(JSON.stringify(sensitiveData));

  const data = await _request('POST', `/api/v1/pos/order/refund/${paymentReferenceId}`, {
    dateTime: datetime,
    sensitiveData: encryptedData,
    signature,
    reason: reason || 'Customer requested refund',
  });

  return data;
}

// ─── Callback Handler ─────────────────────────────────────────────────────────

/**
 * Process a Nagad callback after user completes payment.
 * @param {object} opts
 * @param {string}  opts.paymentRefId  - Payment reference ID from Nagad callback
 * @param {string}  opts.orderId       - Internal order ID
 * @param {string}  opts.status        - Status string from Nagad
 * @returns {{ success: boolean, payment?: object }}
 */
export async function handleCallback({ paymentRefId, orderId, status }) {
  if (status !== 'Success' && status !== 'COMPLETED') {
    await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', paymentRefId);
    return { success: false };
  }

  try {
    const result = await completePayment(paymentRefId);

    if (result.status === 'Success' || result.status === 'COMPLETED') {
      await supabase.from('payments').update({
        status: 'completed',
        metadata: {
          nagad_payment_ref_id: paymentRefId,
          nagad_trx_id: result.issuerPaymentRefNo,
        },
      }).eq('provider_id', paymentRefId);

      if (orderId) {
        await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', orderId);
      }

      return { success: true, payment: result };
    }

    await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', paymentRefId);
    return { success: false };
  } catch (err) {
    await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', paymentRefId);
    throw err;
  }
}
