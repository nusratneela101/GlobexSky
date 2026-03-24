/**
 * Admin Disputes Routes
 */

import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/disputeController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Static routes before parameterized routes
// GET /api/admin/disputes/stats
router.get('/stats', ctrl.getDisputeStats);

// GET /api/admin/disputes
router.get('/', ctrl.getDisputes);

// GET /api/admin/disputes/:id
router.get('/:id', [param('id').isUUID()], validate, ctrl.getDisputeById);

// POST /api/admin/disputes/:id/assign
router.post(
  '/:id/assign',
  [param('id').isUUID(), body('adminId').isUUID()],
  validate,
  ctrl.assignMediator,
);

// POST /api/admin/disputes/:id/resolve
router.post(
  '/:id/resolve',
  [param('id').isUUID(), body('resolution').notEmpty()],
  validate,
  ctrl.addResolution,
);

// POST /api/admin/disputes/:id/escalate
router.post(
  '/:id/escalate',
  [param('id').isUUID(), body('reason').notEmpty()],
  validate,
  ctrl.escalateDispute,
);

// POST /api/admin/disputes/:id/close
router.post(
  '/:id/close',
  [param('id').isUUID(), body('outcome').notEmpty()],
  validate,
  ctrl.closeDispute,
);

export default router;
