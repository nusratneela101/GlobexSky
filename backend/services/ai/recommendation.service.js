/**
 * Globex Sky — AI Recommendation Service
 * Provides collaborative filtering, content-based filtering, hybrid recommendations,
 * frequently bought together, trending products, and personalized homepage recommendations.
 * Caches results in Supabase for performance.
 */

import supabase from '../../config/supabase.js';

const CACHE_TTL_MINUTES = 30;

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function getCached(cacheKey) {
  const { data } = await supabase
    .from('ai_recommendation_cache')
    .select('payload, expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data.payload;
}

async function setCache(cacheKey, payload) {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  await supabase
    .from('ai_recommendation_cache')
    .upsert([{ cache_key: cacheKey, payload, expires_at: expiresAt }], { onConflict: 'cache_key' });
}

// ─── Collaborative Filtering ──────────────────────────────────────────────────

/**
 * Collaborative filtering: find products purchased by users similar to the given user.
 * @param {string} userId
 * @param {number} limit
 */
export async function collaborativeRecommendations(userId, limit = 10) {
  const cacheKey = `collab:${userId}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  // Get products the target user purchased
  const { data: userOrders } = await supabase
    .from('order_items')
    .select('product_id, orders!inner(user_id)')
    .eq('orders.user_id', userId)
    .limit(50);

  const userProductIds = [...new Set((userOrders || []).map((o) => o.product_id))];
  if (!userProductIds.length) return [];

  // Find other users who bought the same products
  const { data: similarOrders } = await supabase
    .from('order_items')
    .select('product_id, orders!inner(user_id)')
    .in('product_id', userProductIds)
    .neq('orders.user_id', userId)
    .limit(200);

  // Score products by how many similar users bought them
  const scores = {};
  for (const item of similarOrders || []) {
    scores[item.product_id] = (scores[item.product_id] || 0) + 1;
  }

  // Exclude products the user already bought
  const candidateIds = Object.keys(scores)
    .filter((id) => !userProductIds.includes(id))
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, limit);

  if (!candidateIds.length) return [];

  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating')
    .in('id', candidateIds)
    .eq('status', 'active');

  const result = (products || []).map((p) => ({ ...p, score: scores[p.id] || 0 }));
  await setCache(cacheKey, result);
  return result;
}

// ─── Content-Based Filtering ──────────────────────────────────────────────────

/**
 * Content-based filtering: recommend products similar in category/price/attributes
 * to the user's purchase history.
 * @param {string} userId
 * @param {number} limit
 */
export async function contentBasedRecommendations(userId, limit = 10) {
  const cacheKey = `content:${userId}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  // Get user's purchased products
  const { data: userOrders } = await supabase
    .from('order_items')
    .select('product_id, orders!inner(user_id)')
    .eq('orders.user_id', userId)
    .limit(20);

  const productIds = [...new Set((userOrders || []).map((o) => o.product_id))];
  if (!productIds.length) return await getTrendingProducts(limit);

  const { data: purchasedProducts } = await supabase
    .from('products')
    .select('category_id, price')
    .in('id', productIds);

  if (!purchasedProducts?.length) return [];

  // Calculate average category distribution and price range
  const categoryCounts = {};
  let totalPrice = 0;
  for (const p of purchasedProducts) {
    if (p.category_id) categoryCounts[p.category_id] = (categoryCounts[p.category_id] || 0) + 1;
    totalPrice += p.price || 0;
  }

  const avgPrice = totalPrice / purchasedProducts.length;
  const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];

  const priceMin = avgPrice * 0.5;
  const priceMax = avgPrice * 2.0;

  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating')
    .eq('status', 'active')
    .eq('category_id', topCategory)
    .gte('price', priceMin)
    .lte('price', priceMax)
    .not('id', 'in', `(${productIds.map((id) => `"${id}"`).join(',')})`)
    .order('average_rating', { ascending: false })
    .limit(limit);

  const result = products || [];
  await setCache(cacheKey, result);
  return result;
}

// ─── Hybrid Recommendations ───────────────────────────────────────────────────

/**
 * Hybrid recommendation combining collaborative and content-based approaches.
 * @param {string} userId
 * @param {number} limit
 */
export async function hybridRecommendations(userId, limit = 10) {
  const cacheKey = `hybrid:${userId}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const [collab, content] = await Promise.all([
    collaborativeRecommendations(userId, limit),
    contentBasedRecommendations(userId, limit),
  ]);

  // Merge: collab gets weight 0.6, content gets weight 0.4
  const scores = {};
  const products = {};

  for (const p of collab) {
    scores[p.id] = (scores[p.id] || 0) + 0.6 * (p.score || 1);
    products[p.id] = p;
  }
  for (const p of content) {
    scores[p.id] = (scores[p.id] || 0) + 0.4 * (p.average_rating || 1);
    products[p.id] = p;
  }

  const result = Object.keys(scores)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, limit)
    .map((id) => ({ ...products[id], hybrid_score: +scores[id].toFixed(3) }));

  await setCache(cacheKey, result);
  return result;
}

// ─── Frequently Bought Together ───────────────────────────────────────────────

/**
 * Products frequently bought together with a given product.
 * @param {string} productId
 * @param {number} limit
 */
export async function frequentlyBoughtTogether(productId, limit = 6) {
  const cacheKey = `fbt:${productId}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  // Find orders that contain this product
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('product_id', productId)
    .limit(200);

  const orderIds = [...new Set((orderItems || []).map((i) => i.order_id))];
  if (!orderIds.length) return [];

  // Find other products in those orders
  const { data: coItems } = await supabase
    .from('order_items')
    .select('product_id')
    .in('order_id', orderIds)
    .neq('product_id', productId);

  const scores = {};
  for (const item of coItems || []) {
    scores[item.product_id] = (scores[item.product_id] || 0) + 1;
  }

  const topIds = Object.keys(scores)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, limit);

  if (!topIds.length) return [];

  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating')
    .in('id', topIds)
    .eq('status', 'active');

  const result = (products || []).map((p) => ({ ...p, co_purchase_count: scores[p.id] || 0 }));
  await setCache(cacheKey, result);
  return result;
}

// ─── Similar Products ─────────────────────────────────────────────────────────

/**
 * Products similar to a given product based on category, price range, and attributes.
 * @param {string} productId
 * @param {number} limit
 */
export async function similarProducts(productId, limit = 8) {
  const cacheKey = `similar:${productId}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const { data: product } = await supabase
    .from('products')
    .select('category_id, price, tags')
    .eq('id', productId)
    .single();

  if (!product) return [];

  const priceMin = product.price * 0.7;
  const priceMax = product.price * 1.3;

  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating, tags')
    .eq('status', 'active')
    .eq('category_id', product.category_id)
    .gte('price', priceMin)
    .lte('price', priceMax)
    .neq('id', productId)
    .order('average_rating', { ascending: false })
    .limit(limit * 2);

  // Score by tag overlap
  const productTags = Array.isArray(product.tags) ? product.tags : [];
  const scored = (products || []).map((p) => {
    const pTags = Array.isArray(p.tags) ? p.tags : [];
    const tagOverlap = pTags.filter((t) => productTags.includes(t)).length;
    return { ...p, similarity_score: tagOverlap + (p.average_rating || 0) };
  });

  const result = scored.sort((a, b) => b.similarity_score - a.similarity_score).slice(0, limit);
  await setCache(cacheKey, result);
  return result;
}

// ─── Trending Products ────────────────────────────────────────────────────────

/**
 * Trending products algorithm: weighted score of views + purchases with time decay.
 * @param {number} limit
 */
export async function getTrendingProducts(limit = 10) {
  const cacheKey = `trending:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  // Count purchases in the last 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentOrders } = await supabase
    .from('order_items')
    .select('product_id, orders!inner(created_at)')
    .gte('orders.created_at', since)
    .limit(500);

  const purchaseCounts = {};
  for (const item of recentOrders || []) {
    purchaseCounts[item.product_id] = (purchaseCounts[item.product_id] || 0) + 1;
  }

  // Get product view counts
  const { data: viewData } = await supabase
    .from('product_views')
    .select('product_id, view_count')
    .gte('updated_at', since)
    .limit(200);

  const viewCounts = {};
  for (const v of viewData || []) {
    viewCounts[v.product_id] = v.view_count || 0;
  }

  // Merge all candidate product IDs
  const candidateIds = [...new Set([...Object.keys(purchaseCounts), ...Object.keys(viewCounts)])];

  if (!candidateIds.length) {
    const { data: fallback } = await supabase
      .from('products')
      .select('id, title, price, images, category_id, average_rating')
      .eq('status', 'active')
      .order('average_rating', { ascending: false })
      .limit(limit);
    return fallback || [];
  }

  const scores = {};
  for (const id of candidateIds) {
    const purchases = purchaseCounts[id] || 0;
    const views = viewCounts[id] || 0;
    scores[id] = purchases * 3 + views * 1;
  }

  const topIds = Object.keys(scores)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, limit);

  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, images, category_id, average_rating')
    .in('id', topIds)
    .eq('status', 'active');

  const result = (products || []).map((p) => ({ ...p, trend_score: scores[p.id] || 0 }));
  await setCache(cacheKey, result);
  return result;
}

// ─── Personalized Homepage Recommendations ────────────────────────────────────

/**
 * Personalized recommendations for the homepage.
 * Returns hybrid recs if user has history, else trending.
 * @param {string|null} userId
 * @param {number} limit
 */
export async function getPersonalizedRecommendations(userId, limit = 12) {
  if (!userId) return getTrendingProducts(limit);

  const cacheKey = `personalized:${userId}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const hybrid = await hybridRecommendations(userId, limit);
  if (hybrid.length >= limit) {
    await setCache(cacheKey, hybrid);
    return hybrid;
  }

  // Pad with trending if not enough hybrid results
  const trending = await getTrendingProducts(limit - hybrid.length);
  const hybridIds = new Set(hybrid.map((p) => p.id));
  const extra = trending.filter((p) => !hybridIds.has(p.id));
  const result = [...hybrid, ...extra].slice(0, limit);
  await setCache(cacheKey, result);
  return result;
}
