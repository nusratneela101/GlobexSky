import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/refund.controller.js';

const router = Router();

router.use(authenticate);

// Buyer & Admin — list refunds
router.get(
  '/',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  ctrl.getRefunds,
);

// Buyer — initiate a refund request
router.post(
  '/',
  [
    body('order_id').isUUID(),
    body('dispute_id').optional().isUUID(),
    body('amount').isFloat({ min: 0.01 }),
    body('reason').notEmpty().trim(),
  ],
  validate,
  ctrl.initiateRefund,
);

// Buyer & Admin — get single refund
router.get('/:id', [param('id').isUUID()], validate, ctrl.getRefundById);

// Admin — approve a refund
router.post('/:id/approve', requireAdmin, [param('id').isUUID()], validate, ctrl.approveRefund);

// Admin — reject a refund
router.post(
  '/:id/reject',
  requireAdmin,
  [param('id').isUUID(), body('reason').optional().trim()],
  validate,
  ctrl.rejectRefund,
);

// Admin — mark refund as processed (money sent)
router.post('/:id/process', requireAdmin, [param('id').isUUID()], validate, ctrl.processRefund);

export default router;
