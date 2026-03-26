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
    query('status').optional().isIn(['pending', 'delivered', 'collected', 'returned', 'flagged', 'undelivered', 'redelivery_scheduled']),
    query('flagged').optional().isIn(['true', 'false']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getCodOrders,
);

// COD settings — admin only (GET and PUT, defined before /:id routes)
router.get('/settings', requireAdmin, ctrl.getCodSettings);
router.put(
  '/settings',
  requireAdmin,
  [
    body('enabled').optional().isBoolean(),
    body('surcharge_pct').optional().isFloat({ min: 0, max: 100 }),
    body('surcharge_fixed').optional().isFloat({ min: 0 }),
    body('min_order_amount').optional().isFloat({ min: 0 }),
    body('max_order_amount').optional().isFloat({ min: 0 }),
    body('allowed_regions').optional().isArray(),
    body('blocked_regions').optional().isArray(),
  ],
  validate,
  ctrl.updateCodSettings,
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

// Export COD report as CSV — admin only
router.get(
  '/export',
  requireAdmin,
  [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
    query('status').optional().isIn(['pending', 'delivered', 'collected', 'returned', 'flagged', 'undelivered']),
  ],
  validate,
  ctrl.exportCodReport,
);

// Bulk status update — admin only
router.post(
  '/bulk-status',
  requireAdmin,
  [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isUUID().withMessage('Each id must be a valid UUID'),
    body('status').isIn(['pending', 'delivered', 'collected', 'returned', 'flagged', 'undelivered']).withMessage('Invalid status'),
  ],
  validate,
  ctrl.bulkUpdateStatus,
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

// Update COD order status — admin only
router.patch(
  '/:id/status',
  requireAdmin,
  [
    param('id').isUUID(),
    body('status').isIn(['pending', 'delivered', 'collected', 'returned', 'flagged', 'undelivered', 'redelivery_scheduled']).withMessage('Invalid status'),
    body('notes').optional().isString(),
  ],
  validate,
  ctrl.updateCodStatus,
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
