/**
 * Globex Sky — payments.js (route)
 * Payment API routes: Stripe, PayPal, bKash, Nagad, Bank Transfer, Escrow, History, Refund, Webhooks.
 */

import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/paymentController.js';
import stripeGatewayRoutes from './paymentGateways/stripe.js';
import paypalGatewayRoutes from './paymentGateways/paypal.js';
import bkashGatewayRoutes from './paymentGateways/bkash.js';
import nagadGatewayRoutes from './paymentGateways/nagad.js';

const router = Router();

/** Dedicated rate limiter for webhook endpoints to prevent abuse */
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Webhook rate limit exceeded.' },
});

/* ─── Stripe ──────────────────────────────────────────────────────────── */
router.post(
  '/create-intent',
  authenticate,
  [body('order_id').isUUID(), body('currency').optional().isLength({ min: 3, max: 3 })],
  validate,
  ctrl.createPaymentIntent
);

router.post(
  '/confirm',
  authenticate,
  [body('payment_intent_id').notEmpty(), body('payment_method_id').notEmpty()],
  validate,
  ctrl.confirmPayment
);

/* ─── PayPal ─────────────────────────────────────────────────────────── */
router.post(
  '/paypal/create',
  authenticate,
  [body('order_id').isUUID()],
  validate,
  ctrl.createPaypalOrder
);

router.post(
  '/paypal/capture',
  authenticate,
  [body('paypal_order_id').notEmpty()],
  validate,
  ctrl.capturePaypalPayment
);

/* ─── Bank Transfer ──────────────────────────────────────────────────── */
router.post(
  '/bank-transfer',
  authenticate,
  [body('order_id').isUUID()],
  validate,
  ctrl.processBankTransfer
);

/* ─── Escrow ──────────────────────────────────────────────────────────── */
router.post(
  '/escrow/create',
  authenticate,
  [body('order_id').isUUID(), body('seller_id').isUUID()],
  validate,
  ctrl.createEscrow
);

router.post(
  '/escrow/release',
  authenticate,
  [body('escrow_id').isUUID()],
  validate,
  ctrl.releaseEscrow
);

/* ─── Payment History ────────────────────────────────────────────────── */
router.get('/history', authenticate, ctrl.getPaymentHistory);

/* ─── Refund ────────────────────────────────────────────────────────── */
router.post(
  '/refund',
  authenticate,
  [body('payment_id').isUUID(), body('reason').notEmpty()],
  validate,
  ctrl.processRefund
);

/* ─── Webhooks (no auth — verified by signature) ─────────────────────── */
router.post('/webhook/stripe', webhookRateLimiter, ctrl.handleStripeWebhook);
router.post('/webhook/paypal', webhookRateLimiter, ctrl.handlePaypalWebhook);

/* ─── Gateway Sub-Routers ────────────────────────────────────────────── */
// Full Stripe gateway (create intent, confirm, saved cards, subscriptions, refund, webhook)
router.use('/stripe', stripeGatewayRoutes);
// Full PayPal gateway (create order, capture, refund, payout, webhook)
router.use('/paypal/v2', paypalGatewayRoutes);
// bKash mobile payment (BD)
router.use('/bkash', bkashGatewayRoutes);
// Nagad mobile payment (BD)
router.use('/nagad', nagadGatewayRoutes);

export default router;
