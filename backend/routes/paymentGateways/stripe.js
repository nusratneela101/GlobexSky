/**
 * Globex Sky — paymentGateways/stripe.js
 * Stripe-specific payment routes.
 *
 * Mounted at: /api/v1/payments/stripe  (or configured in server.js)
 */

import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import * as stripeService from '../../services/payment/stripe.service.js';
import supabase from '../../config/supabase.js';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ─── Create PaymentIntent ────────────────────────────────────────────── */
router.post(
  '/create-intent',
  authenticate,
  [
    body('order_id').isUUID(),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('payment_method_id').optional().isString(),
    body('save_card').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { order_id, currency = 'usd', payment_method_id, save_card } = req.body;

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('id, total, status')
        .eq('id', order_id)
        .single();
      if (oErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });

      // Resolve or create Stripe customer for saved cards
      let customerId;
      if (save_card || payment_method_id) {
        const customer = await stripeService.getOrCreateCustomer({
          userId: req.user.id,
          email: req.user.email,
        });
        customerId = customer.id;
      }

      const amountCents = Math.round(parseFloat(order.total) * 100);
      const intent = await stripeService.createPaymentIntent({
        amount: amountCents,
        currency,
        customerId,
        paymentMethodId: payment_method_id,
        metadata: { order_id, user_id: req.user.id },
      });

      // Persist payment record with idempotency via provider_id
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('provider_id', intent.id)
        .single();

      if (!existing) {
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
      }

      res.json({
        success: true,
        data: {
          client_secret: intent.client_secret,
          payment_intent_id: intent.id,
          publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || '',
        },
      });
    } catch (err) { next(err); }
  }
);

/* ─── Confirm PaymentIntent ───────────────────────────────────────────── */
router.post(
  '/confirm',
  authenticate,
  [body('payment_intent_id').notEmpty(), body('payment_method_id').notEmpty()],
  validate,
  async (req, res, next) => {
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
);

/* ─── List Saved Payment Methods ──────────────────────────────────────── */
router.get('/payment-methods', authenticate, async (req, res, next) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', req.user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.json({ success: true, data: [] });
    }

    const methods = await stripeService.listPaymentMethods(profile.stripe_customer_id);
    res.json({ success: true, data: methods.data || [] });
  } catch (err) { next(err); }
});

/* ─── Setup Intent (for saving cards) ────────────────────────────────── */
router.post('/setup-intent', authenticate, async (req, res, next) => {
  try {
    const customer = await stripeService.getOrCreateCustomer({ userId: req.user.id, email: req.user.email });
    const setupIntent = await stripeService.createSetupIntent(customer.id);
    res.json({ success: true, data: { client_secret: setupIntent.client_secret, customer_id: customer.id } });
  } catch (err) { next(err); }
});

/* ─── Detach Payment Method ───────────────────────────────────────────── */
router.delete(
  '/payment-methods/:methodId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await stripeService.detachPaymentMethod(req.params.methodId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

/* ─── Create Subscription ─────────────────────────────────────────────── */
router.post(
  '/subscriptions',
  authenticate,
  [
    body('plan').isIn(['basic_pro', 'professional_pro', 'enterprise_pro']),
    body('payment_method_id').notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const PLANS = {
        basic_pro:         { priceId: process.env.STRIPE_PRICE_BASIC_PRO         || '', amount: 29900 },
        professional_pro:  { priceId: process.env.STRIPE_PRICE_PROFESSIONAL_PRO  || '', amount: 59900 },
        enterprise_pro:    { priceId: process.env.STRIPE_PRICE_ENTERPRISE_PRO    || '', amount: 99900 },
      };

      const plan = PLANS[req.body.plan];
      if (!plan.priceId) {
        return res.status(400).json({ success: false, error: `Stripe price ID for plan '${req.body.plan}' is not configured.` });
      }

      // Get/create customer
      const customer = await stripeService.getOrCreateCustomer({ userId: req.user.id, email: req.user.email });
      const customerId = customer.id;

      const subscription = await stripeService.createSubscription({
        customerId,
        priceId: plan.priceId,
        metadata: { user_id: req.user.id, plan: req.body.plan },
      });

      // Persist subscription
      await supabase.from('subscriptions').insert({
        user_id: req.user.id,
        plan: req.body.plan,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      });

      res.json({ success: true, data: subscription });
    } catch (err) { next(err); }
  }
);

/* ─── Cancel Subscription ─────────────────────────────────────────────── */
router.delete('/subscriptions/:subscriptionId', authenticate, async (req, res, next) => {
  try {
    // Verify ownership
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('stripe_subscription_id', req.params.subscriptionId)
      .eq('user_id', req.user.id)
      .single();
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found.' });

    const cancelled = await stripeService.cancelSubscription(req.params.subscriptionId);
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('stripe_subscription_id', req.params.subscriptionId);
    res.json({ success: true, data: cancelled });
  } catch (err) { next(err); }
});

/* ─── Refund ──────────────────────────────────────────────────────────── */
router.post(
  '/refund',
  authenticate,
  [body('payment_id').isUUID(), body('reason').notEmpty(), body('amount').optional().isNumeric()],
  validate,
  async (req, res, next) => {
    try {
      const { payment_id, amount, reason } = req.body;

      const { data: payment } = await supabase.from('payments').select('*').eq('id', payment_id).single();
      if (!payment) return res.status(404).json({ success: false, error: 'Payment not found.' });
      if (payment.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Unauthorized.' });
      if (payment.provider !== 'stripe') return res.status(400).json({ success: false, error: 'Not a Stripe payment.' });

      const refundAmount = amount ? Math.round(parseFloat(amount) * 100) : undefined;
      const refund = await stripeService.createRefund(payment.provider_id, refundAmount);

      await supabase.from('payments').update({ status: 'refunded' }).eq('id', payment_id);
      res.json({ success: true, data: refund, message: 'Refund processed successfully.' });
    } catch (err) { next(err); }
  }
);

/* ─── Webhook ─────────────────────────────────────────────────────────── */
router.post('/webhook', webhookLimiter, async (req, res, next) => {
  try {
    const sig     = req.headers['stripe-signature'];
    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);
    if (!rawBody) {
      return res.status(400).json({ success: false, error: 'Raw body not available for Stripe webhook verification.' });
    }

    let event;
    try {
      event = await stripeService.constructWebhookEvent(rawBody, sig);
    } catch (err) {
      return res.status(400).json({ success: false, error: `Webhook signature failed: ${err.message}` });
    }

    await stripeService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) { next(err); }
});

export default router;
