/**
 * GlobexSky — Business Intelligence Routes
 */

import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/businessIntelligence.controller.js';

const router = Router();

router.use(authenticate);

// GET /trends — Get trending products/categories/regions
router.get(
  '/trends',
  [
    query('days').optional().isInt({ min: 1, max: 365 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.getMarketTrends,
);

// GET /price-analysis — Price trend analysis
router.get(
  '/price-analysis',
  [
    query('days').optional().isInt({ min: 1, max: 365 }),
  ],
  validate,
  ctrl.getPriceAnalysis,
);

// GET /demand-forecast — Demand forecasting
router.get(
  '/demand-forecast',
  [
    query('days').optional().isInt({ min: 1, max: 365 }),
  ],
  validate,
  ctrl.getDemandForecast,
);

// GET /competitor-insights — Competitor analysis (admin only)
router.get(
  '/competitor-insights',
  requireAdmin,
  [
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validate,
  ctrl.getCompetitorInsights,
);

// POST /custom-reports — Generate custom reports
router.post(
  '/custom-reports',
  [
    body('reportType')
      .isIn(['market_overview', 'price_analysis', 'demand_forecast', 'competitor_analysis'])
      .withMessage('reportType must be one of: market_overview, price_analysis, demand_forecast, competitor_analysis'),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('categories').optional().isArray(),
    body('regions').optional().isArray(),
    body('suppliers').optional().isArray(),
  ],
  validate,
  ctrl.getCustomReports,
);

export default router;
