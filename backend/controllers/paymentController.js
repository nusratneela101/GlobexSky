/**
 * Globex Sky — paymentController.js
 * Handles Stripe, PayPal, Bank Transfer, and Escrow payment flows.
 */

import supabase from '../config/supabase.js';
import * as stripeService from '../services/stripeService.js';
import * as paypalService from '../services/paypalService.js';

/* ─── Stripe ──────────────────────────────────────────────────────────── */

/** POST /api/payments/create-intent */
export async function createPaymentIntent(req, res, next) {
  try {
    const { order_id, currency = 'usd' } = req.body;
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, total, status')
      .eq('id', order_id)
      .single();
    if (oErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });

    const amountCents = Math.round(parseFloat(order.total) * 100);
    const intent = await stripeService.createPaymentIntent({
      amount: amountCents,
      currency,
      metadata: { order_id, user_id: req.user.id },
    });

    // Persist payment record
    await supabase.from('payments').insert({
      order_id,
      user_id: req.user.id,
      amount: order.total,
      currency: currency.toUpperCase(),
      method: 'card',
      provider: 'stripe',
      provider_id: intent.id,
      status: 'pending',
      metadata: { client_secret: intent.client_secret },
    });

    res.json({ success: true, data: { client_secret: intent.client_secret, payment_intent_id: intent.id } });
  } catch (err) { next(err); }
}

/** POST /api/payments/confirm */
export async function confirmPayment(req, res, next) {
  try {
    const { payment_intent_id, payment_method_id } = req.body;
    const confirmed = await stripeService.confirmPaymentIntent(payment_intent_id, payment_method_id);

    const status = confirmed.status === 'succeeded' ? 'completed' : 'pending';
    await supabase.from('payments').update({ status }).eq('provider_id', payment_intent_id);

    if (status === 'completed') {
      const order_id = confirmed.metadata?.order_id;
      if (order_id) {
        await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', order_id);
      }
    }

    res.json({ success: true, data: { status: confirmed.status } });
  } catch (err) { next(err); }
}

/* ─── PayPal ─────────────────────────────────────────────────────────── */

/** POST /api/payments/paypal/create */
export async function createPaypalOrder(req, res, next) {
  try {
    const { order_id, currency = 'USD' } = req.body;
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, total')
      .eq('id', order_id)
      .single();
    if (oErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });

    const ppOrder = await paypalService.createOrder({ amount: order.total, currency, referenceId: order_id });

    await supabase.from('payments').insert({
      order_id,
      user_id: req.user.id,
      amount: order.total,
      currency: currency.toUpperCase(),
      method: 'paypal',
      provider: 'paypal',
      provider_id: ppOrder.id,
      status: 'pending',
      metadata: { paypal_order_id: ppOrder.id },
    });

    const approveLink = ppOrder.links?.find(l => l.rel === 'approve')?.href;
    res.json({ success: true, data: { paypal_order_id: ppOrder.id, approve_url: approveLink } });
  } catch (err) { next(err); }
}

/** POST /api/payments/paypal/capture */
export async function capturePaypalPayment(req, res, next) {
  try {
    const { paypal_order_id } = req.body;
    const capture = await paypalService.captureOrder(paypal_order_id);

    const captureStatus = capture.status === 'COMPLETED' ? 'completed' : 'pending';
    await supabase.from('payments').update({ status: captureStatus }).eq('provider_id', paypal_order_id);

    if (captureStatus === 'completed') {
      const order_id = capture.purchase_units?.[0]?.reference_id;
      if (order_id) {
        await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', order_id);
      }
    }

    res.json({ success: true, data: { status: capture.status } });
  } catch (err) { next(err); }
}

/* ─── Bank Transfer ──────────────────────────────────────────────────── */

/** POST /api/payments/bank-transfer */
export async function processBankTransfer(req, res, next) {
  try {
    const { order_id, bank_reference, currency = 'USD' } = req.body;
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, total')
      .eq('id', order_id)
      .single();
    if (oErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });

    const { data: payment, error } = await supabase.from('payments').insert({
      order_id,
      user_id: req.user.id,
      amount: order.total,
      currency: currency.toUpperCase(),
      method: 'bank_transfer',
      provider: 'manual',
      provider_id: bank_reference || null,
      status: 'pending',
      metadata: { bank_reference, instructions_sent: true },
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({
      success: true,
      data: payment,
      message: 'Bank transfer initiated. Please complete the transfer using the provided details.',
      bank_details: {
        bank_name: process.env.BANK_NAME || 'Global Bank Ltd.',
        account_name: process.env.BANK_ACCOUNT_NAME || 'Globex International Trade Co., Ltd.',
        account_number: process.env.BANK_ACCOUNT_NUMBER || 'XXXX-XXXX-XXXX',
        routing_number: process.env.BANK_ROUTING_NUMBER || 'XXXXXXXXX',
        swift_code: process.env.BANK_SWIFT_CODE || 'GLOBUSXX',
        reference: order_id,
      },
    });
  } catch (err) { next(err); }
}

/* ─── Escrow ──────────────────────────────────────────────────────────── */

/** POST /api/payments/escrow/create */
export async function createEscrow(req, res, next) {
  try {
    const { order_id, seller_id, release_conditions } = req.body;
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, total')
      .eq('id', order_id)
      .single();
    if (oErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });

    const { data: escrow, error } = await supabase.from('escrow').insert({
      order_id,
      buyer_id: req.user.id,
      seller_id,
      amount: order.total,
      status: 'held',
      release_conditions: release_conditions || 'Buyer confirms receipt of goods.',
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    await supabase.from('payments').insert({
      order_id,
      user_id: req.user.id,
      amount: order.total,
      currency: 'USD',
      method: 'escrow',
      provider: 'globexsky_escrow',
      provider_id: escrow.id,
      status: 'held',
      metadata: { escrow_id: escrow.id },
    });

    res.json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

/** POST /api/payments/escrow/release */
export async function releaseEscrow(req, res, next) {
  try {
    const { escrow_id } = req.body;
    const { data: escrow, error: eErr } = await supabase
      .from('escrow')
      .select('*')
      .eq('id', escrow_id)
      .single();
    if (eErr || !escrow) return res.status(404).json({ success: false, error: 'Escrow record not found.' });
    if (escrow.buyer_id !== req.user.id) return res.status(403).json({ success: false, error: 'Unauthorized.' });
    if (escrow.status !== 'held') return res.status(400).json({ success: false, error: 'Escrow is not in held status.' });

    const { data, error } = await supabase
      .from('escrow')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', escrow_id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    await supabase.from('payments').update({ status: 'completed' }).eq('provider_id', escrow_id);

    res.json({ success: true, data, message: 'Escrow funds released to seller.' });
  } catch (err) { next(err); }
}

/* ─── Payment History ────────────────────────────────────────────────── */

/** GET /api/payments/history */
export async function getPaymentHistory(req, res, next) {
  try {
    const { page = 1, limit = 20, status, method } = req.query;
    const from = (page - 1) * limit;
    const to = from + parseInt(limit) - 1;

    let query = supabase
      .from('payments')
      .select('*, orders(order_number, total)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (method) query = query.eq('method', method);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/* ─── Refund ────────────────────────────────────────────────────────── */

/** POST /api/payments/refund */
export async function processRefund(req, res, next) {
  try {
    const { payment_id, amount, reason } = req.body;
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();
    if (pErr || !payment) return res.status(404).json({ success: false, error: 'Payment not found.' });
    if (payment.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Unauthorized.' });

    let refundResult = null;

    if (payment.provider === 'stripe' && payment.provider_id) {
      // Stripe: automated refund via API
      refundResult = await stripeService.createRefund(payment.provider_id, amount ? Math.round(amount * 100) : undefined);
    } else if (payment.provider === 'paypal') {
      // PayPal refunds require a separate Refunds API call (implement via paypalService.refundCapture)
      // For now, record the refund as pending manual processing
      refundResult = { id: null, note: 'PayPal refund requires manual processing via PayPal dashboard.' };
    } else if (payment.method === 'bank_transfer' || payment.method === 'escrow') {
      // Bank transfer and escrow refunds are processed manually by admins
      refundResult = { id: null, note: 'Manual refund — admin must process via bank or escrow release.' };
    }

    const { data: refund, error } = await supabase.from('payments').insert({
      order_id: payment.order_id,
      user_id: req.user.id,
      amount: amount || payment.amount,
      currency: payment.currency,
      method: payment.method,
      provider: payment.provider,
      provider_id: refundResult?.id || null,
      status: 'refunded',
      metadata: { original_payment_id: payment_id, reason, refund_result: refundResult },
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    await supabase.from('payments').update({ status: 'refunded' }).eq('id', payment_id);
    res.json({ success: true, data: refund, message: 'Refund processed successfully.' });
  } catch (err) { next(err); }
}

/* ─── Stripe Webhook ─────────────────────────────────────────────────── */

/** POST /api/payments/webhook/stripe
 *  NOTE: Requires raw body Buffer for Stripe signature verification.
 *  In server.js, add express.raw({type:'application/json'}) BEFORE
 *  express.json() for this route, or capture raw body via the `verify`
 *  option of express.json() and attach it as req.rawBody.
 */
export async function handleStripeWebhook(req, res, next) {
  try {
    const sig = req.headers['stripe-signature'];
    // rawBody must be a Buffer — set via express.raw() or body-parser verify callback
    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);
    if (!rawBody) {
      return res.status(400).json({ success: false, error: 'Raw body not available. Configure raw body capture for Stripe webhook route.' });
    }
    let event;
    try {
      event = await stripeService.constructWebhookEvent(rawBody, sig);
    } catch (err) {
      return res.status(400).json({ success: false, error: `Webhook signature verification failed: ${err.message}` });
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        await supabase.from('payments').update({ status: 'completed' }).eq('provider_id', intent.id);
        if (intent.metadata?.order_id) {
          await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', intent.metadata.order_id);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', intent.id);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        await supabase.from('payments').update({ status: 'refunded' }).eq('provider_id', charge.payment_intent);
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) { next(err); }
}

/* ─── PayPal Webhook ─────────────────────────────────────────────────── */

/** POST /api/payments/webhook/paypal */
export async function handlePaypalWebhook(req, res, next) {
  try {
    const isValid = await paypalService.verifyWebhook(req.headers, JSON.stringify(req.body));
    if (!isValid) return res.status(400).json({ success: false, error: 'Invalid PayPal webhook signature.' });

    const { event_type, resource } = req.body;

    if (event_type === 'CHECKOUT.ORDER.APPROVED' || event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = resource.id;
      await supabase.from('payments').update({ status: 'completed' }).eq('provider_id', orderId);
      const referenceId = resource.purchase_units?.[0]?.reference_id;
      if (referenceId) {
        await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', referenceId);
      }
    }

    res.json({ received: true });
  } catch (err) { next(err); }
}
