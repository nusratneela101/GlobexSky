/**
 * Globex Sky — paymentGateways/paypal.js
 * PayPal Smart Payment Button routes.
 *
 * Mounted at: /api/v1/payments/paypal  (or configured in server.js)
 */

import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import * as paypalService from '../../services/payment/paypal.service.js';
import supabase from '../../config/supabase.js';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ─── Create Order ────────────────────────────────────────────────────── */
router.post(
  '/create',
  authenticate,
  [
    body('order_id').isUUID(),
    body('currency').optional().isLength({ min: 3, max: 3 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { order_id, currency = 'USD' } = req.body;

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('id, total')
        .eq('id', order_id)
        .single();
      if (oErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });

      const ppOrder = await paypalService.createOrder({
        amount: order.total,
        currency,
        referenceId: order_id,
      });

      // Idempotent insert
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('provider_id', ppOrder.id)
        .single();

      if (!existing) {
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
      }

      const approveLink = ppOrder.links?.find(l => l.rel === 'approve')?.href;
      res.json({ success: true, data: { paypal_order_id: ppOrder.id, approve_url: approveLink } });
    } catch (err) { next(err); }
  }
);

/* ─── Capture Order ───────────────────────────────────────────────────── */
router.post(
  '/capture',
  authenticate,
  [body('paypal_order_id').notEmpty()],
  validate,
  async (req, res, next) => {
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
);

/* ─── Get Order Details ───────────────────────────────────────────────── */
router.get('/order/:paypalOrderId', authenticate, async (req, res, next) => {
  try {
    const order = await paypalService.getOrder(req.params.paypalOrderId);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

/* ─── Refund Capture ──────────────────────────────────────────────────── */
router.post(
  '/refund',
  authenticate,
  [
    body('payment_id').isUUID(),
    body('reason').notEmpty(),
    body('amount').optional().isNumeric(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { payment_id, amount, reason } = req.body;

      const { data: payment } = await supabase.from('payments').select('*').eq('id', payment_id).single();
      if (!payment) return res.status(404).json({ success: false, error: 'Payment not found.' });
      if (payment.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Unauthorized.' });
      if (payment.provider !== 'paypal') return res.status(400).json({ success: false, error: 'Not a PayPal payment.' });

      // Get capture ID from PayPal order
      const ppOrder = await paypalService.getOrder(payment.provider_id);
      const captureId = ppOrder.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      if (!captureId) return res.status(400).json({ success: false, error: 'No PayPal capture found for this payment.' });

      const refund = await paypalService.refundCapture(
        captureId,
        amount ? parseFloat(amount).toFixed(2) : undefined,
        payment.currency,
        reason
      );

      await supabase.from('payments').update({ status: 'refunded' }).eq('id', payment_id);
      res.json({ success: true, data: refund, message: 'PayPal refund processed successfully.' });
    } catch (err) { next(err); }
  }
);

/* ─── Payout to Supplier ──────────────────────────────────────────────── */
router.post(
  '/payout',
  authenticate,
  [
    body('recipient_email').isEmail(),
    body('amount').isNumeric(),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('note').optional().isString(),
    body('order_id').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { recipient_email, amount, currency = 'USD', note, order_id } = req.body;

      const batchId = `payout_${Date.now()}`;
      const payout = await paypalService.createPayout(
        [{ receiverEmail: recipient_email, amount: parseFloat(amount).toFixed(2), currency, note: note || 'Supplier payout from Globex Sky', senderItemId: order_id || batchId }],
        batchId
      );

      // Record payout
      await supabase.from('payouts').insert({
        user_id: req.user.id,
        order_id: order_id || null,
        provider: 'paypal',
        provider_id: payout.batch_header?.payout_batch_id || null,
        amount,
        currency,
        status: 'pending',
        metadata: payout,
      });

      res.json({ success: true, data: payout });
    } catch (err) { next(err); }
  }
);

/* ─── Webhook ─────────────────────────────────────────────────────────── */
router.post('/webhook', webhookLimiter, async (req, res, next) => {
  try {
    const isValid = await paypalService.verifyWebhook(req.headers, JSON.stringify(req.body));
    if (!isValid) return res.status(400).json({ success: false, error: 'Invalid PayPal webhook signature.' });

    const { event_type, resource } = req.body;

    switch (event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const orderId = resource.id;
        await supabase.from('payments').update({ status: 'completed' }).eq('provider_id', orderId);
        const referenceId = resource.purchase_units?.[0]?.reference_id;
        if (referenceId) {
          await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', referenceId);
        }
        break;
      }
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REVERSED': {
        const orderId = resource.id;
        await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', orderId);
        break;
      }
      case 'CUSTOMER.DISPUTE.CREATED': {
        await supabase.from('payment_disputes').insert({
          provider: 'paypal',
          provider_dispute_id: resource.dispute_id,
          amount: parseFloat(resource.dispute_amount?.value || 0),
          currency: resource.dispute_amount?.currency_code || 'USD',
          reason: resource.reason,
          status: resource.status,
          created_at: new Date().toISOString(),
        });
        break;
      }
      case 'CUSTOMER.DISPUTE.RESOLVED': {
        await supabase.from('payment_disputes')
          .update({ status: 'resolved' })
          .eq('provider_dispute_id', resource.dispute_id);
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) { next(err); }
});

export default router;
