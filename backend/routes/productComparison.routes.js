import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/productComparison.controller.js';

const router = Router();

// ── Public / guest routes ──────────────────────────────────────────────────

// GET /api/v1/comparisons/shared/:token
router.get(
  '/shared/:token',
  [param('token').trim().notEmpty().withMessage('token is required')],
  validate,
  ctrl.getSharedComparison,
);

// GET /api/v1/comparisons/attributes/:categoryId
router.get(
  '/attributes/:categoryId',
  [param('categoryId').isUUID().withMessage('categoryId must be a valid UUID')],
  validate,
  ctrl.getAttributes,
);

// ── Authenticated user routes ──────────────────────────────────────────────

// GET /api/v1/comparisons/my
router.get('/my', authenticate, ctrl.getMyComparisons);

// GET /api/v1/comparisons/config  (admin)
router.get('/config', authenticate, requireAdmin, ctrl.getConfig);

// PUT /api/v1/comparisons/config  (admin)
router.put(
  '/config',
  authenticate,
  requireAdmin,
  [
    body('max_products').optional().isInt({ min: 2, max: 20 }).withMessage('max_products must be an integer between 2 and 20'),
    body('comparison_enabled').optional().isIn(['true', 'false']).withMessage('comparison_enabled must be "true" or "false"'),
    body('sharing_enabled').optional().isIn(['true', 'false']).withMessage('sharing_enabled must be "true" or "false"'),
    body('guest_comparison').optional().isIn(['true', 'false']).withMessage('guest_comparison must be "true" or "false"'),
    body('mode').optional().isIn(['live', 'test']).withMessage('mode must be "live" or "test"'),
    body('highlight_differences').optional().isIn(['true', 'false']).withMessage('highlight_differences must be "true" or "false"'),
  ],
  validate,
  ctrl.updateConfig,
);

// POST /api/v1/comparisons  (optionally authenticated — guests allowed by config)
router.post(
  '/',
  optionalAuthenticate,
  [
    body('products').optional().isArray().withMessage('products must be an array'),
    body('name').optional().trim(),
    body('is_public').optional().isBoolean(),
  ],
  validate,
  ctrl.createComparison,
);

// GET /api/v1/comparisons/:id
router.get(
  '/:id',
  optionalAuthenticate,
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  validate,
  ctrl.getComparison,
);

// PUT /api/v1/comparisons/:id/products
router.put(
  '/:id/products',
  optionalAuthenticate,
  [
    param('id').isUUID().withMessage('id must be a valid UUID'),
    body('action').isIn(['add', 'remove']).withMessage('action must be "add" or "remove"'),
    body('product_id').isUUID().withMessage('product_id must be a valid UUID'),
  ],
  validate,
  ctrl.updateProducts,
);

// DELETE /api/v1/comparisons/:id
router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  validate,
  ctrl.deleteComparison,
);

export default router;
