import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireSupplier, requireAdmin } from '../middleware/roleCheck.js';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import * as ctrl from '../controllers/supplier.controller.js';

const router = Router();

// ── Public routes ──────────────────────────────────────────────────────────────

// GET / — list all verified suppliers (must come before /:id)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('country').optional().isString().trim(),
    query('category').optional().isString().trim(),
    query('verified').optional().isIn(['true', 'false']),
  ],
  validate,
  ctrl.listSuppliers,
);

// POST /register — register as a supplier (must come before /:id to avoid conflict)
router.post(
  '/register',
  [
    body('company_name').trim().notEmpty().withMessage('company_name is required'),
    body('country').trim().notEmpty().withMessage('country is required'),
    body('email').isEmail().withMessage('valid email is required'),
  ],
  validate,
  ctrl.registerSupplier,
);

// GET /top-rated MUST come before /:id to avoid Express matching 'top-rated' as an id
router.get('/top-rated', [query('limit').optional().isInt({ min: 1, max: 50 })], validate, ctrl.getTopRated);

// Public supplier info
router.get('/:id', ctrl.getSupplierProfile);
router.get('/:id/products', ctrl.getSupplierProducts);
router.get('/:id/scorecard', ctrl.getScorecard);

// ── Buyer routes ───────────────────────────────────────────────────────────────

router.post(
  '/:id/contact',
  authenticate,
  [
    param('id').isUUID(),
    body('subject').trim().notEmpty().withMessage('subject is required'),
    body('message').trim().notEmpty().withMessage('message is required'),
    body('product_reference').optional().isString().trim(),
    body('email').optional().isEmail(),
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

// ── Supplier-only dashboard routes ────────────────────────────────────────────

router.get('/dashboard/stats', authenticate, requireSupplier, ctrl.getDashboardStats);
router.get('/dashboard/profile', authenticate, requireSupplier, ctrl.getMyProfile);
router.put('/dashboard/profile', authenticate, requireSupplier, ctrl.updateSupplierProfile);
router.get('/dashboard/orders', authenticate, requireSupplier, ctrl.getSupplierOrders);
router.put(
  '/dashboard/orders/:id/status',
  authenticate,
  requireSupplier,
  [
    param('id').isUUID(),
    body('status').notEmpty().withMessage('status is required'),
    body('notes').optional().isString().trim(),
  ],
  validate,
  ctrl.updateOrderStatus,
);
router.get('/dashboard/analytics', authenticate, requireSupplier, ctrl.getSupplierAnalytics);
router.get('/dashboard/earnings', authenticate, requireSupplier, ctrl.getSupplierEarnings);

// Import sync endpoints (specific paths before :id routes)
router.get('/dashboard/products/import-status', authenticate, requireSupplier, ctrl.getImportStatus);
router.post('/dashboard/products/sync', authenticate, requireSupplier, ctrl.syncImportedProducts);

// Supplier products CRUD
router.get('/dashboard/products', authenticate, requireSupplier, ctrl.getMyProducts);
router.post('/dashboard/products', authenticate, requireSupplier, ctrl.createMyProduct);
router.put('/dashboard/products/:id', authenticate, requireSupplier, ctrl.updateMyProduct);
router.delete('/dashboard/products/:id', authenticate, requireSupplier, ctrl.deleteMyProduct);

export default router;
