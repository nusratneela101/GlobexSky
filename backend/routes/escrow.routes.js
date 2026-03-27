import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/escrow.controller.js';

const router = Router();

router.use(authenticate);

// ─── Config routes (no :id param — must come BEFORE /:id wildcard) ────────────

/** GET /api/v1/escrow/config — admin: get all config entries */
router.get('/config', requireAdmin, ctrl.getConfig);

/** PUT /api/v1/escrow/config — admin: update config key/value pairs */
router.put('/config', requireAdmin, ctrl.updateConfig);

/** POST /api/v1/escrow/config/test-connection — admin: verify gateway credentials */
router.post('/config/test-connection', requireAdmin, ctrl.testGatewayConnection);

// ─── Escrow CRUD ──────────────────────────────────────────────────────────────

/** POST /api/v1/escrow — create escrow for an order */
router.post(
  '/',
  [
    body('order_id').isUUID(),
    body('buyer_id').isUUID(),
    body('supplier_id').isUUID(),
    body('amount').isFloat({ min: 0.01 }),
    body('currency').optional().isString().isLength({ min: 3, max: 10 }),
  ],
  validate,
  ctrl.createEscrow,
);

/** GET /api/v1/escrow/:id — get escrow details */
router.get('/:id', [param('id').isUUID()], validate, ctrl.getEscrow);

/** POST /api/v1/escrow/:id/release — release funds */
router.post('/:id/release', [param('id').isUUID()], validate, ctrl.releaseEscrow);

/** POST /api/v1/escrow/:id/refund — refund to buyer */
router.post(
  '/:id/refund',
  [param('id').isUUID(), body('reason').optional().trim()],
  validate,
  ctrl.refundEscrow,
);

/** POST /api/v1/escrow/:id/milestones — add milestone */
router.post(
  '/:id/milestones',
  [
    param('id').isUUID(),
    body('name').notEmpty().trim(),
    body('amount').isFloat({ min: 0.01 }),
    body('due_date').optional().isISO8601(),
  ],
  validate,
  ctrl.addMilestone,
);

/** PUT /api/v1/escrow/:id/milestones/:milestoneId/complete — mark milestone complete */
router.put(
  '/:id/milestones/:milestoneId/complete',
  [param('id').isUUID(), param('milestoneId').isUUID()],
  validate,
  ctrl.completeMilestone,
);

/** GET /api/v1/escrow/:id/audit — get audit log */
router.get(
  '/:id/audit',
  [
    param('id').isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getAuditLog,
);

export default router;
