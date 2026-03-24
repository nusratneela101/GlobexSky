import supabase from '../../config/supabase.js';

/**
 * Featured listing rates (USD).
 */
const FEATURED_LISTING_RATES = {
  daily:   5.00,
  weekly:  30.00,
  monthly: 100.00,
};

/**
 * Banner ad rates by position (USD per week).
 */
const BANNER_AD_RATES = {
  homepage_hero:   2000,
  sidebar:          500,
  category_page:    800,
  search_results:   600,
};

/**
 * CPC (Cost Per Click) constraints.
 */
const CPC_MIN_BID = 0.10;

/**
 * Email marketing cost per recipient (USD).
 */
const EMAIL_COST_PER_RECIPIENT = 0.05;

/**
 * Livestream sponsorship tiers based on expected viewer count.
 */
const LIVESTREAM_TIERS = [
  { minViewers: 0,      maxViewers: 500,   price: 500 },
  { minViewers: 500,    maxViewers: 2000,  price: 1500 },
  { minViewers: 2000,   maxViewers: 5000,  price: 3000 },
  { minViewers: 5000,   maxViewers: Infinity, price: 5000 },
];

/**
 * Package deal discount when buying 3+ ad types.
 */
const PACKAGE_DISCOUNT_THRESHOLD = 3;
const PACKAGE_DISCOUNT_RATE = 0.10; // 10 %

/**
 * Calculate the cost of a specific ad type and configuration.
 * @param {'featured_listing'|'banner'|'cpc'|'email'|'livestream'} adType
 * @param {number|string} duration  days/weeks/months or impressions as applicable
 * @param {object} [options]
 *   - position      (banner)    one of the BANNER_AD_RATES keys
 *   - durationUnit  (banner)    'daily'|'weekly' — default weekly
 *   - recipientCount (email)
 *   - expectedViewers (livestream)
 *   - maxBid        (cpc)
 *   - dailyBudget   (cpc)
 * @returns {{ adType: string, duration: number|string, unitCost: number, total: number, details: object }}
 */
export function calculateAdCost(adType, duration, options = {}) {
  switch (adType) {
    case 'featured_listing': {
      const unit = String(duration).toLowerCase();
      const unitCost = FEATURED_LISTING_RATES[unit] ?? FEATURED_LISTING_RATES.daily;
      return { adType, duration: unit, unitCost, total: unitCost, details: {} };
    }

    case 'banner': {
      const position = (options.position || 'sidebar').toLowerCase();
      const weeklyRate = BANNER_AD_RATES[position] ?? BANNER_AD_RATES.sidebar;
      const weeks = typeof duration === 'number' ? duration : 1;
      const total = +(weeklyRate * weeks).toFixed(2);
      return { adType, duration: weeks, unitCost: weeklyRate, total, details: { position, weeklyRate } };
    }

    case 'cpc': {
      const bid = Math.max(options.maxBid ?? CPC_MIN_BID, CPC_MIN_BID);
      const dailyBudget = options.dailyBudget ?? bid * 10;
      const days = typeof duration === 'number' ? duration : 1;
      const total = +(dailyBudget * days).toFixed(2);
      return { adType, duration: days, unitCost: dailyBudget, total, details: { bidPerClick: bid, dailyBudget } };
    }

    case 'email': {
      const recipients = options.recipientCount ?? (typeof duration === 'number' ? duration : 1);
      const total = +(recipients * EMAIL_COST_PER_RECIPIENT).toFixed(2);
      return { adType, duration: recipients, unitCost: EMAIL_COST_PER_RECIPIENT, total, details: { recipients } };
    }

    case 'livestream': {
      const viewers = options.expectedViewers ?? 0;
      const tier = LIVESTREAM_TIERS.find(t => viewers >= t.minViewers && viewers < t.maxViewers)
        || LIVESTREAM_TIERS[LIVESTREAM_TIERS.length - 1];
      return { adType, duration: 1, unitCost: tier.price, total: tier.price, details: { expectedViewers: viewers } };
    }

    default:
      throw new Error(`Unknown ad type: ${adType}`);
  }
}

/**
 * Place or update a CPC bid for an ad slot.
 * @param {string} adSlot
 * @param {number} maxBid       maximum per-click bid (USD)
 * @param {number} dailyBudget  maximum daily spend (USD)
 * @returns {Promise<object>}
 */
export async function placeBid(adSlot, maxBid, dailyBudget) {
  const bid = Math.max(maxBid, CPC_MIN_BID);

  const { data, error } = await supabase
    .from('ad_bids')
    .upsert(
      { ad_slot: adSlot, max_bid: bid, daily_budget: dailyBudget, is_active: true, updated_at: new Date().toISOString() },
      { onConflict: 'ad_slot' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Get performance metrics for an ad.
 * @param {string} adId
 * @returns {Promise<{ adId: string, impressions: number, clicks: number, ctr: number, conversions: number, cost: number }>}
 */
export async function getAdPerformance(adId) {
  const { data, error } = await supabase
    .from('ad_performance')
    .select('impressions, clicks, conversions, cost')
    .eq('ad_id', adId)
    .single();

  if (error || !data) {
    return { adId, impressions: 0, clicks: 0, ctr: 0, conversions: 0, cost: 0 };
  }

  const { impressions, clicks, conversions, cost } = data;
  const ctr = impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0;

  return { adId, impressions, clicks, ctr, conversions, cost };
}

/**
 * Create a package deal for multiple ad types (10 % discount when 3+ types).
 * @param {Array<{ adType: string, duration: number|string, options?: object }>} adTypes
 * @returns {{ adTypes: string[], lineItems: object[], subtotal: number, discount: number, totalCost: number }}
 */
export function createPackageDeal(adTypes) {
  const lineItems = adTypes.map(({ adType, duration, options }) =>
    calculateAdCost(adType, duration, options || {})
  );

  const subtotal = +lineItems.reduce((s, item) => s + item.total, 0).toFixed(2);

  const discountRate = adTypes.length >= PACKAGE_DISCOUNT_THRESHOLD ? PACKAGE_DISCOUNT_RATE : 0;
  const discount = +(subtotal * discountRate).toFixed(2);
  const totalCost = +(subtotal - discount).toFixed(2);

  return {
    adTypes: adTypes.map(a => a.adType),
    lineItems,
    subtotal,
    discountRate,
    discount,
    totalCost,
  };
}
