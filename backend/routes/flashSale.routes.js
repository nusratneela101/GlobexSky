import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/flashSale.controller.js';

const router = Router();

// ─── Public Routes ───────────────────────────────────────────────────────────
router.get('/active', ctrl.getActiveFlashSales);
router.get('/upcoming', ctrl.getUpcomingFlashSales);

// ─── Admin Routes ────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('starts_at').isISO8601().withMessage('Valid start date is required'),
    body('ends_at').isISO8601().withMessage('Valid end date is required'),
    body('max_orders').optional().isInt({ gt: 0 }),
  ],
  validate,
  ctrl.createFlashSale,
);

router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('starts_at').optional().isISO8601(),
    body('ends_at').optional().isISO8601(),
    body('status').optional().isIn(['draft', 'scheduled', 'active', 'ended', 'cancelled']),
  ],
  validate,
  ctrl.updateFlashSale,
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.cancelFlashSale,
);

router.get(
  '/:id/analytics',
  authenticate,
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.getFlashSaleAnalytics,
);

router.post(
  '/:id/products',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('products').isArray({ min: 1 }).withMessage('products must be a non-empty array'),
    body('products.*.productId').isUUID().withMessage('Each product must have a valid productId'),
    body('products.*.originalPrice').isFloat({ gt: 0 }).withMessage('originalPrice must be positive'),
    body('products.*.salePrice').isFloat({ gt: 0 }).withMessage('salePrice must be positive'),
  ],
  validate,
  ctrl.addProductsToSale,
);

export default router;
