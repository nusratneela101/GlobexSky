import supabase from '../../config/supabase.js';

/**
 * Weight tier pricing table (USD base rates).
 * These rates apply for Zone 1 (domestic / nearest zone).
 */
const WEIGHT_TIERS = [
  { label: '0-0.5kg',  min: 0,    max: 0.5,  base: 4.00 },
  { label: '0.5-1kg',  min: 0.5,  max: 1,    base: 6.50 },
  { label: '1-2kg',    min: 1,    max: 2,     base: 10.00 },
  { label: '2-5kg',    min: 2,    max: 5,     base: 18.00 },
  { label: '5-10kg',   min: 5,    max: 10,    base: 32.00 },
  { label: '10-20kg',  min: 10,   max: 20,    base: 55.00 },
  { label: '20kg+',    min: 20,   max: Infinity, base: 85.00 },
];

/**
 * Zone multipliers applied on top of base weight-tier rate.
 * Zones are determined by origin–destination pairing.
 */
const ZONE_MULTIPLIERS = {
  1: 1.00,  // domestic
  2: 1.30,  // neighboring country
  3: 1.60,  // same continent
  4: 2.00,  // intercontinental
  5: 2.50,  // remote / island
};

/**
 * Rough continent mapping for zone calculation (ISO country-code prefix groupings).
 */
const CONTINENT_MAP = {
  AS: ['CN', 'JP', 'KR', 'IN', 'BD', 'PK', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK'],
  EU: ['DE', 'FR', 'GB', 'IT', 'ES', 'NL', 'PL', 'SE', 'NO', 'DK', 'FI', 'BE', 'AT', 'CH'],
  NA: ['US', 'CA', 'MX'],
  SA: ['BR', 'AR', 'CL', 'CO', 'PE', 'VE'],
  AF: ['ZA', 'NG', 'EG', 'KE', 'GH', 'ET'],
  OC: ['AU', 'NZ'],
};

/**
 * Bulk discount tiers based on parcel quantity.
 */
const BULK_DISCOUNT_TIERS = [
  { min: 1,   max: 10,  discount: 0 },
  { min: 10,  max: 50,  discount: 0.05 },
  { min: 50,  max: 100, discount: 0.10 },
  { min: 100, max: Infinity, discount: 0.15 },
];

/**
 * Insurance pricing: percentage of declared value, with minimum premium.
 */
const INSURANCE_RATE = 0.02;  // 2 % of declared value
const INSURANCE_MIN  = 3.00;  // minimum $3 premium

/**
 * Calculate the dimensional weight of a parcel in kg.
 * Uses industry-standard divisor of 5000 cm³/kg.
 * @param {number} length  cm
 * @param {number} width   cm
 * @param {number} height  cm
 * @returns {number} dimensional weight in kg
 */
export function getDimensionalWeight(length, width, height) {
  return +((length * width * height) / 5000).toFixed(3);
}

/**
 * Determine origin–destination zone number (1-5).
 * @param {string} origin       ISO country code (e.g. 'US')
 * @param {string} destination  ISO country code
 * @returns {number} zone
 */
export function getZone(origin, destination) {
  if (!origin || !destination) return 4;
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  if (o === d) return 1;

  const continentOf = code => Object.entries(CONTINENT_MAP).find(([, countries]) => countries.includes(code))?.[0];
  const co = continentOf(o);
  const cd = continentOf(d);

  if (!co || !cd) return 4;
  if (co === cd) return 3;
  if (
    (co === 'NA' && cd === 'SA') || (co === 'SA' && cd === 'NA') ||
    (co === 'EU' && cd === 'AF') || (co === 'AF' && cd === 'EU')
  ) return 3;
  return 4;
}

/**
 * Resolve weight tier for a given billable weight.
 * @param {number} weight kg
 * @returns {object} tier
 */
function resolveWeightTier(weight) {
  return WEIGHT_TIERS.find(t => weight >= t.min && weight < t.max)
    || WEIGHT_TIERS[WEIGHT_TIERS.length - 1];
}

/**
 * Calculate the total shipping cost for a parcel.
 * @param {string} origin       ISO country code
 * @param {string} destination  ISO country code
 * @param {number} weight       actual weight in kg
 * @param {{ length: number, width: number, height: number }|null} dimensions  cm
 * @returns {{ origin: string, destination: string, actualWeight: number, dimensionalWeight: number, billableWeight: number, zone: number, baseCost: number, total: number }}
 */
export function calculateShippingCost(origin, destination, weight, dimensions) {
  const dimWeight = dimensions
    ? getDimensionalWeight(dimensions.length, dimensions.width, dimensions.height)
    : 0;

  const billableWeight = Math.max(weight, dimWeight);
  const tier = resolveWeightTier(billableWeight);
  const zone = getZone(origin, destination);
  const zoneMultiplier = ZONE_MULTIPLIERS[zone] ?? 2.0;
  const baseCost = +(tier.base * zoneMultiplier).toFixed(2);

  return {
    origin,
    destination,
    actualWeight: weight,
    dimensionalWeight: dimWeight,
    billableWeight,
    zone,
    weightTier: tier.label,
    baseCost,
    total: baseCost,
  };
}

/**
 * Apply a bulk discount to a base shipping cost.
 * @param {number} quantity  number of parcels
 * @param {number} baseCost  cost per parcel
 * @returns {{ quantity: number, baseCost: number, discountRate: number, discountedCost: number, totalCost: number }}
 */
export function applyBulkDiscount(quantity, baseCost) {
  const tier = BULK_DISCOUNT_TIERS.find(t => quantity >= t.min && quantity < t.max)
    || BULK_DISCOUNT_TIERS[BULK_DISCOUNT_TIERS.length - 1];

  const discountRate = tier.discount;
  const discountedCost = +(baseCost * (1 - discountRate)).toFixed(2);
  const totalCost = +(discountedCost * quantity).toFixed(2);

  return { quantity, baseCost, discountRate, discountedCost, totalCost };
}

/**
 * Calculate insurance premium for a declared shipment value.
 * @param {number} declaredValue
 * @param {string} destination  ISO country code (reserved for future geo-based adjustments)
 * @returns {{ declaredValue: number, destination: string, rate: number, premium: number }}
 */
export function calculateInsurance(declaredValue, destination) {
  const raw = declaredValue * INSURANCE_RATE;
  const premium = +(Math.max(raw, INSURANCE_MIN)).toFixed(2);
  return { declaredValue, destination, rate: INSURANCE_RATE, premium };
}
