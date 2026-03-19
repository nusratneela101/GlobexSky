import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/sourcingSolutions.controller.js';

const router = Router();

// POST /api/v1/sourcing-solutions/one-touch — One-touch sourcing order (authenticated)
router.post(
  '/one-touch',
  authenticate,
  [
    body('product_id').notEmpty().withMessage('product_id is required'),
    body('quantity').isInt({ gt: 0 }).withMessage('quantity must be a positive integer'),
    body('delivery_address').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  ctrl.createOneTouchOrder,
);

// GET /api/v1/sourcing-solutions/customization/:productId — Customization options (public)
router.get(
  '/customization/:productId',
  [param('productId').notEmpty()],
  validate,
  ctrl.getCustomizationOptions,
);

// POST /api/v1/sourcing-solutions/custom-request — Submit custom request (authenticated)
router.post(
  '/custom-request',
  authenticate,
  [
    body('product_name').notEmpty().withMessage('product_name is required'),
    body('quantity').isInt({ gt: 0 }).withMessage('quantity must be a positive integer'),
    body('description').optional().isString(),
    body('target_price').optional().isFloat({ gt: 0 }),
    body('delivery_deadline').optional().isISO8601(),
    body('specifications').optional().isObject(),
  ],
  validate,
  ctrl.submitCustomRequest,
);

// GET /api/v1/sourcing-solutions/quotes/:requestId — Get sourcing quotes (authenticated)
router.get(
  '/quotes/:requestId',
  authenticate,
  [param('requestId').isUUID()],
  validate,
  ctrl.getSourcingQuotes,
);

// POST /api/v1/sourcing-solutions/compare — Compare sourcing options (authenticated)
router.post(
  '/compare',
  authenticate,
  [
    body('options').isArray({ min: 1 }).withMessage('options must be a non-empty array'),
    body('options.*.unit_price').isFloat({ gt: 0 }).withMessage('unit_price must be positive'),
    body('options.*.lead_time_days').isInt({ gt: 0 }).withMessage('lead_time_days must be positive'),
  ],
  validate,
  ctrl.compareSourcingOptions,
);

export default router;
