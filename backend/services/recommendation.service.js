/**
 * backend/services/recommendation.service.js
 *
 * Recommendation algorithms:
 *  - collaborative  : users-who-bought-this-also-bought
 *  - content_based  : products similar by category / tags / price
 *  - hybrid         : weighted blend of collaborative + content_based
 *  - ai_powered     : delegates scoring to OpenAI / Azure / custom endpoint
 */

import Recommendation from '../models/Recommendation.js';
import supabase from '../config/supabase.js';

// ─── Config helpers ───────────────────────────────────────────────────────────

/**
 * Load all recommendation config as a flat key→value map.
 * @returns {Promise<Record<string,string>>}
 */
export async function loadConfig() {
  const rows = await Recommendation.getAllConfig();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

/**
 * Verify that the AI provider connection works with the stored API key.
 * Returns { ok: true } or throws an error with a descriptive message.
 */
export async function testAiConnection() {
  const cfg = await loadConfig();
  const provider  = cfg.ai_provider  ?? 'openai';
  const apiKey    = cfg.ai_api_key   ?? '';
  const endpoint  = cfg.ai_endpoint  ?? '';

  if (!apiKey) throw Object.assign(new Error('No API key configured.'), { statusCode: 422 });

  if (provider === 'openai') {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw Object.assign(new Error(`OpenAI error: ${res.status} ${res.statusText}`), { statusCode: 422 });
    return { ok: true, provider };
  }

  if (provider === 'azure') {
    if (!endpoint) throw Object.assign(new Error('Azure endpoint URL is required.'), { statusCode: 422 });
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
    const res = await fetch(`${endpoint}/openai/deployments?api-version=2023-03-15-preview`, {
      headers: { 'api-key': apiKey },
    });
    if (!res.ok) throw Object.assign(new Error(`Azure error: ${res.status} ${res.statusText}`), { statusCode: 422 });
    return { ok: true, provider };
  }

  if (provider === 'custom') {
    if (!endpoint) throw Object.assign(new Error('Custom endpoint URL is required.'), { statusCode: 422 });
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw Object.assign(new Error(`Custom endpoint error: ${res.status} ${res.statusText}`), { statusCode: 422 });
    return { ok: true, provider };
  }

  throw Object.assign(new Error(`Unknown provider: ${provider}`), { statusCode: 422 });
}

// ─── Algorithm: Collaborative Filtering ──────────────────────────────────────

/**
 * Collaborative filtering: find products liked by users similar to userId.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array<{product_id,score,algorithm,reason}>>}
 */
async function collaborativeFilter(userId, limit) {
  // Step 1 – products this user has interacted with
  const myInteractions = await Recommendation.getUserInteractions(userId, 200);
  const myProductIds = [...new Set(myInteractions.map(i => i.product_id))];

  if (!myProductIds.length) return [];

  // Step 2 – other users who interacted with the same products
  const { data: peers, error: e1 } = await supabase
    .from('user_interactions')
    .select('user_id')
    .in('product_id', myProductIds)
    .neq('user_id', userId)
    .limit(2000);
  if (e1) throw e1;

  const peerIds = [...new Set((peers ?? []).map(p => p.user_id))];
  if (!peerIds.length) return [];

  // Step 3 – products those peers interacted with that the current user hasn't
  const { data: peerProds, error: e2 } = await supabase
    .from('user_interactions')
    .select('product_id, interaction_type')
    .in('user_id', peerIds)
    .filter('product_id', 'not.in', `(${myProductIds.map(id => `"${id}"`).join(',')})`)
    .limit(5000);
  if (e2) throw e2;

  // Score by interaction weight
  const weights = { view: 1, click: 2, wishlist: 3, cart: 4, purchase: 5 };
  const scores = {};
  (peerProds ?? []).forEach(r => {
    scores[r.product_id] = (scores[r.product_id] ?? 0) + (weights[r.interaction_type] ?? 1);
  });

  const max = Math.max(...Object.values(scores), 1);
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([product_id, raw]) => ({
      product_id,
      score:     parseFloat((raw / max).toFixed(4)),
      algorithm: 'collaborative',
      reason:    'Users like you also viewed this product',
    }));
}

// ─── Algorithm: Content-Based Filtering ──────────────────────────────────────

/**
 * Content-based filtering: find products similar in category / price band to
 * the products the user has interacted with.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array<{product_id,score,algorithm,reason}>>}
 */
async function contentBasedFilter(userId, limit) {
  const myInteractions = await Recommendation.getUserInteractions(userId, 50);
  const myProductIds = [...new Set(myInteractions.map(i => i.product_id))];
  if (!myProductIds.length) return [];

  // Fetch the user's products to extract categories and price range
  const { data: myProds, error: e1 } = await supabase
    .from('products')
    .select('id, category_id, price, tags')
    .in('id', myProductIds);
  if (e1) throw e1;
  if (!myProds?.length) return [];

  const catIds  = [...new Set(myProds.map(p => p.category_id).filter(Boolean))];
  const prices  = myProds.map(p => parseFloat(p.price ?? 0)).filter(Boolean);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  // Find similar products
  let query = supabase
    .from('products')
    .select('id, category_id, price')
    .filter('id', 'not.in', `(${myProductIds.map(id => `"${id}"`).join(',')})`)
    .limit(limit * 5);

  if (catIds.length) {
    query = query.in('category_id', catIds);
  }

  const { data: candidates, error: e2 } = await query;
  if (e2) throw e2;
  if (!candidates?.length) return [];

  // Score by category match + price proximity
  const scored = candidates.map(p => {
    let score = 0;
    if (catIds.includes(p.category_id)) score += 0.6;
    if (avgPrice !== null) {
      const diff = Math.abs(parseFloat(p.price ?? 0) - avgPrice);
      const priceScore = Math.max(0, 0.4 - (diff / avgPrice) * 0.4);
      score += priceScore;
    }
    return { product_id: p.id, rawScore: score };
  });

  const maxScore = Math.max(...scored.map(s => s.rawScore), 0.0001);
  return scored
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, limit)
    .map(s => ({
      product_id: s.product_id,
      score:      parseFloat((s.rawScore / maxScore).toFixed(4)),
      algorithm:  'content_based',
      reason:     'Similar to products you viewed',
    }));
}

// ─── Algorithm: Hybrid ────────────────────────────────────────────────────────

/**
 * Hybrid: weighted blend (60% collaborative + 40% content_based).
 */
async function hybridFilter(userId, limit) {
  const [collab, content] = await Promise.all([
    collaborativeFilter(userId, limit * 2),
    contentBasedFilter(userId, limit * 2),
  ]);

  const map = {};
  collab.forEach(r => {
    map[r.product_id] = { product_id: r.product_id, blended: r.score * 0.6 };
  });
  content.forEach(r => {
    if (map[r.product_id]) {
      map[r.product_id].blended += r.score * 0.4;
    } else {
      map[r.product_id] = { product_id: r.product_id, blended: r.score * 0.4 };
    }
  });

  const entries = Object.values(map).sort((a, b) => b.blended - a.blended).slice(0, limit);
  const maxScore = entries[0]?.blended ?? 1;
  return entries.map(e => ({
    product_id: e.product_id,
    score:      parseFloat((e.blended / maxScore).toFixed(4)),
    algorithm:  'hybrid',
    reason:     'Personalised recommendation',
  }));
}

// ─── Algorithm: AI-Powered ────────────────────────────────────────────────────

/**
 * AI-powered: sends user interaction history to OpenAI/Azure/custom and asks
 * for a ranked list of product IDs.
 */
async function aiPoweredFilter(userId, limit, cfg) {
  const interactions = await Recommendation.getUserInteractions(userId, 100);
  if (!interactions.length) return hybridFilter(userId, limit);

  const apiKey   = cfg.ai_api_key  ?? '';
  const provider = cfg.ai_provider ?? 'openai';
  const endpoint = cfg.ai_endpoint ?? '';

  if (!apiKey) return hybridFilter(userId, limit);

  const prompt = `You are a product recommendation engine.
The user has these recent product interactions (product_id, type):
${interactions.slice(0, 30).map(i => `- ${i.product_id} (${i.interaction_type})`).join('\n')}

Based on these interactions, return a JSON array of up to ${limit} product IDs the user would most likely want to buy next. Only return product IDs from the list above, ranked by predicted interest. Format: ["uuid1","uuid2",...]`;

  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));

    const aiModel = cfg.ai_model ?? (provider === 'azure' ? 'gpt-4' : 'gpt-3.5-turbo');

    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    const headers = { 'Content-Type': 'application/json' };

    if (provider === 'azure') {
      apiUrl = `${endpoint}/openai/deployments/${encodeURIComponent(aiModel)}/chat/completions?api-version=2023-03-15-preview`;
      headers['api-key'] = apiKey;
    } else if (provider === 'custom') {
      apiUrl = endpoint;
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: aiModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) return hybridFilter(userId, limit);

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? '[]';
    const ids  = JSON.parse(text.match(/\[.*\]/s)?.[0] ?? '[]');

    return ids.slice(0, limit).map((product_id, idx) => ({
      product_id,
      score:     parseFloat((1 - idx / ids.length).toFixed(4)),
      algorithm: 'ai_powered',
      reason:    'AI-powered personalised recommendation',
    }));
  } catch {
    // Fall back to hybrid if AI call fails
    return hybridFilter(userId, limit);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate and persist fresh recommendations for a user.
 * @param {string} userId
 * @returns {Promise<object[]>} stored recommendation rows
 */
export async function generateForUser(userId) {
  const cfg   = await loadConfig();
  if (cfg.feature_enabled === 'false') return [];

  const limit    = parseInt(cfg.max_recommendations ?? '12', 10);
  const ttl      = parseInt(cfg.refresh_interval_hours ?? '24', 10);
  const minInter = parseInt(cfg.min_interactions_for_personalization ?? '5', 10);
  const algo     = cfg.algorithm ?? 'hybrid';

  const interactionCount = await Recommendation.countUserInteractions(userId);

  let recs = [];
  if (interactionCount < minInter) {
    // Not enough data — fall back to trending
    const trending = await Recommendation.getTrending(limit);
    recs = trending.map((t, idx) => ({
      product_id: t.product_id,
      score:      parseFloat((1 - idx / trending.length).toFixed(4)),
      algorithm:  'trending',
      reason:     'Currently trending',
    }));
  } else {
    switch (algo) {
      case 'collaborative': recs = await collaborativeFilter(userId, limit);  break;
      case 'content_based': recs = await contentBasedFilter(userId, limit);   break;
      case 'ai_powered':    recs = await aiPoweredFilter(userId, limit, cfg); break;
      default:              recs = await hybridFilter(userId, limit);
    }
  }

  return Recommendation.generateRecommendations(userId, recs, ttl);
}

/**
 * Get similar products to a given product (content-based without user context).
 * @param {string} productId
 * @param {number} [limit=6]
 */
export async function getSimilarProducts(productId, limit = 6) {
  // Fetch the reference product
  const { data: ref, error } = await supabase
    .from('products')
    .select('id, category_id, price, tags')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw error;
  if (!ref) return [];

  let query = supabase
    .from('products')
    .select('id, name, price, category_id, images')
    .neq('id', productId)
    .limit(limit * 4);

  if (ref.category_id) query = query.eq('category_id', ref.category_id);

  const { data: candidates, error: e2 } = await query;
  if (e2) throw e2;

  const refPrice = parseFloat(ref.price ?? 0);
  const scored   = (candidates ?? []).map(p => {
    let score = 0.5; // same-category bonus already filtered
    const diff = Math.abs(parseFloat(p.price ?? 0) - refPrice);
    const proximity = refPrice > 0 ? Math.max(0, 0.5 - (diff / refPrice) * 0.5) : 0;
    score += proximity;
    return { ...p, _score: score };
  });

  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...p }) => p);
}

/**
 * Batch-generate recommendations for multiple users (admin-triggered).
 * @param {string[]} userIds
 * @returns {Promise<{processed: number, errors: number}>}
 */
export async function batchGenerate(userIds) {
  let processed = 0;
  let errors    = 0;
  for (const uid of userIds) {
    try {
      await generateForUser(uid);
      processed++;
    } catch {
      errors++;
    }
  }
  return { processed, errors };
}
