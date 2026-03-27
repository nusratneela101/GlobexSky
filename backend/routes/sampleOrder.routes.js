import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/sampleOrder.controller.js';

const router = Router();

// All sample-order routes require authentication
router.use(authenticate);

// ─── Buyer routes ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/samples
 * Request a new product sample.
 */
router.post('/',
  [
    body('supplier_id').isUUID().withMessage('supplier_id must be a valid UUID'),
    body('product_id').isUUID().withMessage('product_id must be a valid UUID'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be a positive integer'),
    body('shipping_address_id').optional().isUUID(),
    body('message').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  ctrl.requestSample,
);

/**
 * GET /api/v1/samples/buyer/my
 * List the authenticated buyer's sample requests.
 * NOTE: Must come before /:id to avoid being treated as a UUID param.
 */
router.get('/buyer/my',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getBuyerSamples,
);

/**
 * GET /api/v1/samples/supplier/my
 * List the authenticated supplier's received sample requests.
 * NOTE: Must come before /:id.
 */
router.get('/supplier/my',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getSupplierSamples,
);

/**
 * GET /api/v1/samples/config
 * Get admin sample-order configuration (admin only).
 * NOTE: Must come before /:id.
 */
router.get('/config', ctrl.getAdminConfig);

/**
 * PUT /api/v1/samples/config
 * Update admin sample-order configuration (admin only).
 */
router.put('/config',
  [
    body('max_samples_per_buyer').optional().isInt({ min: 1 }),
    body('max_samples_per_product').optional().isInt({ min: 1 }),
    body('free_sample_eligible_min_order').optional().isFloat({ min: 0 }),
    body('auto_approve_verified_suppliers').optional().isBoolean(),
    body('sample_request_cooldown_days').optional().isInt({ min: 0 }),
    body('feature_enabled').optional().isBoolean(),
    body('mode').optional().isIn(['test', 'live']),
  ],
  validate,
  ctrl.updateAdminConfig,
);

/**
 * GET /api/v1/samples/:id
 * Get details of a single sample order.
 */
router.get('/:id',
  [param('id').isUUID()],
  validate,
  ctrl.getSampleOrder,
);

/**
 * PUT /api/v1/samples/:id/approve
 * Supplier approves a pending sample request.
 */
router.put('/:id/approve',
  [
    param('id').isUUID(),
    body('cost').optional().isFloat({ min: 0 }),
    body('is_free').optional().isBoolean(),
    body('supplier_notes').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  ctrl.approveSample,
);

/**
 * PUT /api/v1/samples/:id/reject
 * Supplier rejects a pending sample request.
 */
router.put('/:id/reject',
  [
    param('id').isUUID(),
    body('reason').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  ctrl.rejectSample,
);

/**
 * PUT /api/v1/samples/:id/ship
 * Supplier marks a sample as shipped.
 */
router.put('/:id/ship',
  [
    param('id').isUUID(),
    body('tracking_number').notEmpty().withMessage('tracking_number is required'),
  ],
  validate,
  ctrl.shipSample,
);

/**
 * PUT /api/v1/samples/:id/deliver
 * Buyer confirms delivery of the sample.
 */
router.put('/:id/deliver',
  [param('id').isUUID()],
  validate,
  ctrl.deliverSample,
);

/**
 * PUT /api/v1/samples/:id/feedback
 * Buyer adds feedback and rating.
 */
router.put('/:id/feedback',
  [
    param('id').isUUID(),
    body('buyer_feedback').optional().isString().isLength({ max: 2000 }),
    body('buyer_rating').optional().isInt({ min: 1, max: 5 }),
  ],
  validate,
  ctrl.addFeedback,
);

export default router;
