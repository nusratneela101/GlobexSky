/**
 * backend/controllers/imageSearch.controller.js
 *
 * Controller for AI Image Search API endpoints.
 * Handles file upload (via multer), URL-based search, history, and admin config.
 */

import multer from 'multer';
import ImageSearch from '../models/ImageSearch.js';
import * as imageSearchService from '../services/imageSearch.service.js';

// ─── Multer — memory storage (we work with Buffer/base64) ─────────────────────

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB default

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Invalid file type. Allowed: jpg, jpeg, png, webp'));
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, error: message });
}

/** Check whether image search is enabled (returns false in test mode if disabled). */
async function isEnabled() {
  const val = await ImageSearch.getConfigValue('feature_enabled');
  return val === 'true';
}

// ─── POST /api/v1/image-search/upload ────────────────────────────────────────

/**
 * Upload an image file and return similar products.
 * Accepts multipart/form-data with field "image".
 */
export async function searchByUpload(req, res, next) {
  try {
    if (!req.file) return sendError(res, 400, 'No image file provided. Use field name "image".');

    const enabled = await isEnabled();
    if (!enabled) return sendError(res, 403, 'Image search is not enabled. Contact an administrator.');

    const start = Date.now();
    const base64 = req.file.buffer.toString('base64');

    const { features, provider } = await imageSearchService.analyzeImage(base64);
    const cfg = await ImageSearch.getConfigValue('max_results');
    const maxResults = parseInt(cfg, 10) || 20;
    const results = await imageSearchService.findSimilarProducts(features, maxResults);

    const processingTimeMs = Date.now() - start;

    // Save to history (non-blocking)
    ImageSearch.saveSearch({
      user_id: req.user?.id || null,
      image_url: null,
      search_type: 'upload',
      results,
      provider,
      processing_time_ms: processingTimeMs,
    }).catch(() => {});

    return res.json({
      success: true,
      data: results,
      meta: {
        provider,
        features: { tags: features.tags?.slice(0, 10), category: features.category },
        processing_time_ms: processingTimeMs,
        total: results.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/image-search/url ───────────────────────────────────────────

/**
 * Search by image URL.
 * Body: { image_url: string }
 */
export async function searchByUrl(req, res, next) {
  try {
    const { image_url } = req.body;
    if (!image_url) return sendError(res, 400, 'image_url is required.');

    const enabled = await isEnabled();
    if (!enabled) return sendError(res, 403, 'Image search is not enabled. Contact an administrator.');

    const start = Date.now();
    const base64 = await imageSearchService.fetchImageAsBase64(image_url);
    const { features, provider } = await imageSearchService.analyzeImage(base64);
    const cfg = await ImageSearch.getConfigValue('max_results');
    const maxResults = parseInt(cfg, 10) || 20;
    const results = await imageSearchService.findSimilarProducts(features, maxResults);

    const processingTimeMs = Date.now() - start;

    ImageSearch.saveSearch({
      user_id: req.user?.id || null,
      image_url,
      search_type: 'url',
      results,
      provider,
      processing_time_ms: processingTimeMs,
    }).catch(() => {});

    return res.json({
      success: true,
      data: results,
      meta: {
        provider,
        features: { tags: features.tags?.slice(0, 10), category: features.category },
        processing_time_ms: processingTimeMs,
        total: results.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/image-search/history ────────────────────────────────────────

/** Get the authenticated user's search history. Admin sees all. */
export async function getHistory(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const isAdmin = req.user?.role === 'admin';

    const result = isAdmin
      ? await ImageSearch.getHistory({ page: Number(page), limit: Number(limit) })
      : await ImageSearch.getByUser(req.user.id, { page: Number(page), limit: Number(limit) });

    return res.json({
      success: true,
      data: result.data,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/image-search/config ─────────────────────────────────────────

/** Admin: get all config entries (encrypted values masked). */
export async function getConfig(req, res, next) {
  try {
    const rows = await ImageSearch.getConfig();
    const safe = rows.map((r) => ({
      ...r,
      value: r.is_encrypted ? (r.value ? '••••••••' : '') : r.value,
    }));
    return res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/v1/image-search/config ─────────────────────────────────────────

/** Admin: update config key/value pairs. */
export async function updateConfig(req, res, next) {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return sendError(res, 400, 'Request body must be a key→value object.');
    }
    const actorId = req.user.id;
    // Strip out masked values — don't overwrite a real key with bullets
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== '••••••••'),
    );
    const results = await imageSearchService.saveConfig(filtered, actorId);
    return res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/image-search/config/test ───────────────────────────────────

/** Admin: test provider connection. Body: { provider? } */
export async function testProviderConnection(req, res, next) {
  try {
    const { provider } = req.body;
    const result = await imageSearchService.testProviderConnection(provider || null);
    return res.json({ success: result.success, message: result.message, provider: result.provider });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/image-search/stats ──────────────────────────────────────────

/** Admin: get search usage statistics. */
export async function getStats(req, res, next) {
  try {
    const stats = await ImageSearch.getStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}
