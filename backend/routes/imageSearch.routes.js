import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.js';
import * as ctrl from '../controllers/imageSearch.controller.js';

const router = Router();

// ─── Public / optional-auth routes ───────────────────────────────────────────

/**
 * POST /api/v1/image-search/upload
 * Upload an image file (multipart/form-data, field: "image") and find similar products.
 */
router.post(
  '/upload',
  uploadRateLimiter,
  optionalAuthenticate,
  ctrl.upload.single('image'),
  ctrl.searchByUpload,
);

/**
 * POST /api/v1/image-search/url
 * Search by image URL.
 * Body: { image_url: string }
 */
router.post(
  '/url',
  uploadRateLimiter,
  optionalAuthenticate,
  [body('image_url').trim().notEmpty().withMessage('image_url is required').isURL()],
  validate,
  ctrl.searchByUrl,
);

// ─── Authenticated routes ─────────────────────────────────────────────────────

/**
 * GET /api/v1/image-search/history
 * Get search history for the authenticated user (admin sees all).
 * Query params: page, limit
 */
router.get(
  '/history',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getHistory,
);

// ─── Admin-only routes (must come BEFORE /:id wildcards) ──────────────────────

/**
 * GET /api/v1/image-search/config
 * Admin: retrieve all config entries (encrypted values masked).
 */
router.get('/config', authenticate, requireAdmin, ctrl.getConfig);

/**
 * PUT /api/v1/image-search/config
 * Admin: update config key→value pairs.
 * Body: { key: value, … }
 */
router.put('/config', authenticate, requireAdmin, ctrl.updateConfig);

/**
 * POST /api/v1/image-search/config/test
 * Admin: test a provider connection.
 * Body: { provider?: string }
 */
router.post(
  '/config/test',
  authenticate,
  requireAdmin,
  [body('provider').optional().isString()],
  validate,
  ctrl.testProviderConnection,
);

/**
 * GET /api/v1/image-search/stats
 * Admin: get usage statistics.
 */
router.get('/stats', authenticate, requireAdmin, ctrl.getStats);

export default router;
