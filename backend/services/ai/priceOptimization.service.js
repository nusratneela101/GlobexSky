/**
 * Globex Sky — AI Price Optimization Service
 * Competitive price analysis, demand-based pricing suggestions,
 * dynamic pricing rules engine, price elasticity estimation,
 * bulk pricing optimization, and dropshipping markup recommendations.
 */

import supabase from '../../config/supabase.js';

// ─── Competitive Price Analysis ───────────────────────────────────────────────

/**
 * Compare a product's price with stored competitor prices.
 * @param {string} productId
 * @returns {{ product: object, competitors: object[], recommendation: string, suggested_price: number }}
 */
export async function competitivePriceAnalysis(productId) {
  const { data: product, error: pError } = await supabase
    .from('products')
    .select('id, title, price, category_id, cost_price')
    .eq('id', productId)
    .single();
  if (pError) throw pError;

  const { data: competitors } = await supabase
    .from('competitor_prices')
    .select('competitor_name, price, url, updated_at')
    .eq('product_id', productId)
    .order('updated_at', { ascending: false });

  const compPrices = (competitors || []).map((c) => c.price).filter(Boolean);
  const avgCompetitorPrice = compPrices.length
    ? compPrices.reduce((s, p) => s + p, 0) / compPrices.length
    : null;

  let recommendation = 'No competitor data available.';
  let suggestedPrice = product.price;

  if (avgCompetitorPrice !== null) {
    const diff = ((product.price - avgCompetitorPrice) / avgCompetitorPrice) * 100;
    if (diff > 10) {
      recommendation = `Your price is ${diff.toFixed(1)}% above the market average. Consider reducing to stay competitive.`;
      suggestedPrice = +(avgCompetitorPrice * 1.02).toFixed(2); // 2% above average
    } else if (diff < -10) {
      recommendation = `Your price is ${Math.abs(diff).toFixed(1)}% below the market average. You may be able to increase margins.`;
      suggestedPrice = +(avgCompetitorPrice * 0.98).toFixed(2); // 2% below average
    } else {
      recommendation = `Your price is within 10% of the market average ($${avgCompetitorPrice.toFixed(2)}). Competitive positioning looks good.`;
    }
  }

  return {
    product: { id: product.id, title: product.title, current_price: product.price },
    competitors: competitors || [],
    avg_competitor_price: avgCompetitorPrice,
    suggested_price: suggestedPrice,
    recommendation,
  };
}

// ─── Demand-Based Pricing ─────────────────────────────────────────────────────

/**
 * Suggest a price based on recent demand (order velocity).
 * @param {string} productId
 * @returns {{ suggested_price: number, demand_level: 'low'|'medium'|'high', reason: string }}
 */
export async function demandBasedPricing(productId) {
  const { data: product } = await supabase
    .from('products')
    .select('id, price, cost_price')
    .eq('id', productId)
    .single();
  if (!product) throw new Error('Product not found.');

  // Count orders in last 7 days
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: orders7d } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .gte('created_at', since7d);

  // Count orders in prior 7 days for comparison
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { count: orders14d } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .gte('created_at', since14d)
    .lt('created_at', since7d);

  const recent = orders7d || 0;
  const prior = orders14d || 0;

  let demandLevel = 'medium';
  let priceMultiplier = 1.0;
  let reason = 'Demand is stable; current price is optimal.';

  if (recent > prior * 1.5 && recent > 10) {
    demandLevel = 'high';
    priceMultiplier = 1.1; // +10%
    reason = `High demand: ${recent} orders vs ${prior} last week. Slight price increase recommended.`;
  } else if (recent < prior * 0.5 || recent < 3) {
    demandLevel = 'low';
    priceMultiplier = 0.92; // -8%
    reason = `Low demand: only ${recent} orders this week. Price reduction may stimulate sales.`;
  }

  const suggestedPrice = +(product.price * priceMultiplier).toFixed(2);
  const minPrice = product.cost_price ? +(product.cost_price * 1.1).toFixed(2) : null;

  return {
    product_id: productId,
    current_price: product.price,
    suggested_price: minPrice ? Math.max(suggestedPrice, minPrice) : suggestedPrice,
    demand_level: demandLevel,
    orders_last_7d: recent,
    orders_prior_7d: prior,
    reason,
  };
}

// ─── Dynamic Pricing Rules Engine ────────────────────────────────────────────

/**
 * Apply dynamic pricing rules to a product.
 * Rules are stored in the `pricing_rules` table.
 * @param {string} productId
 * @returns {{ final_price: number, applied_rules: string[] }}
 */
export async function applyDynamicPricingRules(productId) {
  const { data: product } = await supabase
    .from('products')
    .select('id, price, category_id, stock_quantity')
    .eq('id', productId)
    .single();
  if (!product) throw new Error('Product not found.');

  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  // Filter rules applicable to this product/category in JS to avoid injection
  const applicableRules = (rules || []).filter((rule) =>
    rule.product_id === productId ||
    rule.category_id === product.category_id ||
    (!rule.product_id && !rule.category_id),
  );

  let price = product.price;
  const appliedRules = [];

  for (const rule of applicableRules) {

    // Check date range
    const now = new Date();
    if (rule.start_date && new Date(rule.start_date) > now) continue;
    if (rule.end_date && new Date(rule.end_date) < now) continue;

    // Apply rule
    switch (rule.rule_type) {
      case 'percentage_discount':
        price = price * (1 - (rule.value / 100));
        appliedRules.push(`${rule.name}: -${rule.value}%`);
        break;
      case 'fixed_discount':
        price = Math.max(0, price - rule.value);
        appliedRules.push(`${rule.name}: -$${rule.value}`);
        break;
      case 'fixed_price':
        price = rule.value;
        appliedRules.push(`${rule.name}: fixed $${rule.value}`);
        break;
      case 'low_stock_premium':
        if (product.stock_quantity <= (rule.threshold || 10)) {
          price = price * (1 + (rule.value / 100));
          appliedRules.push(`${rule.name}: +${rule.value}% (low stock)`);
        }
        break;
      default:
        break;
    }
  }

  return {
    product_id: productId,
    original_price: product.price,
    final_price: +price.toFixed(2),
    applied_rules: appliedRules,
  };
}

// ─── Price Elasticity Estimation ──────────────────────────────────────────────

/**
 * Estimate price elasticity for a product using historical price/sales data.
 * @param {string} productId
 * @returns {{ elasticity: number, interpretation: string }}
 */
export async function estimatePriceElasticity(productId) {
  const { data: history } = await supabase
    .from('price_history')
    .select('price, date')
    .eq('product_id', productId)
    .order('date', { ascending: true })
    .limit(20);

  if (!history?.length || history.length < 2) {
    return { elasticity: null, interpretation: 'Insufficient price history to estimate elasticity.' };
  }

  // Get sales counts for each price period
  const periods = [];
  for (let i = 0; i < history.length - 1; i++) {
    const { count } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .gte('created_at', history[i].date)
      .lt('created_at', history[i + 1].date);

    periods.push({ price: history[i].price, sales: count || 0 });
  }

  if (periods.length < 2) return { elasticity: null, interpretation: 'Not enough periods.' };

  // Simple arc elasticity: %change_quantity / %change_price
  let totalElasticity = 0;
  let validPairs = 0;
  for (let i = 1; i < periods.length; i++) {
    const priceDiff = periods[i].price - periods[i - 1].price;
    const salesDiff = periods[i].sales - periods[i - 1].sales;
    if (periods[i - 1].price === 0 || periods[i - 1].sales === 0) continue;
    const pctPriceChange = priceDiff / periods[i - 1].price;
    const pctSalesChange = salesDiff / (periods[i - 1].sales || 1);
    if (pctPriceChange !== 0) {
      totalElasticity += pctSalesChange / pctPriceChange;
      validPairs++;
    }
  }

  if (!validPairs) return { elasticity: null, interpretation: 'Insufficient variation.' };

  const elasticity = +(totalElasticity / validPairs).toFixed(2);
  let interpretation;
  if (elasticity < -1) interpretation = 'Elastic: price-sensitive product. Small price changes significantly affect demand.';
  else if (elasticity >= -1 && elasticity < 0) interpretation = 'Inelastic: relatively price-insensitive. Modest price increases may be tolerated.';
  else interpretation = 'Unusual elasticity pattern; review data.';

  return { elasticity, interpretation };
}

// ─── Bulk Pricing Optimization ────────────────────────────────────────────────

/**
 * Optimize prices for multiple products at once.
 * @param {string[]} productIds
 * @returns {Array<{ product_id: string, current_price: number, optimized_price: number, reason: string }>}
 */
export async function bulkPricingOptimization(productIds) {
  const results = await Promise.allSettled(
    productIds.map(async (id) => {
      const demand = await demandBasedPricing(id);
      const rules = await applyDynamicPricingRules(id);
      // Take the lower of demand-based and rules-based price (most competitive)
      const optimizedPrice = Math.min(demand.suggested_price, rules.final_price || demand.suggested_price);
      return {
        product_id: id,
        current_price: demand.current_price,
        optimized_price: +optimizedPrice.toFixed(2),
        reason: demand.reason,
        applied_rules: rules.applied_rules,
      };
    }),
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ─── Dropshipping Markup Recommendations ─────────────────────────────────────

/**
 * Recommend markup percentages by category based on category performance.
 * @param {string|null} categoryId
 * @returns {{ category_id: string|null, recommended_markup: number, reason: string }}
 */
export async function dropshippingMarkupRecommendation(categoryId = null) {
  // Get average margin for this category from fulfilled orders
  let query = supabase
    .from('order_items')
    .select('unit_price, orders!inner(status)')
    .eq('orders.status', 'delivered')
    .limit(200);

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data: items } = await query;
  const avgPrice = items?.length
    ? items.reduce((s, i) => s + (i.unit_price || 0), 0) / items.length
    : 0;

  // Base markup on price tier
  let recommendedMarkup = 20; // default
  let reason = 'Default markup applied.';

  if (avgPrice > 500) {
    recommendedMarkup = 12;
    reason = 'High-value category: lower markup to stay competitive.';
  } else if (avgPrice > 100) {
    recommendedMarkup = 18;
    reason = 'Mid-range category: balanced markup recommended.';
  } else if (avgPrice <= 100) {
    recommendedMarkup = 25;
    reason = 'Low-value category: higher markup to ensure healthy margins.';
  }

  // Check if category has a high conversion rate
  if (items && items.length > 50) {
    recommendedMarkup = Math.max(recommendedMarkup - 2, 10);
    reason += ' Category has strong sales volume; slight markup reduction to maintain velocity.';
  }

  return {
    category_id: categoryId,
    avg_order_value: +avgPrice.toFixed(2),
    recommended_markup_percentage: recommendedMarkup,
    reason,
  };
}
