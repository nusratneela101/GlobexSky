import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/tradeAssurance.controller.js';

const router = Router();

// ─── Policies ────────────────────────────────────────────────────────────────

// GET /api/v1/trade-assurance/policies — list active policies (public)
router.get(
  '/policies',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.listPolicies,
);

// GET /api/v1/trade-assurance/policies/:id — get a single policy (public)
router.get(
  '/policies/:id',
  [param('id').isUUID()],
  validate,
  ctrl.getPolicy,
);

// POST /api/v1/trade-assurance/policies — create policy (admin)
router.post(
  '/policies',
  authenticate,
  requireAdmin,
  [
    body('name').notEmpty().withMessage('name is required'),
    body('coverage_pct').isFloat({ min: 0, max: 100 }).withMessage('coverage_pct must be 0–100'),
    body('max_amount').isFloat({ gt: 0 }).withMessage('max_amount must be a positive number'),
    body('duration_days').isInt({ min: 1 }).withMessage('duration_days must be a positive integer'),
    body('description').optional().isString(),
    body('terms').optional().isString(),
  ],
  validate,
  ctrl.createPolicy,
);

// PUT /api/v1/trade-assurance/policies/:id — update policy (admin)
router.put(
  '/policies/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('coverage_pct').optional().isFloat({ min: 0, max: 100 }),
    body('max_amount').optional().isFloat({ gt: 0 }),
    body('duration_days').optional().isInt({ min: 1 }),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  ctrl.updatePolicy,
);

// ─── Claims ───────────────────────────────────────────────────────────────────

// GET /api/v1/trade-assurance/claims — list claims (buyer: own; admin: all)
router.get(
  '/claims',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'under_review', 'approved', 'rejected', 'resolved', 'closed']),
  ],
  validate,
  ctrl.listClaims,
);

// POST /api/v1/trade-assurance/claims — file a claim (authenticated buyer)
router.post(
  '/claims',
  authenticate,
  [
    body('order_id').isUUID().withMessage('order_id must be a valid UUID'),
    body('claim_amount').isFloat({ gt: 0 }).withMessage('claim_amount must be a positive number'),
    body('reason').notEmpty().withMessage('reason is required'),
    body('policy_id').optional().isUUID(),
    body('supplier_id').optional().isUUID(),
    body('description').optional().isString(),
    body('evidence_urls').optional().isArray(),
  ],
  validate,
  ctrl.fileClaim,
);

// GET /api/v1/trade-assurance/claims/:id — get claim details
router.get(
  '/claims/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getClaim,
);

// PUT /api/v1/trade-assurance/claims/:id/resolve — admin resolve claim
router.put(
  '/claims/:id/resolve',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('status')
      .isIn(['approved', 'rejected', 'resolved', 'closed'])
      .withMessage('status must be approved, rejected, resolved, or closed'),
    body('resolution').optional().isString(),
    body('resolution_amount').optional().isFloat({ min: 0 }),
  ],
  validate,
  ctrl.resolveClaim,
);

// ─── Deposits ─────────────────────────────────────────────────────────────────

// GET /api/v1/trade-assurance/deposits — list deposits
router.get(
  '/deposits',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.listDeposits,
);

// POST /api/v1/trade-assurance/deposits — supplier deposit
router.post(
  '/deposits',
  authenticate,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
    body('supplier_id').optional().isUUID(),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('reference').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  ctrl.createDeposit,
);

// PUT /api/v1/trade-assurance/deposits/:id/release — admin release deposit
router.put(
  '/deposits/:id/release',
  authenticate,
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.releaseDeposit,
);

// ─── Config ──────────────────────────────────────────────────────────────────

// GET /api/v1/trade-assurance/config — get current config
router.get(
  '/config',
  authenticate,
  ctrl.getConfig,
);

// PUT /api/v1/trade-assurance/config — admin update config
router.put(
  '/config',
  authenticate,
  requireAdmin,
  ctrl.updateConfig,
);

export default router;
