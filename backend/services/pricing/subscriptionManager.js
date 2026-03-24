import supabase from '../../config/supabase.js';

/**
 * Subscription plan definitions.
 */
const PLANS = {
  free: {
    name: 'Free',
    price_monthly: 0,
    price_annually: 0,
    max_products: 10,
    analytics_level: 'basic',
    ai_marketing_budget: 0,
    support_level: 'community',
    trial_days: 0,
  },
  basic: {
    name: 'Basic',
    price_monthly: 99,
    price_annually: 990,
    max_products: 500,
    analytics_level: 'standard',
    ai_marketing_budget: 200,
    support_level: 'email',
    trial_days: 14,
  },
  professional: {
    name: 'Professional',
    price_monthly: 299,
    price_annually: 2990,
    max_products: 5000,
    analytics_level: 'advanced',
    ai_marketing_budget: 1000,
    support_level: 'priority',
    trial_days: 14,
  },
  enterprise: {
    name: 'Enterprise',
    price_monthly: 999,
    price_annually: 9990,
    max_products: Infinity,
    analytics_level: 'enterprise',
    ai_marketing_budget: 5000,
    support_level: 'dedicated',
    trial_days: 14,
  },
};

/**
 * Create a new subscription for a supplier.
 * @param {string} supplierId
 * @param {string} planName  'free' | 'basic' | 'professional' | 'enterprise'
 * @param {'monthly'|'annually'} billingCycle
 * @returns {Promise<object>}
 */
export async function createSubscription(supplierId, planName, billingCycle = 'monthly') {
  const plan = PLANS[planName.toLowerCase()];
  if (!plan) throw new Error(`Unknown plan: ${planName}`);

  const now = new Date();
  const trialEndsAt = plan.trial_days > 0
    ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000)
    : null;
  const price = billingCycle === 'annually' ? plan.price_annually : plan.price_monthly;

  const record = {
    supplier_id: supplierId,
    plan: planName.toLowerCase(),
    billing_cycle: billingCycle,
    price,
    status: plan.trial_days > 0 ? 'trial' : 'active',
    trial_ends_at: trialEndsAt ? trialEndsAt.toISOString() : null,
    current_period_start: now.toISOString(),
    current_period_end: new Date(
      billingCycle === 'annually'
        ? now.getTime() + 365 * 24 * 60 * 60 * 1000
        : now.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString(),
    created_at: now.toISOString(),
  };

  const { data, error } = await supabase
    .from('supplier_subscriptions')
    .upsert(record, { onConflict: 'supplier_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Upgrade a supplier to a new plan.
 * @param {string} supplierId
 * @param {string} newPlan
 * @returns {Promise<object>}
 */
export async function upgradeSubscription(supplierId, newPlan) {
  const plan = PLANS[newPlan.toLowerCase()];
  if (!plan) throw new Error(`Unknown plan: ${newPlan}`);

  const { data: existing } = await supabase
    .from('supplier_subscriptions')
    .select('*')
    .eq('supplier_id', supplierId)
    .single();

  const billingCycle = existing?.billing_cycle || 'monthly';
  const price = billingCycle === 'annually' ? plan.price_annually : plan.price_monthly;

  const { data, error } = await supabase
    .from('supplier_subscriptions')
    .update({ plan: newPlan.toLowerCase(), price, status: 'active', updated_at: new Date().toISOString() })
    .eq('supplier_id', supplierId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Cancel a supplier subscription (sets status to cancelled).
 * @param {string} supplierId
 * @returns {Promise<object>}
 */
export async function cancelSubscription(supplierId) {
  const { data, error } = await supabase
    .from('supplier_subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('supplier_id', supplierId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Check whether a supplier's plan allows a specific feature/limit.
 * @param {string} supplierId
 * @param {'max_products'|'analytics_level'|'ai_marketing_budget'|'support_level'} feature
 * @returns {Promise<{ allowed: boolean, limit: any, current: any }>}
 */
export async function checkPlanLimits(supplierId, feature) {
  const { data: sub } = await supabase
    .from('supplier_subscriptions')
    .select('plan, status')
    .eq('supplier_id', supplierId)
    .single();

  const planKey = sub?.plan || 'free';
  const plan = PLANS[planKey] || PLANS.free;
  const limit = plan[feature];

  if (feature === 'max_products') {
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId);

    return { allowed: limit === Infinity || (count || 0) < limit, limit, current: count || 0 };
  }

  return { allowed: true, limit, current: null };
}

/**
 * Get trial status for a supplier.
 * @param {string} supplierId
 * @returns {Promise<{ onTrial: boolean, trialEndsAt: string|null, daysRemaining: number }>}
 */
export async function getTrialStatus(supplierId) {
  const { data: sub } = await supabase
    .from('supplier_subscriptions')
    .select('status, trial_ends_at')
    .eq('supplier_id', supplierId)
    .single();

  if (!sub || sub.status !== 'trial') {
    return { onTrial: false, trialEndsAt: null, daysRemaining: 0 };
  }

  const trialEndsAt = sub.trial_ends_at;
  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return { onTrial: true, trialEndsAt, daysRemaining };
}

/**
 * Retrieve all available plan definitions.
 * @returns {object}
 */
export function getPlans() {
  return PLANS;
}
