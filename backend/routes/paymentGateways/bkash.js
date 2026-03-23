/**
 * Globex Sky — paymentGateways/bkash.js
 * bKash mobile payment routes (Bangladesh).
 *
 * Mounted at: /api/v1/payments/bkash  (or configured in server.js)
 *
 * Flow:
 *  1. POST /create        → Returns bKash checkout URL
 *  2. User completes payment on bKash UI
 *  3. GET  /callback      → Executes / completes the payment
 *  4. POST /refund        → Refund a completed payment
 *  5. GET  /query/:id     → Query payment status
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import * as bkash from '../../services/payment/bkash.service.js';
import supabase from '../../config/supabase.js';

const router = Router();

/* ─── Create bKash Payment ────────────────────────────────────────────── */
router.post(
  '/create',
  authenticate,
  [
    body('order_id').isUUID(),
    body('amount').isNumeric(),
    body('callback_url').optional().isURL(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { order_id, amount, callback_url } = req.body;

      // Validate order belongs to user
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('id, total, status')
        .eq('id', order_id)
        .single();
      if (oErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });

      const paymentAmount = parseFloat(amount) || parseFloat(order.total);

      const result = await bkash.createPayment({
        orderId: order_id,
        amount: paymentAmount,
        currency: 'BDT',
        callbackURL: callback_url,
        merchantInvoice: order_id,
      });

      // Persist pending payment record (idempotent)
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('provider_id', result.paymentID)
        .single();

      if (!existing) {
        await supabase.from('payments').insert({
          order_id,
          user_id: req.user.id,
          amount: paymentAmount,
          currency: 'BDT',
          method: 'mobile_banking',
          provider: 'bkash',
          provider_id: result.paymentID,
          status: 'pending',
          metadata: { bkash_payment_id: result.paymentID },
        });
      }

      res.json({
        success: true,
        data: {
          payment_id: result.paymentID,
          bkash_url: result.bkashURL,
        },
      });
    } catch (err) { next(err); }
  }
);

/* ─── bKash Callback (redirect after payment) ────────────────────────── */
router.get(
  '/callback',
  [
    query('paymentID').notEmpty(),
    query('status').notEmpty(),
    query('order_id').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { paymentID, status, order_id } = req.query;

      const result = await bkash.handleCallback({ paymentID, status, orderId: order_id });

      // Redirect to frontend result page
      const base = process.env.FRONTEND_URL || 'https://globexsky.com';
      if (result.success) {
        return res.redirect(`${base}/pages/payment/payment-success.html?order_id=${order_id || ''}&ref=${paymentID}&gateway=bkash`);
      }
      return res.redirect(`${base}/pages/payment/payment-failed.html?order_id=${order_id || ''}&ref=${paymentID}&gateway=bkash`);
    } catch (err) { next(err); }
  }
);

/* ─── Execute bKash Payment (direct API call) ────────────────────────── */
router.post(
  '/execute',
  authenticate,
  [body('payment_id').notEmpty(), body('order_id').optional().isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const { payment_id, order_id } = req.body;
      const result = await bkash.executePayment(payment_id);

      if (result.transactionStatus === 'Completed') {
        await supabase.from('payments').update({
          status: 'completed',
          metadata: { bkash_trx_id: result.trxID, bkash_payment_id: result.paymentID },
        }).eq('provider_id', payment_id);

        if (order_id) {
          await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', order_id);
        }
        return res.json({ success: true, data: result });
      }

      await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', payment_id);
      res.json({ success: false, error: 'Payment not completed.', data: result });
    } catch (err) { next(err); }
  }
);

/* ─── Query Payment Status ────────────────────────────────────────────── */
router.get(
  '/query/:paymentId',
  authenticate,
  [param('paymentId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const result = await bkash.queryPayment(req.params.paymentId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

/* ─── Refund ──────────────────────────────────────────────────────────── */
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
      if (payment.provider !== 'bkash') return res.status(400).json({ success: false, error: 'Not a bKash payment.' });
      if (payment.status !== 'completed') return res.status(400).json({ success: false, error: 'Only completed payments can be refunded.' });

      const trxID    = payment.metadata?.bkash_trx_id;
      const paymentID = payment.provider_id;
      if (!trxID) return res.status(400).json({ success: false, error: 'bKash transaction ID not found.' });

      const refundAmount = parseFloat(amount) || parseFloat(payment.amount);
      const result = await bkash.refundPayment({ paymentID, trxID, orderId: payment.order_id, amount: refundAmount, reason });

      await supabase.from('payments').update({ status: 'refunded' }).eq('id', payment_id);
      res.json({ success: true, data: result, message: 'bKash refund processed.' });
    } catch (err) { next(err); }
  }
);

/* ─── Create Agreement (tokenized recurring) ──────────────────────────── */
router.post(
  '/agreement/create',
  authenticate,
  [body('callback_url').optional().isURL()],
  validate,
  async (req, res, next) => {
    try {
      const { callback_url } = req.body;
      const result = await bkash.createAgreement({
        payerReference: req.user.id,
        callbackURL: callback_url,
      });
      res.json({ success: true, data: { bkash_url: result.bkashURL, payment_id: result.paymentID } });
    } catch (err) { next(err); }
  }
);

/* ─── Execute Agreement ───────────────────────────────────────────────── */
router.post(
  '/agreement/execute',
  authenticate,
  [body('payment_id').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const result = await bkash.executeAgreement(req.body.payment_id);
      if (result.agreementID) {
        await supabase.from('user_profiles').update({ bkash_agreement_id: result.agreementID }).eq('user_id', req.user.id);
      }
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

export default router;
