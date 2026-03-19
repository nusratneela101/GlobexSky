/**
 * GlobexSky — Business Intelligence Controller
 */

import {
  analyzeTrends,
  analyzePrices,
  forecastDemand,
  analyzeCompetitors,
  generateCustomReport,
} from '../services/businessIntelligence.service.js';

/**
 * GET /api/v1/business-intelligence/trends
 * Get trending products, categories, regions.
 */
export async function getMarketTrends(req, res, next) {
  try {
    const { category, region, days, limit } = req.query;
    const data = await analyzeTrends({
      category,
      region,
      days: days ? +days : 30,
      limit: limit ? +limit : 20,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/business-intelligence/price-analysis
 * Price trend analysis for products/categories.
 */
export async function getPriceAnalysis(req, res, next) {
  try {
    const { productId, category, days } = req.query;
    const data = await analyzePrices({ productId, category, days: days ? +days : 90 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/business-intelligence/demand-forecast
 * Demand forecasting based on historical data.
 */
export async function getDemandForecast(req, res, next) {
  try {
    const { category, days } = req.query;
    const data = await forecastDemand({ category, days: days ? +days : 90 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/business-intelligence/competitor-insights
 * Competitor pricing and activity analysis (admin only).
 */
export async function getCompetitorInsights(req, res, next) {
  try {
    const { category, limit } = req.query;
    const data = await analyzeCompetitors({ category, limit: limit ? +limit : 50 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/business-intelligence/custom-reports
 * Generate custom reports with filters.
 */
export async function getCustomReports(req, res, next) {
  try {
    const { reportType, startDate, endDate, categories, regions, suppliers } = req.body;
    const data = await generateCustomReport({ reportType, startDate, endDate, categories, regions, suppliers });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
