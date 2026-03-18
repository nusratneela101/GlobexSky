import supabase from '../config/supabase.js';

/**
 * Calculate the platform commission for an order.
 * @param {number} orderValue
 * @param {string|null} categoryId
 */
export async function calculateCommissionAmount(orderValue, categoryId = null) {
  let setting = null;

  if (categoryId) {
    const { data } = await supabase.from('commission_settings')
      .select('*')
      .eq('type', 'category')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .maybeSingle();
    setting = data;
  }

  if (!setting) {
    const { data } = await supabase.from('commission_settings')
      .select('*')
      .eq('type', 'order_value')
      .lte('min_value', orderValue)
      .gte('max_value', orderValue)
      .eq('is_active', true)
      .maybeSingle();
    setting = data;
  }

  if (!setting) {
    const { data } = await supabase.from('commission_settings')
      .select('*')
      .eq('type', 'default')
      .eq('is_active', true)
      .maybeSingle();
    setting = data;
  }

  const rate = setting?.rate_percentage ?? 5;
  const flatFee = setting?.flat_fee ?? 0;
  const raw = orderValue * (rate / 100) + flatFee;
  const minC = setting?.min_commission ?? 0;
  const maxC = setting?.max_commission ?? Infinity;
  const commission = Math.min(Math.max(raw, minC), maxC);

  return { order_value: orderValue, rate_percentage: rate, flat_fee: flatFee, commission: +commission.toFixed(2) };
}
