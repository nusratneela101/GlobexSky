import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

// ─── Payment service imports ──────────────────────────────────────────────────
import * as stripeService  from '../services/payment/stripe.service.js';
import * as bkashService   from '../services/payment/bkash.service.js';
import * as nagadService   from '../services/payment/nagad.service.js';
import * as paypalService  from '../services/payment/paypal.service.js';
import { createCodOrderRecord } from '../services/cod.service.js';

// ─── Minimum order amount (USD) ───────────────────────────────────────────────
const MIN_AMOUNT = 0.5; // in USD (or equivalent in the order's currency)

// ─── List Transactions ────────────────────────────────────────────────────────

export async function listTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { from, to } = buildPagination(page, limit);
    const { data, error, count } = await supabase.from('transactions').select('*', { count: 'exact' })
      .eq('user_id', req.user.id).order('created_at', { ascending: false }).range(from, to);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

// ─── Get Transaction ──────────────────────────────────────────────────────────

export async function getTransaction(req, res, next) {
  try {
    const { data, error } = await supabase.from('transactions').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Transaction not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Initiate Payment (unified gateway router) ────────────────────────────────

/**
 * POST /api/payments/initiate
 * Body: { method: 'stripe'|'bkash'|'nagad'|'paypal'|'cod', orderId, amount, currency, ... }
 */
export async function initiatePayment(req, res, next) {
  try {
    const { method, orderId, amount, currency = 'USD' } = req.body;

    if (!method) return res.status(400).json({ success: false, error: 'Payment method is required.' });
    if (!orderId) return res.status(400).json({ success: false, error: 'orderId is required.' });
    if (!amount || isNaN(amount) || +amount < MIN_AMOUNT) {
      return res.status(400).json({ success: false, error: `Amount must be at least ${MIN_AMOUNT}.` });
    }

    const amountNum = +parseFloat(amount).toFixed(2);
    const baseUrl   = process.env.FRONTEND_URL || 'https://globexsky.com';

    switch (method) {
      case 'stripe': {
        const pi = await stripeService.createPaymentIntent({
          amount: Math.round(amountNum * 100),
          currency: currency.toLowerCase(),
          metadata: { orderId, userId: req.user.id },
        });
        return res.json({ success: true, gateway: 'stripe', clientSecret: pi.client_secret, paymentIntentId: pi.id });
      }

      case 'bkash': {
        const callbackURL = `${baseUrl}/pages/payment/payment.html?gateway=bkash&order_id=${orderId}`;
        const payment = await bkashService.createPayment({ orderId, amount: amountNum, callbackURL });
        return res.json({ success: true, gateway: 'bkash', paymentUrl: payment.bkashURL, paymentID: payment.paymentID });
      }

      case 'nagad': {
        const callbackURL = `${baseUrl}/pages/payment/payment.html?gateway=nagad&order_id=${orderId}`;
        const init = await nagadService.initializePayment({ orderId, amount: amountNum, callbackURL });
        return res.json({ success: true, gateway: 'nagad', paymentUrl: init.callBackUrl, sensitiveData: init.sensitiveData });
      }

      case 'paypal': {
        const returnUrl = `${baseUrl}/pages/payment/payment-success.html?order_id=${orderId}`;
        const cancelUrl = `${baseUrl}/pages/payment/payment-failed.html?order_id=${orderId}`;
        const order = await paypalService.createOrder({ amount: amountNum, currency, referenceId: orderId, returnUrl, cancelUrl });
        const approveLink = order.links?.find(l => l.rel === 'approve')?.href;
        return res.json({ success: true, gateway: 'paypal', paymentUrl: approveLink, orderId: order.id });
      }

      case 'cod': {
        const codOrder = await createCodOrderRecord({
          order_id: orderId,
          buyer_id: req.user.id,
          amount: amountNum,
          address: req.body.address,
          notes: req.body.notes,
        });
        const { error: updateErr } = await supabase.from('orders').update({ payment_status: 'cod_pending', status: 'confirmed' }).eq('id', orderId);
        if (updateErr) console.error(`[COD] Failed to update order ${orderId} status:`, updateErr.message);
        return res.json({ success: true, gateway: 'cod', codOrderId: codOrder.id, message: 'COD order placed successfully.' });
      }

      default:
        return res.status(400).json({ success: false, error: `Unsupported payment method: ${method}` });
    }
  } catch (err) { next(err); }
}

// ─── Stripe Webhook ───────────────────────────────────────────────────────────

export async function stripeWebhook(req, res, next) {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig) return res.status(400).json({ success: false, error: 'Missing Stripe-Signature header.' });

    const event = await stripeService.constructWebhookEvent(req.body, sig);
    await stripeService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

// ─── bKash Callback ───────────────────────────────────────────────────────────

export async function bkashCallback(req, res, next) {
  try {
    const { paymentID, status } = req.method === 'GET' ? req.query : req.body;
    const orderId = req.query.order_id || req.body.order_id;

    const result = await bkashService.handleCallback({ paymentID, status, orderId });

    if (result.success) {
      return res.redirect(`${process.env.FRONTEND_URL || ''}/pages/payment/payment-success.html?order_id=${orderId}&gateway=bkash`);
    }
    res.redirect(`${process.env.FRONTEND_URL || ''}/pages/payment/payment-failed.html?order_id=${orderId}&gateway=bkash`);
  } catch (err) { next(err); }
}

// ─── Nagad Callback ───────────────────────────────────────────────────────────

export async function nagadCallback(req, res, next) {
  try {
    const { payment_ref_id, status } = req.method === 'GET' ? req.query : req.body;
    const orderId = req.query.order_id || req.body.order_id;

    const result = await nagadService.handleCallback({ paymentRefId: payment_ref_id, orderId, status });

    if (result.success) {
      return res.redirect(`${process.env.FRONTEND_URL || ''}/pages/payment/payment-success.html?order_id=${orderId}&gateway=nagad`);
    }
    res.redirect(`${process.env.FRONTEND_URL || ''}/pages/payment/payment-failed.html?order_id=${orderId}&gateway=nagad`);
  } catch (err) { next(err); }
}

// ─── PayPal Success / Cancel ──────────────────────────────────────────────────

export async function paypalSuccess(req, res, next) {
  try {
    const { token: paypalOrderId, order_id: orderId } = req.query;
    if (!paypalOrderId) return res.status(400).json({ success: false, error: 'Missing PayPal token.' });

    await paypalService.captureOrder(paypalOrderId);
    const { error: updateErr } = await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', orderId);
    if (updateErr) console.error(`[PayPal] Failed to update order ${orderId} status:`, updateErr.message);

    res.redirect(`${process.env.FRONTEND_URL || ''}/pages/payment/payment-success.html?order_id=${orderId}&gateway=paypal`);
  } catch (err) { next(err); }
}

export async function paypalCancel(req, res, next) {
  try {
    const orderId = req.query.order_id || '';
    res.redirect(`${process.env.FRONTEND_URL || ''}/pages/payment/payment-failed.html?order_id=${orderId}&gateway=paypal&reason=cancelled`);
  } catch (err) { next(err); }
}

export async function paypalWebhook(req, res, next) {
  try {
    const rawBody = JSON.stringify(req.body);
    const verified = await paypalService.verifyWebhook(req.headers, rawBody);
    if (!verified) return res.status(400).json({ success: false, error: 'PayPal webhook verification failed.' });

    await paypalService.handleWebhookEvent(req.body);
    res.json({ received: true });
  } catch (err) { next(err); }
}

// ─── Get Payment Status ───────────────────────────────────────────────────────

export async function getPaymentStatus(req, res, next) {
  try {
    const { paymentId } = req.params;
    const { data, error } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Payment not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Refund Payment ───────────────────────────────────────────────────────────

export async function refundPayment(req, res, next) {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const { data: payment, error } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (error || !payment) return res.status(404).json({ success: false, error: 'Payment not found.' });

    let refundResult;
    switch (payment.gateway || payment.payment_gateway) {
      case 'stripe':
        refundResult = await stripeService.createRefund(payment.stripe_payment_intent_id, amount ? Math.round(+amount * 100) : null, reason);
        break;
      case 'paypal':
        refundResult = await paypalService.refundCapture(payment.paypal_capture_id, amount, payment.currency, reason);
        break;
      case 'bkash':
        refundResult = await bkashService.refundPayment({
          paymentID: payment.provider_id,
          trxID: payment.metadata?.bkash_trx_id,
          orderId: payment.order_id,
          amount: amount || payment.amount,
          reason,
        });
        break;
      case 'nagad':
        refundResult = await nagadService.refundPayment({
          paymentReferenceId: payment.provider_id,
          amount: amount || payment.amount,
          reason,
        });
        break;
      default:
        return res.status(400).json({ success: false, error: `Refunds not supported for gateway: ${payment.gateway}` });
    }

    await supabase.from('payments').update({ status: 'refunded' }).eq('id', paymentId);
    res.json({ success: true, data: refundResult, message: 'Refund initiated successfully.' });
  } catch (err) { next(err); }
}

// ─── Get All Payments for an Order ───────────────────────────────────────────

export async function getOrderPayments(req, res, next) {
  try {
    const { orderId } = req.params;
    const { data, error } = await supabase.from('payments').select('*')
      .eq('order_id', orderId).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

// ─── Legacy endpoints (kept for backwards-compatibility) ──────────────────────

export async function processPayment(req, res, next) {
  try {
    const { order_id, payment_method } = req.body;
    const { data: order } = await supabase.from('orders').select('total').eq('id', order_id).single();
    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });

    const { data: txn, error } = await supabase.from('transactions').insert({
      user_id: req.user.id,
      order_id,
      type: 'payment',
      amount: order.total,
      currency: 'USD',
      status: 'completed',
      payment_method,
      payment_gateway: 'manual',
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', order_id);
    res.json({ success: true, data: txn });
  } catch (err) { next(err); }
}

export async function requestRefund(req, res, next) {
  try {
    const { transaction_id, reason } = req.body;
    const { data: txn } = await supabase.from('transactions').select('*').eq('id', transaction_id).single();
    if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found.' });

    const { data, error } = await supabase.from('transactions').insert({
      user_id: req.user.id,
      order_id: txn.order_id,
      type: 'refund',
      amount: txn.amount,
      currency: txn.currency,
      status: 'pending',
      payment_method: txn.payment_method,
      payment_gateway: txn.payment_gateway,
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Refund request submitted.' });
  } catch (err) { next(err); }
}

export async function getPaymentMethods(req, res) {
  res.json({ success: true, data: [
    { id: 'stripe', name: 'Credit / Debit Card (Stripe)', icon: 'fab fa-stripe' },
    { id: 'paypal',  name: 'PayPal',                      icon: 'fab fa-paypal' },
    { id: 'bkash',   name: 'bKash',                       icon: 'fas fa-mobile-alt' },
    { id: 'nagad',   name: 'Nagad',                       icon: 'fas fa-mobile-screen' },
    { id: 'cod',     name: 'Cash on Delivery',            icon: 'fas fa-money-bill' },
  ] });
}
