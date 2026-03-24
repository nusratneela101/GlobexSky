import supabase from '../../config/supabase.js';

/**
 * Default per-kg rates by product category (USD).
 */
const DEFAULT_RATES_PER_KG = {
  electronics: 3.50,
  fashion: 2.00,
  home: 2.50,
  beauty: 2.80,
  sports: 2.20,
  furniture: 1.80,
  default: 2.50,
};

/**
 * Bonus rate per kg for special handling requirements.
 */
const FRAGILE_BONUS_PER_KG = 1.50;
const OVERSIZED_BONUS_PER_KG = 2.00;

/**
 * Surge multiplier windows (month 0-indexed, day 1-indexed).
 * Covers major peak seasons.
 */
const SURGE_PERIODS = [
  { name: 'Singles Day',    month: 10, dayStart: 11, dayEnd: 11, multiplier: 1.40 },
  { name: 'Black Friday',   month: 10, dayStart: 25, dayEnd: 30, multiplier: 1.35 },
  { name: 'Cyber Monday',   month: 11, dayStart: 1,  dayEnd: 3,  multiplier: 1.30 },
  { name: 'Christmas Rush', month: 11, dayStart: 15, dayEnd: 24, multiplier: 1.25 },
  { name: 'New Year',       month: 11, dayStart: 28, dayEnd: 31, multiplier: 1.20 },
  { name: 'New Year',       month: 0,  dayStart: 1,  dayEnd: 5,  multiplier: 1.20 },
  { name: "Valentine's",    month: 1,  dayStart: 10, dayEnd: 14, multiplier: 1.10 },
];

/**
 * Platform fee tiers based on order value.
 */
const PLATFORM_FEE_TIERS = [
  { max: 500,     rate: 0.05 },
  { max: 2000,    rate: 0.04 },
  { max: 10000,   rate: 0.03 },
  { max: Infinity, rate: 0.02 },
];

/**
 * Bonus payment tiers for carriers by monthly deliveries.
 */
const CARRIER_BONUS_TIERS = [
  { min: 0,    max: 100,  bonusPerDelivery: 0 },
  { min: 100,  max: 500,  bonusPerDelivery: 0.50 },
  { min: 500,  max: 1000, bonusPerDelivery: 1.00 },
  { min: 1000, max: Infinity, bonusPerDelivery: 1.50 },
];

/**
 * Calculate the total payment for a carrier delivery.
 * @param {number} weight  kg
 * @param {string} category  product category
 * @param {boolean} isFragile
 * @param {Date|string} date  delivery date (used for surge check)
 * @returns {Promise<{ weight: number, category: string, baseRate: number, fragileBonus: number, surgeMultiplier: number, total: number }>}
 */
export async function calculateCarrierPayment(weight, category, isFragile, date) {
  const categoryKey = (category || 'default').toLowerCase();

  let ratePerKg = DEFAULT_RATES_PER_KG[categoryKey] ?? DEFAULT_RATES_PER_KG.default;

  const { data: dbRate } = await supabase
    .from('carrier_rates')
    .select('rate_per_kg')
    .eq('category', categoryKey)
    .eq('is_active', true)
    .maybeSingle();

  if (dbRate) ratePerKg = dbRate.rate_per_kg;

  const { multiplier: surgeMultiplier } = await getSurgeMultiplier(date);

  const baseAmount = weight * ratePerKg * surgeMultiplier;
  const fragileBonus = isFragile ? weight * FRAGILE_BONUS_PER_KG : 0;
  const total = +(baseAmount + fragileBonus).toFixed(2);

  return {
    weight,
    category: categoryKey,
    baseRate: ratePerKg,
    fragileBonus: +fragileBonus.toFixed(2),
    surgeMultiplier,
    total,
  };
}

/**
 * Get the surge pricing multiplier for a given date and optional location.
 * @param {Date|string} date
 * @param {string} [location]
 * @returns {Promise<{ multiplier: number, reason: string|null }>}
 */
export async function getSurgeMultiplier(date, location) {
  const d = date ? new Date(date) : new Date();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  const period = SURGE_PERIODS.find(
    p => p.month === month && day >= p.dayStart && day <= p.dayEnd
  );

  return {
    multiplier: period ? period.multiplier : 1.0,
    reason: period ? period.name : null,
  };
}

/**
 * Set (upsert) a per-kg rate for a product category.
 * @param {string} category
 * @param {number} rate
 * @returns {Promise<object>}
 */
export async function setRatePerKg(category, rate) {
  const { data, error } = await supabase
    .from('carrier_rates')
    .upsert(
      { category: category.toLowerCase(), rate_per_kg: rate, is_active: true, updated_at: new Date().toISOString() },
      { onConflict: 'category' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Calculate the platform fee charged on a carrier transaction.
 * @param {number} orderValue
 * @param {number} carrierPayment
 * @returns {{ orderValue: number, carrierPayment: number, feeRate: number, platformFee: number }}
 */
export function calculatePlatformFee(orderValue, carrierPayment) {
  const tier = PLATFORM_FEE_TIERS.find(t => orderValue <= t.max) || PLATFORM_FEE_TIERS[PLATFORM_FEE_TIERS.length - 1];
  const platformFee = +(carrierPayment * tier.rate).toFixed(2);
  return { orderValue, carrierPayment, feeRate: tier.rate, platformFee };
}

/**
 * Calculate bonus payment for a carrier based on monthly delivery count.
 * @param {string} carrierId
 * @param {number} monthlyDeliveries
 * @returns {Promise<{ carrierId: string, monthlyDeliveries: number, bonusPerDelivery: number, totalBonus: number }>}
 */
export async function calculateBonusPayment(carrierId, monthlyDeliveries) {
  const tier = CARRIER_BONUS_TIERS.find(
    t => monthlyDeliveries >= t.min && monthlyDeliveries < t.max
  ) || CARRIER_BONUS_TIERS[CARRIER_BONUS_TIERS.length - 1];

  const totalBonus = +(monthlyDeliveries * tier.bonusPerDelivery).toFixed(2);

  return { carrierId, monthlyDeliveries, bonusPerDelivery: tier.bonusPerDelivery, totalBonus };
}
