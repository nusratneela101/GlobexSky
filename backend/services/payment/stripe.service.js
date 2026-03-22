/**
 * Globex Sky — stripe.service.js  (payment layer)
 * Full Stripe integration:
 *  - Create payment intent
 *  - Handle card payments
 *  - Handle 3D Secure authentication
 *  - Process refunds (full / partial)
 *  - Create customer profiles
 *  - Save payment methods
 *  - Subscription management (supplier Pro plans, API plans)
 *  - Webhook handling (payment_intent.succeeded, payment_intent.payment_failed, charge.refunded, charge.dispute.created)
 *  - Payout to suppliers via Stripe Connect
 *  - Invoice generation
 */

import supabase from '../../config/supabase.js';
import { stripeConfig } from '../../config/integrations.js';

// ─── Lazy Stripe client ───────────────────────────────────────────────────────

let _stripe = null;

async function getStripe() {
  if (_stripe) return _stripe;
  if (!stripeConfig.secretKey) throw new Error('STRIPE_SECRET_KEY is not set.');
  const { default: Stripe } = await import('stripe');
  _stripe = new Stripe(stripeConfig.secretKey, { apiVersion: stripeConfig.apiVersion });
  return _stripe;
}

// ─── Payment Intents ─────────────────────────────────────────────────────────

/**
 * Create a Stripe PaymentIntent.
 * @param {object} opts
 * @param {number}   opts.amount     - Amount in smallest currency unit (e.g. cents)
 * @param {string}   [opts.currency] - ISO currency code, default 'usd'
 * @param {string}   [opts.customerId] - Stripe customer ID
 * @param {string}   [opts.paymentMethodId] - Pre-attached payment method
 * @param {object}   [opts.metadata]
 * @param {boolean}  [opts.confirm]  - Confirm immediately (server-side)
 * @returns {import('stripe').Stripe.PaymentIntent}
 */
export async function createPaymentIntent({ amount, currency, customerId, paymentMethodId, metadata = {}, confirm = false }) {
  const s = await getStripe();
  const params = {
    amount: Math.round(amount),
    currency: (currency || stripeConfig.currency).toLowerCase(),
    metadata,
    automatic_payment_methods: paymentMethodId ? undefined : { enabled: true },
  };
  if (customerId) params.customer = customerId;
  if (paymentMethodId) {
    params.payment_method = paymentMethodId;
    if (confirm) params.confirm = true;
  }
  return s.paymentIntents.create(params);
}

/**
 * Confirm a PaymentIntent (server-side confirmation).
 */
export async function confirmPaymentIntent(paymentIntentId, paymentMethodId) {
  const s = await getStripe();
  return s.paymentIntents.confirm(paymentIntentId, { payment_method: paymentMethodId });
}

/**
 * Retrieve a PaymentIntent.
 */
export async function retrievePaymentIntent(paymentIntentId) {
  const s = await getStripe();
  return s.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Create a SetupIntent for saving a payment method without a charge.
 */
export async function createSetupIntent(customerId) {
  const s = await getStripe();
  return s.setupIntents.create({ customer: customerId, payment_method_types: ['card'] });
}

// ─── Refunds ─────────────────────────────────────────────────────────────────

/**
 * Issue a full or partial refund.
 * @param {string}       paymentIntentId
 * @param {number|null}  amount - In smallest unit; omit for full refund
 * @param {string}       [reason] - 'duplicate' | 'fraudulent' | 'requested_by_customer'
 */
export async function createRefund(paymentIntentId, amount, reason = 'requested_by_customer') {
  const s = await getStripe();
  const params = { payment_intent: paymentIntentId, reason };
  if (amount) params.amount = Math.round(amount);
  return s.refunds.create(params);
}

// ─── Customers ───────────────────────────────────────────────────────────────

/**
 * Create or retrieve a Stripe Customer for a platform user.
 * @param {object} opts
 * @param {string} opts.userId      - Platform user UUID
 * @param {string} opts.email
 * @param {string} [opts.name]
 * @param {object} [opts.metadata]
 */
export async function getOrCreateCustomer({ userId, email, name, metadata = {} }) {
  // Check if we already stored a Stripe customer ID
  const { data: existing } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (existing?.stripe_customer_id) {
    const s = await getStripe();
    return s.customers.retrieve(existing.stripe_customer_id);
  }

  const s = await getStripe();
  const customer = await s.customers.create({ email, name, metadata: { userId, ...metadata } });

  await supabase.from('stripe_customers').upsert(
    { user_id: userId, stripe_customer_id: customer.id },
    { onConflict: 'user_id' },
  );

  return customer;
}

/**
 * List saved payment methods for a customer.
 */
export async function listPaymentMethods(customerId, type = 'card') {
  const s = await getStripe();
  const pms = await s.paymentMethods.list({ customer: customerId, type });
  return pms.data;
}

/**
 * Detach (delete) a saved payment method.
 */
export async function detachPaymentMethod(paymentMethodId) {
  const s = await getStripe();
  return s.paymentMethods.detach(paymentMethodId);
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

/**
 * Create a Stripe subscription for a customer.
 * @param {object} opts
 * @param {string} opts.customerId
 * @param {string} opts.priceId    - Stripe Price ID
 * @param {string} [opts.couponId]
 * @param {object} [opts.metadata]
 */
export async function createSubscription({ customerId, priceId, couponId, metadata = {} }) {
  const s = await getStripe();
  const params = {
    customer: customerId,
    items: [{ price: priceId }],
    metadata,
    expand: ['latest_invoice.payment_intent'],
  };
  if (couponId) params.discounts = [{ coupon: couponId }];
  return s.subscriptions.create(params);
}

/**
 * Cancel a subscription at period end.
 */
export async function cancelSubscription(subscriptionId, immediately = false) {
  const s = await getStripe();
  if (immediately) return s.subscriptions.cancel(subscriptionId);
  return s.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

/**
 * Update the plan on an existing subscription.
 */
export async function updateSubscription(subscriptionId, newPriceId) {
  const s = await getStripe();
  const sub = await s.subscriptions.retrieve(subscriptionId);
  return s.subscriptions.update(subscriptionId, {
    items: [{ id: sub.items.data[0].id, price: newPriceId }],
    proration_behavior: 'create_prorations',
  });
}

// ─── Stripe Connect (Supplier Payouts) ───────────────────────────────────────

/**
 * Create a Stripe Connect account (Express) for a supplier.
 * @param {object} opts
 * @param {string} opts.supplierId - Platform supplier UUID
 * @param {string} opts.email
 * @param {string} [opts.country='US']
 */
export async function createConnectAccount({ supplierId, email, country = 'US' }) {
  const s = await getStripe();
  const account = await s.accounts.create({
    type: 'express',
    country,
    email,
    metadata: { supplierId },
    capabilities: { transfers: { requested: true } },
  });

  await supabase.from('stripe_connect_accounts').upsert(
    { supplier_id: supplierId, stripe_account_id: account.id, status: 'pending' },
    { onConflict: 'supplier_id' },
  );

  return account;
}

/**
 * Generate an account onboarding link for a Connect account.
 */
export async function createAccountLink(stripeAccountId, refreshUrl, returnUrl) {
  const s = await getStripe();
  return s.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

/**
 * Transfer funds to a supplier Connect account.
 * @param {object} opts
 * @param {number} opts.amount          - In smallest currency unit
 * @param {string} opts.currency
 * @param {string} opts.destinationAccountId - Stripe Connect account ID
 * @param {string} opts.transferGroup   - Group identifier (e.g. order ID)
 * @param {object} [opts.metadata]
 */
export async function transferToSupplier({ amount, currency, destinationAccountId, transferGroup, metadata = {} }) {
  const s = await getStripe();
  return s.transfers.create({
    amount: Math.round(amount),
    currency: currency.toLowerCase(),
    destination: destinationAccountId,
    transfer_group: transferGroup,
    metadata,
  });
}

// ─── Invoices ────────────────────────────────────────────────────────────────

/**
 * Create and finalise a Stripe invoice for a customer.
 * @param {object} opts
 * @param {string}   opts.customerId
 * @param {Array}    opts.lineItems   - [{ description, amount, currency, quantity }]
 * @param {boolean}  [opts.autoAdvance] - Auto-finalise the invoice
 */
export async function createInvoice({ customerId, lineItems, autoAdvance = true }) {
  const s = await getStripe();

  // Add invoice items
  for (const item of lineItems) {
    await s.invoiceItems.create({
      customer: customerId,
      amount: Math.round(item.amount),
      currency: (item.currency || stripeConfig.currency).toLowerCase(),
      description: item.description,
      quantity: item.quantity || 1,
    });
  }

  const invoice = await s.invoices.create({ customer: customerId, auto_advance: autoAdvance });
  if (autoAdvance) await s.invoices.finalizeInvoice(invoice.id);
  return s.invoices.retrieve(invoice.id);
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

/**
 * Construct and verify a Stripe webhook event from raw request body.
 * @param {Buffer} rawBody
 * @param {string} signature  - Value of Stripe-Signature header
 * @param {boolean} [connect] - True if this is a Connect webhook
 */
export async function constructWebhookEvent(rawBody, signature, connect = false) {
  const s = await getStripe();
  const secret = connect ? stripeConfig.connectWebhookSecret : stripeConfig.webhookSecret;
  return s.webhooks.constructEvent(rawBody, signature, secret);
}

/**
 * Handle a verified Stripe webhook event and update local records.
 * @param {import('stripe').Stripe.Event} event
 */
export async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      await supabase.from('payments').update({ status: 'completed', stripe_payment_intent_id: pi.id })
        .eq('stripe_payment_intent_id', pi.id);
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await supabase.from('payments').update({ status: 'failed' })
        .eq('stripe_payment_intent_id', pi.id);
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object;
      await supabase.from('payments').update({ status: 'refunded' })
        .eq('stripe_charge_id', charge.id);
      break;
    }
    case 'charge.dispute.created': {
      const dispute = event.data.object;
      await supabase.from('payment_disputes').insert({
        stripe_dispute_id: dispute.id,
        stripe_charge_id: dispute.charge,
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        created_at: new Date().toISOString(),
      });
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await supabase.from('subscriptions').update({
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
      }).eq('stripe_subscription_id', sub.id);
      break;
    }
    case 'account.updated': {
      const account = event.data.object;
      const status = account.charges_enabled ? 'active' : 'pending';
      await supabase.from('stripe_connect_accounts').update({ status })
        .eq('stripe_account_id', account.id);
      break;
    }
    default:
      break;
  }
}
