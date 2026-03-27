/**
 * backend/controllers/recommendation.controller.js
 *
 * Handles all recommendation-related HTTP requests.
 */

import Recommendation from '../models/Recommendation.js';
import * as recService from '../services/recommendation.service.js';
import supabase from '../config/supabase.js';

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

// ─── GET /api/v1/recommendations ─────────────────────────────────────────────

/** Return personalised recommendations for the authenticated user. */
export async function getRecommendations(req, res, next) {
  try {
    const userId = req.user.id;
    const limit  = Math.min(parseInt(req.query.limit ?? '12', 10), 50);

    // Try to serve from cache first
    let recs = await Recommendation.getForUser(userId, limit);

    // If nothing stored (or all expired), generate on-the-fly
    if (!recs.length) {
      const generated = await recService.generateForUser(userId);
      recs = generated.slice(0, limit);
    }

    // Hydrate with product details if requested
    let data = recs;
    if (req.query.hydrate !== 'false' && recs.length) {
      const productIds = recs.map(r => r.product_id);
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, images, slug')
        .in('id', productIds);
      const prodMap = Object.fromEntries((products ?? []).map(p => [p.id, p]));
      data = recs.map(r => ({ ...r, product: prodMap[r.product_id] ?? null }));
    }

    return res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/recommendations/similar/:productId ──────────────────────────

/** Return products similar to a given product. */
export async function getSimilarProducts(req, res, next) {
  try {
    const { productId } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? '6', 10), 24);
    const products = await recService.getSimilarProducts(productId, limit);
    return res.json({ success: true, data: products, total: products.length });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/recommendations/frequently-bought/:productId ────────────────

/** Return frequently bought together products. */
export async function getFrequentlyBought(req, res, next) {
  try {
    const { productId } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? '6', 10), 24);

    const pairs = await Recommendation.getFrequentlyBoughtTogether(productId, limit);

    // Hydrate with product info
    let data = pairs;
    if (pairs.length) {
      const ids = pairs.map(p => p.product_id);
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, images, slug')
        .in('id', ids);
      const prodMap = Object.fromEntries((products ?? []).map(p => [p.id, p]));
      data = pairs.map(p => ({ ...p, product: prodMap[p.product_id] ?? null }));
    }

    return res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/recommendations/trending ────────────────────────────────────

/** Return trending products based on recent interaction volume. */
export async function getTrending(req, res, next) {
  try {
    const limit      = Math.min(parseInt(req.query.limit ?? '12', 10), 50);
    const withinHours = parseInt(req.query.hours ?? '48', 10);

    const trending = await Recommendation.getTrending(limit, withinHours);

    let data = trending;
    if (trending.length) {
      const ids = trending.map(t => t.product_id);
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, images, slug')
        .in('id', ids);
      const prodMap = Object.fromEntries((products ?? []).map(p => [p.id, p]));
      data = trending.map(t => ({ ...t, product: prodMap[t.product_id] ?? null }));
    }

    return res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

// ─── POST /api/v1/recommendations/interaction ─────────────────────────────────

/** Record a user's interaction with a product. */
export async function recordInteraction(req, res, next) {
  try {
    const userId = req.user?.id ?? req.body.user_id;
    const { product_id, interaction_type, metadata } = req.body;

    if (!userId)          return sendError(res, 401, 'Authentication required.');
    if (!product_id)      return sendError(res, 422, 'product_id is required.');
    if (!interaction_type) return sendError(res, 422, 'interaction_type is required.');

    const row = await Recommendation.recordInteraction(userId, product_id, interaction_type, metadata ?? null);
    return res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/recommendations/config ──────────────────────────────────────

/** Admin: get all recommendation config rows. */
export async function getConfig(req, res, next) {
  try {
    const rows = await Recommendation.getAllConfig();
    // Mask encrypted values
    const safe = rows.map(r => ({
      ...r,
      value: r.is_encrypted && r.value ? '••••••••' : r.value,
    }));
    return res.json({ success: true, data: safe });
  } catch (err) { next(err); }
}

// ─── PUT /api/v1/recommendations/config ──────────────────────────────────────

/** Admin: update one or more config key/value pairs. */
export async function updateConfig(req, res, next) {
  try {
    const updates = req.body; // { key: value, ... }
    if (!updates || typeof updates !== 'object') return sendError(res, 422, 'Body must be a JSON object of key:value pairs.');

    const results = [];
    for (const [key, value] of Object.entries(updates)) {
      const row = await Recommendation.setConfig(key, String(value), req.user.id);
      results.push(row);
    }
    return res.json({ success: true, data: results });
  } catch (err) { next(err); }
}

// ─── POST /api/v1/recommendations/config/test ────────────────────────────────

/** Admin: test the configured AI provider connection. */
export async function testAiConnection(req, res, next) {
  try {
    const result = await recService.testAiConnection();
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── POST /api/v1/recommendations/generate ───────────────────────────────────

/** Admin: trigger batch recommendation generation for all or specific users. */
export async function triggerBatchGenerate(req, res, next) {
  try {
    let { user_ids } = req.body;

    // If no specific users supplied, fetch all users
    if (!user_ids?.length) {
      const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .limit(500);
      if (error) throw error;
      user_ids = (users ?? []).map(u => u.id);
    }

    // Run async — return immediately with job status
    const stats = await recService.batchGenerate(user_ids);
    return res.json({ success: true, ...stats, total_users: user_ids.length });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/recommendations/analytics ───────────────────────────────────

/** Admin: get recommendation analytics (CTR, shown, clicked). */
export async function getAnalytics(req, res, next) {
  try {
    const analytics = await Recommendation.getAnalytics();
    return res.json({ success: true, data: analytics });
  } catch (err) { next(err); }
}
