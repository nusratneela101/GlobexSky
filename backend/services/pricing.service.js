import supabase from '../config/supabase.js';

/**
 * Calculate the selling price and profit for a dropshipping product.
 * @param {number} supplierPrice
 * @param {string|null} categoryId
 */
export async function calculateMarkup(supplierPrice, categoryId = null) {
  // Try category-specific markup first
  let markup = null;

  if (categoryId) {
    const { data } = await supabase.from('dropshipping_markup')
      .select('markup_percentage,min_profit')
      .eq('type', 'category')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .single();
    markup = data;
  }

  if (!markup) {
    // Try price-range markup
    const { data } = await supabase.from('dropshipping_markup')
      .select('markup_percentage,min_profit')
      .eq('type', 'price_range')
      .lte('min_price', supplierPrice)
      .gte('max_price', supplierPrice)
      .eq('is_active', true)
      .maybeSingle();
    markup = data;
  }

  if (!markup) {
    // Fall back to global markup
    const { data } = await supabase.from('dropshipping_markup')
      .select('markup_percentage,min_profit')
      .eq('type', 'global')
      .eq('is_active', true)
      .maybeSingle();
    markup = data;
  }

  const markupPct = markup?.markup_percentage ?? 20;
  const minProfit = markup?.min_profit ?? 0;
  const rawProfit = supplierPrice * (markupPct / 100);
  const profit = Math.max(rawProfit, minProfit);
  const sellingPrice = +(supplierPrice + profit).toFixed(2);

  return { supplier_price: supplierPrice, markup_percentage: markupPct, profit: +profit.toFixed(2), selling_price: sellingPrice };
}
