import supabase from '../../config/supabase.js';

/**
 * Category-based commission rates (defaults used when DB has no entry).
 */
const DEFAULT_CATEGORY_RATES = {
  electronics: 0.06,
  fashion: 0.08,
  home: 0.07,
  beauty: 0.09,
  sports: 0.07,
  default: 0.08,
};

/**
 * Tiered commission rates by order value.
 */
const VALUE_TIERS = [
  { min: 0, max: 1000, rate: 0.08, label: 'tier_1' },
  { min: 1000, max: 5000, rate: 0.06, label: 'tier_2' },
  { min: 5000, max: Infinity, rate: 0.04, label: 'tier_3' },
];

/**
 * Resolve the tier for a given order value.
 * @param {number} orderValue
 * @returns {{ rate: number, tier: string }}
 */
function resolveValueTier(orderValue) {
  const tier = VALUE_TIERS.find(t => orderValue >= t.min && orderValue < t.max) || VALUE_TIERS[VALUE_TIERS.length - 1];
  return { rate: tier.rate, tier: tier.label };
}

/**
 * Calculate commission for an order.
 * @param {string} orderId
 * @param {string|null} categoryId
 * @param {number} orderValue
 * @returns {Promise<{ orderId: string, categoryId: string|null, orderValue: number, rate: number, amount: number, tier: string, minCap: number, maxCap: number }>}
 */
export async function calculateCommission(orderId, categoryId, orderValue) {
  const rules = categoryId ? await getCommissionRules(categoryId) : [];

  let rate;
  let tier;
  let minCap = 0;
  let maxCap = Infinity;

  if (rules.length > 0) {
    const rule = rules.find(r => orderValue >= (r.min_order_value ?? 0) && orderValue < (r.max_order_value ?? Infinity))
      || rules[0];
    rate = (rule.rate_percent ?? 8) / 100;
    tier = 'category_rule';
    minCap = rule.min_cap ?? 0;
    maxCap = rule.max_cap ?? Infinity;
  } else {
    const resolved = resolveValueTier(orderValue);
    rate = resolved.rate;
    tier = resolved.tier;

    const categoryKey = (categoryId || 'default').toLowerCase();
    if (!rules.length && DEFAULT_CATEGORY_RATES[categoryKey]) {
      rate = DEFAULT_CATEGORY_RATES[categoryKey];
      tier = 'category_default';
    }
  }

  let amount = orderValue * rate;
  amount = Math.max(amount, minCap);
  if (maxCap !== Infinity) amount = Math.min(amount, maxCap);

  return {
    orderId,
    categoryId,
    orderValue,
    rate,
    amount: +amount.toFixed(2),
    tier,
    minCap,
    maxCap,
  };
}

/**
 * Get commission rules for a category from the database.
 * @param {string} categoryId
 * @returns {Promise<object[]>}
 */
export async function getCommissionRules(categoryId) {
  const { data, error } = await supabase
    .from('commissions')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('min_order_value', { ascending: true });

  if (error) return [];
  return data || [];
}

/**
 * Apply a bulk volume discount for a supplier based on monthly volume.
 * Discount tiers: <$10k → 0%, $10k-$50k → 5%, $50k-$100k → 10%, $100k+ → 15%
 * @param {string} supplierId
 * @param {number} monthlyVolume  total order value processed in the month
 * @returns {Promise<{ supplierId: string, monthlyVolume: number, discountRate: number }>}
 */
export async function applyBulkDiscount(supplierId, monthlyVolume) {
  let discountRate = 0;

  if (monthlyVolume >= 100000) {
    discountRate = 0.15;
  } else if (monthlyVolume >= 50000) {
    discountRate = 0.10;
  } else if (monthlyVolume >= 10000) {
    discountRate = 0.05;
  }

  return { supplierId, monthlyVolume, discountRate };
}
