/**
 * Admin Dashboard Routes
 */

import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import * as ctrl from '../../controllers/adminNew/dashboardController.js';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard/metrics
router.get('/metrics', ctrl.getDashboardMetrics);

// GET /api/admin/dashboard/revenue-chart?period=daily|weekly|monthly
router.get(
  '/revenue-chart',
  [query('period').optional().isIn(['daily', 'weekly', 'monthly'])],
  validate,
  ctrl.getRevenueChart,
);

// GET /api/admin/dashboard/geographic
router.get('/geographic', ctrl.getGeographicDistribution);

// GET /api/admin/dashboard/top-products?limit=10
router.get(
  '/top-products',
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  ctrl.getTopProducts,
);

// GET /api/admin/dashboard/top-suppliers?limit=10
router.get(
  '/top-suppliers',
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  ctrl.getTopSuppliers,
);

// GET /api/admin/dashboard/quick-stats
router.get('/quick-stats', ctrl.getQuickStats);

// GET /api/admin/dashboard/system-health
router.get('/system-health', ctrl.getSystemHealth);

export default router;
