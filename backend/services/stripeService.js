/**
 * Globex Sky — stripeService.js
 * Stripe payment integration service.
 * Uses stripe npm package (install: npm install stripe).
 * Configure STRIPE_SECRET_KEY in environment variables.
 */

let stripe = null;

/**
 * Get or lazily initialize the Stripe client.
 * @returns {Promise<import('stripe').Stripe>}
 */
async function getStripe() {
  if (stripe) return stripe;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
  }
  const { default: Stripe } = await import('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  return stripe;
}

/**
 * Create a Stripe PaymentIntent.
 * @param {number} amount - Amount in smallest currency unit (e.g. cents)
 * @param {string} currency - ISO currency code (default: 'usd')
 * @param {object} metadata - Optional metadata
 * @returns {object} PaymentIntent object
 */
export async function createPaymentIntent({ amount, currency = 'usd', metadata = {} }) {
  const s = await getStripe();
  const intent = await s.paymentIntents.create({
    amount: Math.round(amount),
    currency: currency.toLowerCase(),
    metadata,
    automatic_payment_methods: { enabled: true },
  });
  return intent;
}

/**
 * Confirm a Stripe PaymentIntent (server-side confirmation).
 * @param {string} paymentIntentId
 * @param {string} paymentMethodId
 * @returns {object} Confirmed PaymentIntent
 */
export async function confirmPaymentIntent(paymentIntentId, paymentMethodId) {
  const s = await getStripe();
  return s.paymentIntents.confirm(paymentIntentId, { payment_method: paymentMethodId });
}

/**
 * Retrieve a PaymentIntent by ID.
 * @param {string} paymentIntentId
 */
export async function retrievePaymentIntent(paymentIntentId) {
  const s = await getStripe();
  return s.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Issue a full or partial refund for a PaymentIntent.
 * @param {string} paymentIntentId
 * @param {number|undefined} amount - Amount in smallest unit; omit for full refund
 * @returns {object} Refund object
 */
export async function createRefund(paymentIntentId, amount) {
  const s = await getStripe();
  const params = { payment_intent: paymentIntentId };
  if (amount) params.amount = Math.round(amount);
  return s.refunds.create(params);
}

/**
 * Construct and verify a Stripe webhook event.
 * @param {Buffer} rawBody
 * @param {string} signature - Value of Stripe-Signature header
 * @returns {object} Verified Stripe event
 */
export async function constructWebhookEvent(rawBody, signature) {
  const s = await getStripe();
  return s.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
