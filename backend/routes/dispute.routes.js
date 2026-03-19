import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/dispute.controller.js';

const router = Router();

router.use(authenticate);

// Buyer & Admin — list disputes
router.get(
  '/',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  ctrl.getDisputes,
);

// Buyer — create a dispute
router.post(
  '/',
  [
    body('order_id').isUUID(),
    body('type').notEmpty().trim(),
    body('reason').notEmpty().trim(),
    body('description').notEmpty().trim(),
  ],
  validate,
  ctrl.createDispute,
);

// Buyer & Admin — get single dispute
router.get('/:id', [param('id').isUUID()], validate, ctrl.getDisputeById);

// Buyer — update their own dispute
router.patch(
  '/:id',
  [param('id').isUUID(), body('reason').optional().trim(), body('description').optional().trim()],
  validate,
  ctrl.updateDispute,
);

// Admin — resolve a dispute
router.post(
  '/:id/resolve',
  requireAdmin,
  [param('id').isUUID(), body('resolution').notEmpty().trim()],
  validate,
  ctrl.resolveDispute,
);

// Buyer & Admin — escalate a dispute
router.post('/:id/escalate', [param('id').isUUID()], validate, ctrl.escalateDispute);

// Buyer & Admin — add a message to a dispute thread
router.post(
  '/:id/messages',
  [param('id').isUUID(), body('message').notEmpty().trim()],
  validate,
  ctrl.addDisputeMessage,
);

export default router;
