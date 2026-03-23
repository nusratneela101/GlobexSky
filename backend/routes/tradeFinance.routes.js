import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/tradeFinance.controller.js';

const router = Router();

// ─── Letter of Credit — list ──────────────────────────────────────────────────

// GET /api/v1/trade-finance/lc — List LCs for authenticated user
router.get(
  '/lc',
  authenticate,
  ctrl.listLCs,
);

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

// POST /api/v1/trade-finance/lc/:id/amendment — Submit LC amendment request (authenticated)
router.post(
  '/lc/:id/amendment',
  authenticate,
  [
    param('id').isUUID(),
    body('field').notEmpty().withMessage('field is required'),
    body('new_value').notEmpty().withMessage('new_value is required'),
    body('reason').optional().isString(),
  ],
  validate,
  ctrl.createLCAmendment,
);

// ─── Escrow ──────────────────────────────────────────────────────────────────

// GET /api/v1/trade-finance/escrow — List escrow payments for authenticated user
router.get(
  '/escrow',
  authenticate,
  ctrl.listEscrow,
);

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

// PATCH /api/v1/trade-finance/escrow/:id/refund — Refund escrow to buyer (admin)
router.patch(
  '/escrow/:id/refund',
  authenticate,
  requireAdmin,
  [param('id').isUUID()],
  validate,
  ctrl.refundEscrow,
);

// POST /api/v1/trade-finance/escrow/:id/dispute — File a dispute on an escrow (authenticated)
router.post(
  '/escrow/:id/dispute',
  authenticate,
  [
    param('id').isUUID(),
    body('reason').notEmpty().withMessage('reason is required'),
    body('description').optional().isString(),
  ],
  validate,
  ctrl.fileEscrowDispute,
);

// ─── Invoice Factoring ───────────────────────────────────────────────────────

// GET /api/v1/trade-finance/invoice-factoring — List factoring records for supplier
router.get(
  '/invoice-factoring',
  authenticate,
  ctrl.listInvoiceFactoring,
);

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

// ─── PO Financing ────────────────────────────────────────────────────────────

// POST /api/v1/trade-finance/po-financing — Apply for PO financing (authenticated)
router.post(
  '/po-financing',
  authenticate,
  [
    body('po_number').notEmpty().withMessage('po_number is required'),
    body('po_amount').isFloat({ gt: 0 }).withMessage('po_amount must be a positive number'),
    body('buyer_name').notEmpty().withMessage('buyer_name is required'),
    body('delivery_date').isISO8601().withMessage('delivery_date must be a valid date'),
    body('advance_pct').optional().isFloat({ gt: 0, lte: 100 }),
    body('interest_rate').optional().isFloat({ gt: 0 }),
    body('term_days').optional().isInt({ gt: 0 }),
    body('notes').optional().isString(),
  ],
  validate,
  ctrl.createPOFinancing,
);

// GET /api/v1/trade-finance/po-financing/:id — Get PO financing details
router.get(
  '/po-financing/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getPOFinancingDetails,
);

// PATCH /api/v1/trade-finance/po-financing/:id/repayment — Record repayment (authenticated)
router.patch(
  '/po-financing/:id/repayment',
  authenticate,
  [
    param('id').isUUID(),
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
  ],
  validate,
  ctrl.recordPORepayment,
);

// ─── Currency / Forward Contracts ────────────────────────────────────────────

// POST /api/v1/trade-finance/currency/forward-contract — Lock exchange rate
router.post(
  '/currency/forward-contract',
  authenticate,
  [
    body('from_currency').isString().isLength({ min: 3, max: 3 }).withMessage('from_currency is required'),
    body('to_currency').isString().isLength({ min: 3, max: 3 }).withMessage('to_currency is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
    body('locked_rate').isFloat({ gt: 0 }).withMessage('locked_rate must be a positive number'),
    body('settlement_date').isISO8601().withMessage('settlement_date must be a valid date'),
  ],
  validate,
  ctrl.createForwardContract,
);

// GET /api/v1/trade-finance/currency/forward-contract — List forward contracts
router.get(
  '/currency/forward-contract',
  authenticate,
  ctrl.listForwardContracts,
);

// POST /api/v1/trade-finance/currency/rate-alert — Set up a rate alert
router.post(
  '/currency/rate-alert',
  authenticate,
  [
    body('from_currency').isString().isLength({ min: 3, max: 3 }),
    body('to_currency').isString().isLength({ min: 3, max: 3 }),
    body('target_rate').isFloat({ gt: 0 }).withMessage('target_rate must be a positive number'),
    body('direction').isIn(['above', 'below']).withMessage('direction must be "above" or "below"'),
  ],
  validate,
  ctrl.createRateAlert,
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
