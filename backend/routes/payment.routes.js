import { Router } from 'express';
import express from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';

/**
 * @swagger
 * /api/v1/payments/stripe/intent:
 *   post:
 *     tags: [Payments]
 *     summary: Create a Stripe PaymentIntent
 *     description: Creates a Stripe PaymentIntent for a given amount. Returns client_secret for frontend confirmation.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, currency]
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Amount in smallest currency unit (e.g., cents for USD)
 *                 example: 5000
 *               currency:
 *                 type: string
 *                 example: usd
 *               orderId:
 *                 type: string
 *                 description: Associated order ID for metadata
 *     responses:
 *       200:
 *         description: PaymentIntent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 clientSecret: { type: string }
 *                 paymentIntentId: { type: string }
 *       400:
 *         description: Invalid amount or currency
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Stripe configuration error
 *
 * /api/v1/payments/bkash/init:
 *   post:
 *     tags: [Payments]
 *     summary: Initialize a bKash payment
 *     description: Creates a bKash payment session. Returns paymentURL for redirect.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, orderId]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 500
 *               orderId:
 *                 type: string
 *                 example: order-uuid-123
 *     responses:
 *       200:
 *         description: bKash payment initialized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 paymentURL: { type: string }
 *                 paymentID: { type: string }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */

import * as ctrl from '../controllers/payment.controller.js';

const router = Router();

// ─── Webhook / callback routes (no auth — verified by signature) ──────────────

// Stripe — raw body required for signature verification
router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  ctrl.stripeWebhook,
);

router.post(
  '/paypal/webhook',
  ctrl.paypalWebhook,
);

router.get('/bkash/callback',  ctrl.bkashCallback);
router.post('/bkash/callback', ctrl.bkashCallback);

router.get('/nagad/callback',  ctrl.nagadCallback);
router.post('/nagad/callback', ctrl.nagadCallback);

router.get('/paypal/success', ctrl.paypalSuccess);
router.get('/paypal/cancel',  ctrl.paypalCancel);

// ─── Authenticated routes ─────────────────────────────────────────────────────

router.use(authenticate);

// Initiate a payment — buyer auth required
router.post(
  '/initiate',
  [
    body('method').isIn(['stripe', 'bkash', 'nagad', 'paypal', 'cod']).withMessage('Invalid payment method.'),
    body('orderId').notEmpty().withMessage('orderId is required.'),
    body('amount').isFloat({ min: 0.01 }).withMessage('amount must be a positive number.'),
  ],
  validate,
  ctrl.initiatePayment,
);

// All payments for an order (must be before /:paymentId to avoid conflict)
router.get(
  '/order/:orderId',
  [param('orderId').isUUID()],
  validate,
  ctrl.getOrderPayments,
);

// Payment status — any authenticated user
router.get(
  '/:paymentId',
  [param('paymentId').isUUID()],
  validate,
  ctrl.getPaymentStatus,
);

// Refund — admin only
router.post(
  '/:paymentId/refund',
  requireAdmin,
  [
    param('paymentId').isUUID(),
    body('reason').notEmpty().withMessage('Reason is required.'),
  ],
  validate,
  ctrl.refundPayment,
);

// ─── Legacy endpoints ─────────────────────────────────────────────────────────

router.get('/transactions',        ctrl.listTransactions);
router.get('/transactions/:id',    [param('id').isUUID()], validate, ctrl.getTransaction);
router.post('/checkout',           [body('order_id').isUUID(), body('payment_method').notEmpty()], validate, ctrl.processPayment);
router.post('/refund',             [body('transaction_id').isUUID(), body('reason').notEmpty()], validate, ctrl.requestRefund);
router.get('/methods',             ctrl.getPaymentMethods);

export default router;
