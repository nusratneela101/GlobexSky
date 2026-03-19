import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/tradeFinance.controller.js';

const router = Router();

// ─── Letter of Credit ────────────────────────────────────────────────────────

// POST /api/v1/trade-finance/lc — Create a new LC (authenticated)
router.post(
  '/lc',
  authenticate,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
    body('expiry_date').isISO8601().withMessage('expiry_date must be a valid date'),
    body('beneficiary_id').optional().isUUID(),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('terms').optional().isString(),
    body('goods_description').optional().isString(),
  ],
  validate,
  ctrl.createLC,
);

// GET /api/v1/trade-finance/lc/:id — Get LC details (authenticated)
router.get(
  '/lc/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getLCDetails,
);

// PATCH /api/v1/trade-finance/lc/:id/status — Update LC status (admin)
router.patch(
  '/lc/:id/status',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('status').isIn(['issued', 'accepted', 'fulfilled', 'closed']).withMessage('Invalid status value'),
  ],
  validate,
  ctrl.updateLCStatus,
);

// ─── Escrow ──────────────────────────────────────────────────────────────────

// POST /api/v1/trade-finance/escrow — Create escrow payment (authenticated)
router.post(
  '/escrow',
  authenticate,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
    body('seller_id').optional().isUUID(),
    body('order_id').optional().isUUID(),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('conditions').optional().isString(),
  ],
  validate,
  ctrl.createEscrow,
);

// PATCH /api/v1/trade-finance/escrow/:id/release — Release escrow funds (admin)
router.patch(
  '/escrow/:id/release',
  authenticate,
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.releaseEscrow,
);

// ─── Invoice Factoring ───────────────────────────────────────────────────────

// POST /api/v1/trade-finance/invoice-factoring — Submit invoice for factoring (authenticated)
router.post(
  '/invoice-factoring',
  authenticate,
  [
    body('invoice_number').notEmpty().withMessage('invoice_number is required'),
    body('invoice_amount').isFloat({ gt: 0 }).withMessage('invoice_amount must be a positive number'),
    body('debtor_name').notEmpty().withMessage('debtor_name is required'),
    body('due_date').isISO8601().withMessage('due_date must be a valid date'),
    body('advance_rate').optional().isFloat({ gt: 0, lt: 1 }),
    body('discount_fee_rate').optional().isFloat({ gt: 0, lt: 1 }),
  ],
  validate,
  ctrl.createInvoiceFactoring,
);

// ─── Analytics ───────────────────────────────────────────────────────────────

// GET /api/v1/trade-finance/analytics — Dashboard analytics (admin)
router.get(
  '/analytics',
  authenticate,
  requireAdmin,
  [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
  ],
  validate,
  ctrl.getTradeFinanceAnalytics,
);

export default router;
