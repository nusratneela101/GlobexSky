import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireSupplier, requireAdmin } from '../middleware/roleCheck.js';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import * as ctrl from '../controllers/supplier.controller.js';

const router = Router();

// ── Public routes ──────────────────────────────────────────────────────────────

// GET /top-rated MUST come before /:id to avoid Express matching 'top-rated' as an id
router.get('/top-rated', [query('limit').optional().isInt({ min: 1, max: 50 })], validate, ctrl.getTopRated);

// Public supplier info
router.get('/:id', ctrl.getSupplierProfile);
router.get('/:id/products', ctrl.getSupplierProducts);
router.get('/:id/scorecard', ctrl.getScorecard);

// ── Buyer routes ───────────────────────────────────────────────────────────────

router.post(
  '/:id/evaluate',
  authenticate,
  [
    param('id').isUUID(),
    body('quality_score').isFloat({ min: 0, max: 5 }).withMessage('quality_score must be 0–5'),
    body('delivery_score').isFloat({ min: 0, max: 5 }).withMessage('delivery_score must be 0–5'),
    body('communication_score').isFloat({ min: 0, max: 5 }).withMessage('communication_score must be 0–5'),
    body('pricing_score').isFloat({ min: 0, max: 5 }).withMessage('pricing_score must be 0–5'),
    body('review_text').optional().isString().trim().isLength({ max: 2000 }),
    body('order_id').optional().isUUID(),
  ],
  validate,
  ctrl.evaluateSupplier,
);

// ── Admin routes ───────────────────────────────────────────────────────────────

router.put(
  '/:id/scorecard',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('overall_score').isFloat({ min: 0, max: 100 }),
    body('quality_score').isFloat({ min: 0, max: 100 }),
    body('delivery_score').isFloat({ min: 0, max: 100 }),
    body('communication_score').isFloat({ min: 0, max: 100 }),
    body('pricing_score').isFloat({ min: 0, max: 100 }),
  ],
  validate,
  ctrl.updateScorecard,
);

// ── Supplier-only dashboard routes ────────────────────────────────────────────

router.get('/dashboard/stats', authenticate, requireSupplier, ctrl.getDashboardStats);
router.put('/dashboard/profile', authenticate, requireSupplier, ctrl.updateSupplierProfile);
router.get('/dashboard/orders', authenticate, requireSupplier, ctrl.getSupplierOrders);
router.get('/dashboard/analytics', authenticate, requireSupplier, ctrl.getSupplierAnalytics);
router.get('/dashboard/earnings', authenticate, requireSupplier, ctrl.getSupplierEarnings);

export default router;
