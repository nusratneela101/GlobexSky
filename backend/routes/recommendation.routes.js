/**
 * backend/routes/recommendation.routes.js
 *
 * All recommendation endpoints under /api/v1/recommendations
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/recommendation.controller.js';

const router = Router();

// ─── Config routes (no :id wildcard — must come first) ────────────────────────

/** GET /api/v1/recommendations/config — admin: get config */
router.get('/config', authenticate, requireAdmin, ctrl.getConfig);

/** PUT /api/v1/recommendations/config — admin: update config */
router.put(
  '/config',
  authenticate,
  requireAdmin,
  [body().isObject().withMessage('Body must be a JSON object')],
  validate,
  ctrl.updateConfig,
);

/** POST /api/v1/recommendations/config/test — admin: test AI provider */
router.post('/config/test', authenticate, requireAdmin, ctrl.testAiConnection);

/** POST /api/v1/recommendations/generate — admin: trigger batch generation */
router.post(
  '/generate',
  authenticate,
  requireAdmin,
  [body('user_ids').optional().isArray()],
  validate,
  ctrl.triggerBatchGenerate,
);

/** GET /api/v1/recommendations/analytics — admin analytics */
router.get('/analytics', authenticate, requireAdmin, ctrl.getAnalytics);

// ─── Public / user routes ─────────────────────────────────────────────────────

/** GET /api/v1/recommendations — personalised recommendations */
router.get(
  '/',
  authenticate,
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  ctrl.getRecommendations,
);

/** POST /api/v1/recommendations/interaction — record user interaction */
router.post(
  '/interaction',
  optionalAuthenticate,
  [
    body('product_id').isUUID(),
    body('interaction_type').isIn(['view', 'click', 'cart', 'purchase', 'wishlist']),
    body('metadata').optional().isObject(),
  ],
  validate,
  ctrl.recordInteraction,
);

/** GET /api/v1/recommendations/trending — trending products */
router.get(
  '/trending',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('hours').optional().isInt({ min: 1, max: 168 }),
  ],
  validate,
  ctrl.getTrending,
);

/** GET /api/v1/recommendations/similar/:productId — similar products */
router.get(
  '/similar/:productId',
  [
    param('productId').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 24 }),
  ],
  validate,
  ctrl.getSimilarProducts,
);

/** GET /api/v1/recommendations/frequently-bought/:productId */
router.get(
  '/frequently-bought/:productId',
  [
    param('productId').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 24 }),
  ],
  validate,
  ctrl.getFrequentlyBought,
);

export default router;
