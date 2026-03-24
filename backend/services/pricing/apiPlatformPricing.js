import supabase from '../../config/supabase.js';

/**
 * API tier definitions.
 */
const API_TIERS = {
  free: {
    name: 'Free',
    price_monthly: 0,
    requests_per_day: 100,
    commission_rate: 0.05,  // 5 % on sales
    overage_per_1k: 0,      // no overage — hard-blocked
  },
  basic: {
    name: 'Basic',
    price_monthly: 49,
    requests_per_day: 5000,
    commission_rate: 0.04,
    overage_per_1k: 5.00,   // $5 per 1 000 extra requests
  },
  pro: {
    name: 'Pro',
    price_monthly: 199,
    requests_per_day: 50000,
    commission_rate: 0.03,
    overage_per_1k: 3.00,
  },
  enterprise: {
    name: 'Enterprise',
    price_monthly: 499,
    requests_per_day: Infinity,
    commission_rate: 0.02,
    overage_per_1k: 0,      // unlimited — no overage
  },
};

/**
 * Retrieve the tier for a given API key.
 * @param {string} apiKey
 * @returns {Promise<{ tier: string, plan: object }>}
 */
async function getApiKeyTier(apiKey) {
  const { data } = await supabase
    .from('api_keys')
    .select('tier')
    .eq('key', apiKey)
    .eq('is_active', true)
    .single();

  const tierKey = (data?.tier || 'free').toLowerCase();
  return { tier: tierKey, plan: API_TIERS[tierKey] || API_TIERS.free };
}

/**
 * Get current day's request count for an API key.
 * @param {string} apiKey
 * @returns {Promise<number>}
 */
async function getDailyRequestCount(apiKey) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data } = await supabase
    .from('api_usage')
    .select('request_count')
    .eq('api_key', apiKey)
    .eq('date', today)
    .single();

  return data?.request_count || 0;
}

/**
 * Check whether an API key is within its daily rate limit.
 * @param {string} apiKey
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: string, tier: string }>}
 */
export async function checkRateLimit(apiKey) {
  const { tier, plan } = await getApiKeyTier(apiKey);
  const used = await getDailyRequestCount(apiKey);

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const limit = plan.requests_per_day;
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);
  const allowed = limit === Infinity || used < limit;

  return {
    allowed,
    used,
    limit: limit === Infinity ? null : limit,
    remaining: remaining === Infinity ? null : remaining,
    resetAt: tomorrow.toISOString(),
    tier,
  };
}

/**
 * Calculate overage charge for requests exceeding the daily plan limit.
 * @param {string} apiKey
 * @param {number} requestCount  total requests made today (may exceed plan limit)
 * @returns {Promise<{ apiKey: string, tier: string, planLimit: number, requestCount: number, overageRequests: number, overageCharge: number }>}
 */
export async function calculateOverageCharge(apiKey, requestCount) {
  const { tier, plan } = await getApiKeyTier(apiKey);

  if (plan.requests_per_day === Infinity || plan.overage_per_1k === 0) {
    return { apiKey, tier, planLimit: null, requestCount, overageRequests: 0, overageCharge: 0 };
  }

  const overageRequests = Math.max(0, requestCount - plan.requests_per_day);
  const overageCharge = +((overageRequests / 1000) * plan.overage_per_1k).toFixed(4);

  return { apiKey, tier, planLimit: plan.requests_per_day, requestCount, overageRequests, overageCharge };
}

/**
 * Calculate the commission on a sale made through the API.
 * @param {number} saleAmount
 * @param {string} tier  API tier key ('free' | 'basic' | 'pro' | 'enterprise')
 * @returns {{ saleAmount: number, tier: string, commissionRate: number, commissionAmount: number }}
 */
export function calculateApiCommission(saleAmount, tier) {
  const plan = API_TIERS[(tier || 'free').toLowerCase()] || API_TIERS.free;
  const commissionAmount = +(saleAmount * plan.commission_rate).toFixed(2);
  return { saleAmount, tier: plan.name, commissionRate: plan.commission_rate, commissionAmount };
}

/**
 * Get aggregated usage statistics for an API key over a period.
 * @param {string} apiKey
 * @param {'day'|'week'|'month'} period
 * @returns {Promise<{ apiKey: string, period: string, totalRequests: number, totalCost: number, days: object[] }>}
 */
export async function getUsageStats(apiKey, period = 'month') {
  const since = new Date();
  if (period === 'day') {
    since.setUTCDate(since.getUTCDate() - 1);
  } else if (period === 'week') {
    since.setUTCDate(since.getUTCDate() - 7);
  } else {
    since.setUTCDate(since.getUTCDate() - 30);
  }

  const { data: rows } = await supabase
    .from('api_usage')
    .select('date, request_count, overage_charge')
    .eq('api_key', apiKey)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true });

  const days = rows || [];
  const totalRequests = days.reduce((s, r) => s + (r.request_count || 0), 0);
  const totalCost = +days.reduce((s, r) => s + (r.overage_charge || 0), 0).toFixed(2);

  return { apiKey, period, totalRequests, totalCost, days };
}

/**
 * Return all tier definitions.
 * @returns {object}
 */
export function getApiTiers() {
  return API_TIERS;
}
