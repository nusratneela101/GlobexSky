/**
 * Admin Financial Reports Routes
 */

import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/financialReportController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/reports/profit-loss?startDate=&endDate=
router.get(
  '/profit-loss',
  [query('startDate').notEmpty().isISO8601(), query('endDate').notEmpty().isISO8601()],
  validate,
  ctrl.getProfitAndLoss,
);

// GET /api/admin/reports/cash-flow?period=monthly&year=2024
router.get(
  '/cash-flow',
  [query('period').optional().isIn(['monthly', 'quarterly', 'yearly']), query('year').optional().isInt()],
  validate,
  ctrl.getCashFlowReport,
);

// GET /api/admin/reports/tax?period=quarterly&country=US
router.get(
  '/tax',
  [query('period').optional().notEmpty(), query('country').optional().isLength({ min: 2, max: 3 })],
  validate,
  ctrl.getTaxReport,
);

// GET /api/admin/reports/commission
router.get('/commission', ctrl.getCommissionReport);

// GET /api/admin/reports/subscription-revenue
router.get('/subscription-revenue', ctrl.getSubscriptionRevenue);

// GET /api/admin/reports/refunds
router.get('/refunds', ctrl.getRefundReport);

// GET /api/admin/reports/export?reportType=profit-loss&format=csv
router.get(
  '/export',
  [query('reportType').notEmpty(), query('format').optional().isIn(['csv', 'json'])],
  validate,
  ctrl.exportReport,
);

// GET /api/admin/reports/revenue-by-source
router.get('/revenue-by-source', ctrl.getRevenueBySource);

export default router;
