import supabase from '../config/supabase.js';

/**
 * Calculate shipping cost for a parcel.
 * @param {object} params
 */
export async function calculateShippingRate({ destination_country, weight_kg, express = false, fragile = false, insurance = false, declared_value = 0 }) {
  const { data: rate } = await supabase
    .from('shipping_rates')
    .select('*')
    .eq('destination_country', destination_country)
    .lte('min_weight', weight_kg)
    .gte('max_weight', weight_kg)
    .eq('is_active', true)
    .maybeSingle();

  if (!rate) {
    // Default fallback rates
    const baseFee = 10;
    const pricePerKg = 8;
    const total = baseFee + weight_kg * pricePerKg;
    return { base_fee: baseFee, price_per_kg: pricePerKg, weight_kg, subtotal: total, express_fee: 0, fragile_fee: 0, insurance_fee: 0, total: +total.toFixed(2), estimated_days: '7-14' };
  }

  const subtotal = rate.base_fee + weight_kg * rate.price_per_kg;
  const expressFee = express ? (rate.express_fee || 0) : 0;
  const fragileFee = fragile ? (rate.fragile_fee || 0) : 0;
  const insuranceFee = insurance ? declared_value * ((rate.insurance_percentage || 1) / 100) : 0;
  const total = subtotal + expressFee + fragileFee + insuranceFee;

  return {
    base_fee: rate.base_fee,
    price_per_kg: rate.price_per_kg,
    weight_kg,
    subtotal: +subtotal.toFixed(2),
    express_fee: +expressFee.toFixed(2),
    fragile_fee: +fragileFee.toFixed(2),
    insurance_fee: +insuranceFee.toFixed(2),
    total: +total.toFixed(2),
    estimated_days: `${rate.estimated_days_min}-${rate.estimated_days_max}`,
  };
}
