import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/coupon.controller.js';

const router = Router();

// ─── Buyer: public/optional-auth routes (order matters — before /:id) ────────

/** GET /api/v1/coupons/available — list available coupons */
router.get('/available', ctrl.listAvailableCoupons);

/** POST /api/v1/coupons/validate — validate coupon code for cart */
router.post(
  '/validate',
  optionalAuthenticate,
  [
    body('code').isString().trim().notEmpty().withMessage('code is required'),
    body('cart_total').isFloat({ min: 0 }).withMessage('cart_total must be a non-negative number'),
  ],
  validate,
  ctrl.validateCoupon
);

/** POST /api/v1/coupons/apply — apply coupon to order */
router.post(
  '/apply',
  authenticate,
  [
    body('code').isString().trim().notEmpty().withMessage('code is required'),
    body('cart_total').isFloat({ min: 0 }).withMessage('cart_total must be a non-negative number'),
    body('order_id').optional().isUUID().withMessage('order_id must be a valid UUID'),
  ],
  validate,
  ctrl.applyCoupon
);

/** GET /api/v1/coupons/my-usage — authenticated buyer: my coupon history */
router.get('/my-usage', authenticate, ctrl.myUsage);

// ─── Authenticated routes ────────────────────────────────────────────────────

router.use(authenticate);

/** GET /api/v1/coupons — admin: list all coupons */
router.get('/', ctrl.listCoupons);

/** POST /api/v1/coupons — admin: create coupon */
router.post(
  '/',
  [
    body('code').isString().trim().notEmpty().withMessage('code is required'),
    body('type').isIn(['percentage', 'fixed', 'free_shipping']).withMessage('type must be percentage, fixed, or free_shipping'),
    body('value').isFloat({ min: 0 }).withMessage('value must be a non-negative number'),
    body('valid_from').optional().isISO8601().withMessage('valid_from must be ISO 8601 date'),
    body('valid_until').optional().isISO8601().withMessage('valid_until must be ISO 8601 date'),
  ],
  validate,
  ctrl.createCoupon
);

/** GET /api/v1/coupons/:id — get coupon details */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  validate,
  ctrl.getCoupon
);

/** PUT /api/v1/coupons/:id — admin: update coupon */
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('id must be a valid UUID'),
    body('type').optional().isIn(['percentage', 'fixed', 'free_shipping']),
    body('value').optional().isFloat({ min: 0 }),
    body('valid_from').optional().isISO8601(),
    body('valid_until').optional().isISO8601(),
  ],
  validate,
  ctrl.updateCoupon
);

/** DELETE /api/v1/coupons/:id — admin: deactivate coupon */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  validate,
  ctrl.deactivateCoupon
);

export default router;
