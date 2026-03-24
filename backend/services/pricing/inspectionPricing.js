import supabase from '../../config/supabase.js';

/**
 * Inspection type base prices (USD).
 */
const INSPECTION_TYPES = {
  pre_shipment: { label: 'Pre-Shipment Inspection', basePrice: 300 },
  during_production: { label: 'During Production Inspection', basePrice: 350 },
  final_random: { label: 'Final Random Inspection', basePrice: 280 },
  container_loading: { label: 'Container Loading Supervision', basePrice: 250 },
};

/**
 * Location multipliers for inspection cost.
 */
const LOCATION_MULTIPLIERS = {
  asia: 1.0,
  europe: 1.4,
  americas: 1.3,
  africa: 1.2,
  oceania: 1.35,
  default: 1.0,
};

const RUSH_SURCHARGE = 0.50;   // +50 % for < 48-hour scheduling
const WEEKEND_SURCHARGE = 0.25; // +25 % for weekend inspections

/**
 * Determine whether a scheduled date falls on a weekend.
 * @param {Date|string} date
 * @returns {boolean}
 */
function isWeekend(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Determine whether an inspection is considered "rush" (< 48 hours from now).
 * @param {Date|string} scheduledDate
 * @returns {boolean}
 */
function isRushSchedule(scheduledDate) {
  const hoursUntil = (new Date(scheduledDate) - Date.now()) / (1000 * 60 * 60);
  return hoursUntil >= 0 && hoursUntil < 48;
}

/**
 * Calculate the total cost of an inspection.
 * @param {'pre_shipment'|'during_production'|'final_random'|'container_loading'} type
 * @param {string} location  e.g. 'asia', 'europe', 'americas'
 * @param {boolean} isRush   override rush detection (pass true to force rush fee)
 * @param {Date|string} scheduledDate
 * @returns {{ type: string, location: string, basePrice: number, locationMultiplier: number, rushFee: number, weekendFee: number, total: number }}
 */
export function calculateInspectionCost(type, location, isRush, scheduledDate) {
  const inspType = INSPECTION_TYPES[type];
  if (!inspType) throw new Error(`Unknown inspection type: ${type}`);

  const locationKey = (location || 'default').toLowerCase();
  const locationMultiplier = LOCATION_MULTIPLIERS[locationKey] ?? LOCATION_MULTIPLIERS.default;

  const base = inspType.basePrice * locationMultiplier;

  const rush = isRush ?? isRushSchedule(scheduledDate);
  const weekend = scheduledDate ? isWeekend(scheduledDate) : false;

  const rushFee = rush ? base * RUSH_SURCHARGE : 0;
  const weekendFee = weekend ? base * WEEKEND_SURCHARGE : 0;

  const total = +(base + rushFee + weekendFee).toFixed(2);

  return {
    type,
    location: locationKey,
    basePrice: inspType.basePrice,
    locationMultiplier,
    rush,
    weekend,
    rushFee: +rushFee.toFixed(2),
    weekendFee: +weekendFee.toFixed(2),
    total,
  };
}

/**
 * Return all available inspection types with their base prices.
 * @returns {object}
 */
export function getInspectionTypes() {
  return INSPECTION_TYPES;
}

/**
 * Apply a custom (admin-set) price to an inspection record.
 * @param {string} adminId
 * @param {string} inspectionId
 * @param {number} customPrice
 * @returns {Promise<object>}
 */
export async function applyCustomPricing(adminId, inspectionId, customPrice) {
  const { data, error } = await supabase
    .from('inspections')
    .update({
      custom_price: customPrice,
      price_overridden_by: adminId,
      price_overridden_at: new Date().toISOString(),
    })
    .eq('id', inspectionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
