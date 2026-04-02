import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireSupplier, requireAdmin } from '../middleware/roleCheck.js';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import * as ctrl from '../controllers/supplier.controller.js';

const router = Router();

// ── Public routes ──────────────────────────────────────────────────────────────

// GET / — list all suppliers (must come before /:id)
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('country').optional().trim(),
  query('verified').optional().isBoolean(),
], validate, ctrl.listSuppliers);

// POST /register — register as a supplier (before /:id to avoid collision)
router.post(
  '/register',
  [
    body('company_name').trim().notEmpty().withMessage('company_name is required'),
    body('business_type').trim().notEmpty().withMessage('business_type is required'),
    body('country').trim().notEmpty().withMessage('country is required'),
    body('email').isEmail().withMessage('valid email is required'),
  ],
  validate,
  ctrl.registerSupplier,
);

// GET /top-rated MUST come before /:id to avoid Express matching 'top-rated' as an id
router.get('/top-rated', [query('limit').optional().isInt({ min: 1, max: 50 })], validate, ctrl.getTopRated);

// ── Supplier-only dashboard routes (must come before /:id) ───────────────────

router.get('/dashboard/stats', authenticate, requireSupplier, ctrl.getDashboardStats);
router.put('/dashboard/profile', authenticate, requireSupplier, ctrl.updateSupplierProfile);
router.get('/dashboard/orders', authenticate, requireSupplier, ctrl.getSupplierOrders);
router.put('/dashboard/orders/:id/status', authenticate, requireSupplier, [
  param('id').isUUID(),
  body('status').notEmpty().withMessage('status is required'),
], validate, ctrl.updateOrderStatus);
router.get('/dashboard/analytics', authenticate, requireSupplier, ctrl.getSupplierAnalytics);
router.get('/dashboard/earnings', authenticate, requireSupplier, ctrl.getSupplierEarnings);

// Dashboard product management
router.get('/dashboard/products', authenticate, requireSupplier, ctrl.getDashboardProducts);
router.post('/dashboard/products', authenticate, requireSupplier, [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('price').isFloat({ min: 0 }).withMessage('price must be a non-negative number'),
], validate, ctrl.createDashboardProduct);
router.put('/dashboard/products/:id', authenticate, requireSupplier, [param('id').isUUID()], validate, ctrl.updateDashboardProduct);
router.delete('/dashboard/products/:id', authenticate, requireSupplier, [param('id').isUUID()], validate, ctrl.deleteDashboardProduct);

// Import sync endpoints
router.get('/dashboard/products/import-status', authenticate, requireSupplier, ctrl.getImportStatus);
router.post('/dashboard/products/sync', authenticate, requireSupplier, ctrl.syncImportedProducts);

// ── Public supplier info (/:id must come after fixed-path routes) ─────────────

router.get('/:id', ctrl.getSupplierProfile);
router.get('/:id/products', ctrl.getSupplierProducts);
router.get('/:id/scorecard', ctrl.getScorecard);

// ── Buyer routes ───────────────────────────────────────────────────────────────

router.post(
  '/:id/contact',
  [
    param('id').isUUID(),
    body('message').trim().notEmpty().withMessage('message is required'),
    body('subject').optional().trim(),
    body('product_id').optional().isUUID(),
    body('buyer_name').optional().trim(),
    body('buyer_email').optional().isEmail(),
    body('buyer_phone').optional().trim(),
  ],
  validate,
  ctrl.contactSupplier,
);

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

export default router;
