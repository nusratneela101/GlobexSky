/**
 * Globex Sky — paymentGateways/nagad.js
 * Nagad payment gateway routes (Bangladesh).
 *
 * Mounted at: /api/v1/payments/nagad  (or configured in server.js)
 *
 * Flow:
 *  1. POST /initialize    → Returns Nagad checkout URL
 *  2. User completes payment on Nagad UI
 *  3. GET  /callback      → Completes the payment
 *  4. POST /refund        → Refund a completed payment
 *  5. GET  /status/:id    → Query payment status
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import * as nagad from '../../services/payment/nagad.service.js';
import supabase from '../../config/supabase.js';

const router = Router();

/* ─── Initialize Nagad Payment ───────────────────────────────────────── */
router.post(
  '/initialize',
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

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('id, total, status')
        .eq('id', order_id)
        .single();
      if (oErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });

      const paymentAmount = parseFloat(amount) || parseFloat(order.total);

      const result = await nagad.initializePayment({
        orderId: order_id,
        amount: paymentAmount,
        callbackURL: callback_url,
      });

      // The sensitiveData in the response is encrypted — we extract the callBackUrl
      // Nagad returns callBackUrl in top-level response after decryption
      const callbackUrl = result.callBackUrl;
      const paymentRefId = order_id; // Nagad uses orderId as reference

      // Persist pending payment
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('provider_id', paymentRefId)
        .eq('provider', 'nagad')
        .single();

      if (!existing) {
        await supabase.from('payments').insert({
          order_id,
          user_id: req.user.id,
          amount: paymentAmount,
          currency: 'BDT',
          method: 'mobile_banking',
          provider: 'nagad',
          provider_id: paymentRefId,
          status: 'pending',
          metadata: { nagad_order_id: order_id },
        });
      }

      res.json({
        success: true,
        data: {
          payment_ref_id: paymentRefId,
          nagad_url: callbackUrl,
        },
      });
    } catch (err) { next(err); }
  }
);

/* ─── Nagad Callback (redirect after payment) ────────────────────────── */
router.get(
  '/callback',
  [
    query('payment_ref_id').notEmpty(),
    query('status').notEmpty(),
    query('order_id').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { payment_ref_id, status, order_id } = req.query;

      const result = await nagad.handleCallback({ paymentRefId: payment_ref_id, orderId: order_id, status });

      const base = process.env.FRONTEND_URL || 'https://globexsky.com';
      if (result.success) {
        return res.redirect(`${base}/pages/payment/payment-success.html?order_id=${order_id || ''}&ref=${payment_ref_id}&gateway=nagad`);
      }
      return res.redirect(`${base}/pages/payment/payment-failed.html?order_id=${order_id || ''}&ref=${payment_ref_id}&gateway=nagad`);
    } catch (err) { next(err); }
  }
);

/* ─── Complete Nagad Payment (direct API) ────────────────────────────── */
router.post(
  '/complete',
  authenticate,
  [body('payment_ref_id').notEmpty(), body('order_id').optional().isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const { payment_ref_id, order_id } = req.body;
      const result = await nagad.completePayment(payment_ref_id);

      if (result.status === 'Success' || result.status === 'COMPLETED') {
        await supabase.from('payments').update({
          status: 'completed',
          metadata: {
            nagad_payment_ref_id: payment_ref_id,
            nagad_trx_id: result.issuerPaymentRefNo,
          },
        }).eq('provider_id', payment_ref_id).eq('provider', 'nagad');

        if (order_id) {
          await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', order_id);
        }
        return res.json({ success: true, data: result });
      }

      await supabase.from('payments').update({ status: 'failed' }).eq('provider_id', payment_ref_id).eq('provider', 'nagad');
      res.json({ success: false, error: 'Payment not completed.', data: result });
    } catch (err) { next(err); }
  }
);

/* ─── Query Payment Status ────────────────────────────────────────────── */
router.get(
  '/status/:paymentRefId',
  authenticate,
  [param('paymentRefId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const result = await nagad.queryPaymentStatus(req.params.paymentRefId);
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
      if (payment.provider !== 'nagad') return res.status(400).json({ success: false, error: 'Not a Nagad payment.' });
      if (payment.status !== 'completed') return res.status(400).json({ success: false, error: 'Only completed payments can be refunded.' });

      const refundAmount = parseFloat(amount) || parseFloat(payment.amount);
      const result = await nagad.refundPayment({
        paymentReferenceId: payment.provider_id,
        amount: refundAmount,
        reason,
      });

      await supabase.from('payments').update({ status: 'refunded' }).eq('id', payment_id);
      res.json({ success: true, data: result, message: 'Nagad refund processed.' });
    } catch (err) { next(err); }
  }
);

export default router;
