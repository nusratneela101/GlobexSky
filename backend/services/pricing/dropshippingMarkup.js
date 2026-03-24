import supabase from '../../config/supabase.js';

/**
 * Default category-based markup percentages.
 */
const DEFAULT_CATEGORY_MARKUP = {
  electronics: 0.20,
  fashion: 0.35,
  home: 0.25,
  beauty: 0.30,
  sports: 0.25,
  default: 0.20,
};

/**
 * Default price-range markups:
 *   $0–10    → 40 %
 *   $10–50   → 30 %
 *   $50–200  → 20 %
 *   $200+    → 15 %
 */
const PRICE_RANGE_MARKUP = [
  { min: 0, max: 10, markup: 0.40 },
  { min: 10, max: 50, markup: 0.30 },
  { min: 50, max: 200, markup: 0.20 },
  { min: 200, max: Infinity, markup: 0.15 },
];

/**
 * Resolve price-range markup for a given base price.
 * @param {number} basePrice
 * @returns {number} markup rate (e.g. 0.30)
 */
function resolvePriceRangeMarkup(basePrice) {
  const tier = PRICE_RANGE_MARKUP.find(t => basePrice >= t.min && basePrice < t.max)
    || PRICE_RANGE_MARKUP[PRICE_RANGE_MARKUP.length - 1];
  return tier.markup;
}

/**
 * Calculate the dropshipping selling price for a product.
 * Priority: DB category rule → DB price-range rule → in-memory price-range table.
 * @param {string} productId
 * @param {string|null} categoryId
 * @param {number} basePrice
 * @returns {Promise<{ productId: string, categoryId: string|null, basePrice: number, markupRate: number, markupAmount: number, sellingPrice: number }>}
 */
export async function calculateMarkup(productId, categoryId, basePrice) {
  let markupRate = null;

  if (categoryId) {
    const { data } = await supabase
      .from('dropshipping_markup_rules')
      .select('markup_percent')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .maybeSingle();
    if (data) markupRate = data.markup_percent / 100;
  }

  if (markupRate === null) {
    const { data } = await supabase
      .from('dropshipping_markup_rules')
      .select('markup_percent')
      .is('category_id', null)
      .lte('min_price', basePrice)
      .gte('max_price', basePrice)
      .eq('is_active', true)
      .maybeSingle();
    if (data) markupRate = data.markup_percent / 100;
  }

  if (markupRate === null) {
    markupRate = resolvePriceRangeMarkup(basePrice);
  }

  const markupAmount = +(basePrice * markupRate).toFixed(2);
  const sellingPrice = +(basePrice + markupAmount).toFixed(2);

  return { productId, categoryId, basePrice, markupRate, markupAmount, sellingPrice };
}

/**
 * Persist a markup rule for a category / price range.
 * @param {string|null} categoryId
 * @param {{ min: number, max: number }} priceRange
 * @param {number} markupPercent  e.g. 25 for 25 %
 * @returns {Promise<object>}
 */
export async function setMarkupRule(categoryId, priceRange, markupPercent) {
  const record = {
    category_id: categoryId || null,
    min_price: priceRange?.min ?? 0,
    max_price: priceRange?.max ?? null,
    markup_percent: markupPercent,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('dropshipping_markup_rules')
    .upsert(record, { onConflict: 'category_id,min_price,max_price' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Get the suggested competitive price for a product by checking similar listings.
 * Falls back to calculated markup price when no competitor data is found.
 * @param {string} productId
 * @returns {Promise<{ productId: string, suggestedPrice: number, source: string }>}
 */
export async function getCompetitivePrice(productId) {
  const { data: product } = await supabase
    .from('products')
    .select('id, base_price, category_id')
    .eq('id', productId)
    .single();

  if (!product) throw new Error(`Product ${productId} not found`);

  const { data: competitors } = await supabase
    .from('products')
    .select('selling_price')
    .eq('category_id', product.category_id)
    .neq('id', productId)
    .eq('is_active', true)
    .limit(10);

  if (competitors && competitors.length > 0) {
    const avgPrice = competitors.reduce((sum, p) => sum + (p.selling_price || 0), 0) / competitors.length;
    return { productId, suggestedPrice: +avgPrice.toFixed(2), source: 'competitor_average' };
  }

  const { sellingPrice } = await calculateMarkup(productId, product.category_id, product.base_price);
  return { productId, suggestedPrice: sellingPrice, source: 'markup_calculation' };
}

/**
 * Apply a markup rule to an array of products in bulk.
 * @param {string[]} productIds
 * @param {{ categoryId?: string, priceRange?: { min: number, max: number }, markupPercent: number }} markupRule
 * @returns {Promise<Array<{ productId: string, sellingPrice: number }>>}
 */
export async function bulkApplyMarkup(productIds, markupRule) {
  const { data: products } = await supabase
    .from('products')
    .select('id, base_price, category_id')
    .in('id', productIds);

  if (!products || products.length === 0) return [];

  const results = await Promise.all(
    products.map(async p => {
      const markupRate = (markupRule.markupPercent ?? 20) / 100;
      const markupAmount = +(p.base_price * markupRate).toFixed(2);
      const sellingPrice = +(p.base_price + markupAmount).toFixed(2);

      await supabase
        .from('products')
        .update({ selling_price: sellingPrice, updated_at: new Date().toISOString() })
        .eq('id', p.id);

      return { productId: p.id, sellingPrice };
    })
  );

  return results;
}
