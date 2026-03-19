import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireCarrier } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/cod.controller.js';

const router = Router();

router.use(authenticate);

// Create a new COD order (buyer or admin)
router.post(
  '/',
  [
    body('order_id').notEmpty().withMessage('order_id is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
    body('carrier_id').optional().isUUID(),
    body('address').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  ctrl.createCodOrder,
);

// List COD orders — admin sees all, carrier sees own
router.get(
  '/',
  [
    query('status').optional().isIn(['pending', 'delivered', 'collected', 'returned', 'flagged']),
    query('flagged').optional().isIn(['true', 'false']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getCodOrders,
);

// Reconciliation report — admin only
router.get(
  '/report',
  requireAdmin,
  [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
  ],
  validate,
  ctrl.getCodReport,
);

// COD analytics — admin only
router.get(
  '/analytics',
  requireAdmin,
  [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
  ],
  validate,
  ctrl.getCodAnalytics,
);

// Confirm delivery — carrier or admin
router.patch(
  '/:id/confirm-delivery',
  requireCarrier,
  [param('id').isUUID()],
  validate,
  ctrl.confirmCodDelivery,
);

// Confirm cash collection — admin only
router.patch(
  '/:id/confirm-collection',
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.confirmCodCollection,
);

// Flag as fraudulent — admin only
router.patch(
  '/:id/flag',
  requireAdmin,
  [param('id').isUUID(), body('reason').optional().isString()],
  validate,
  ctrl.flagFraudulent,
);

export default router;
