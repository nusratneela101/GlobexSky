/**
 * GlobexSky — Supplier Assessment Controller
 */

import {
  runAssessment,
  fetchScorecard,
  awardVerificationBadge,
  fetchLeaderboard,
  getVerificationStatus,
} from '../services/supplierAssessment.service.js';

/**
 * POST /api/v1/supplier-assessment/:supplierId/assess
 * Run assessment on a supplier (admin only).
 */
export async function assessSupplier(req, res, next) {
  try {
    const { supplierId } = req.params;
    const { quality, delivery, communication, compliance } = req.body;
    const assessedBy = req.user.id;

    const scorecard = await runAssessment(
      supplierId,
      { quality: +quality, delivery: +delivery, communication: +communication, compliance: +compliance },
      assessedBy,
    );

    res.status(201).json({ success: true, data: scorecard });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/supplier-assessment/:supplierId/scorecard
 * Get a supplier's full scorecard (authenticated).
 */
export async function getScorecard(req, res, next) {
  try {
    const { supplierId } = req.params;
    const scorecard = await fetchScorecard(supplierId);

    if (!scorecard) {
      return res.status(404).json({ success: false, message: 'Scorecard not found for this supplier.' });
    }

    res.json({ success: true, data: scorecard });
  } catch (err) { next(err); }
}

/**
 * PATCH /api/v1/supplier-assessment/:supplierId/scorecard
 * Admin update scorecard metrics.
 */
export async function updateScorecard(req, res, next) {
  try {
    const { supplierId } = req.params;
    const { quality, delivery, communication, compliance } = req.body;
    const assessedBy = req.user.id;

    const scorecard = await runAssessment(
      supplierId,
      { quality: +quality, delivery: +delivery, communication: +communication, compliance: +compliance },
      assessedBy,
    );

    res.json({ success: true, data: scorecard });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/supplier-assessment/:supplierId/badge
 * Award verification badge to supplier (admin only).
 */
export async function awardBadge(req, res, next) {
  try {
    const { supplierId } = req.params;
    const { badgeType } = req.body;
    const awardedBy = req.user.id;

    const badge = await awardVerificationBadge(supplierId, badgeType, awardedBy);
    res.status(201).json({ success: true, data: badge });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/supplier-assessment/leaderboard
 * Get top-rated suppliers leaderboard (public).
 */
export async function getLeaderboard(req, res, next) {
  try {
    const { category, region, limit } = req.query;
    const leaderboard = await fetchLeaderboard({ category, region, limit: limit ? +limit : 20 });
    res.json({ success: true, data: leaderboard });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/supplier-assessment/:supplierId/verification
 * Get supplier's verification tier status (authenticated).
 */
export async function getVerificationStatusHandler(req, res, next) {
  try {
    const { supplierId } = req.params;
    const status = await getVerificationStatus(supplierId);
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
}
