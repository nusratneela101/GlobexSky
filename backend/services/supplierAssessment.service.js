/**
 * GlobexSky — Supplier Assessment Service
 * Scoring algorithm, badge/tier system, leaderboard, and verification workflow.
 */

import supabase from '../config/supabase.js';

/** Weighted scoring categories */
const WEIGHTS = {
  quality: 0.30,
  delivery: 0.30,
  communication: 0.20,
  compliance: 0.20,
};

/** Badge/tier thresholds */
export const TIERS = {
  DIAMOND: 90,
  GOLD: 80,
  SILVER: 70,
  BRONZE: 60,
};

/**
 * Compute the overall weighted score from category scores.
 * @param {{ quality: number, delivery: number, communication: number, compliance: number }} scores
 * @returns {number} overall score 0-100
 */
export function computeOverallScore(scores) {
  const { quality = 0, delivery = 0, communication = 0, compliance = 0 } = scores;
  return Math.round(
    quality * WEIGHTS.quality +
    delivery * WEIGHTS.delivery +
    communication * WEIGHTS.communication +
    compliance * WEIGHTS.compliance,
  );
}

/**
 * Determine badge tier based on overall score.
 * @param {number} score
 * @returns {string|null}
 */
export function getBadgeTier(score) {
  if (score >= TIERS.DIAMOND) return 'diamond';
  if (score >= TIERS.GOLD) return 'gold';
  if (score >= TIERS.SILVER) return 'silver';
  if (score >= TIERS.BRONZE) return 'bronze';
  return null;
}

/**
 * Run assessment on a supplier — persist scorecard to `supplier_scorecards`.
 * @param {string} supplierId
 * @param {{ quality: number, delivery: number, communication: number, compliance: number }} categoryScores
 * @param {string} assessedBy - admin user id
 * @returns {Promise<object>}
 */
export async function runAssessment(supplierId, categoryScores, assessedBy) {
  const overall = computeOverallScore(categoryScores);
  const tier = getBadgeTier(overall);

  const { data, error } = await supabase
    .from('supplier_scorecards')
    .upsert(
      {
        supplier_id: supplierId,
        quality_score: categoryScores.quality,
        delivery_score: categoryScores.delivery,
        communication_score: categoryScores.communication,
        compliance_score: categoryScores.compliance,
        overall_score: overall,
        tier,
        assessed_by: assessedBy,
        assessed_at: new Date().toISOString(),
      },
      { onConflict: 'supplier_id' },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Fetch a supplier's full scorecard.
 * @param {string} supplierId
 * @returns {Promise<object|null>}
 */
export async function fetchScorecard(supplierId) {
  const { data, error } = await supabase
    .from('supplier_scorecards')
    .select('*')
    .eq('supplier_id', supplierId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data || null;
}

/**
 * Award a verification badge to a supplier.
 * @param {string} supplierId
 * @param {string} badgeType - e.g. 'verified', 'top-rated', 'gold'
 * @param {string} awardedBy - admin user id
 * @returns {Promise<object>}
 */
export async function awardVerificationBadge(supplierId, badgeType, awardedBy) {
  const { data, error } = await supabase
    .from('supplier_badges')
    .upsert(
      {
        supplier_id: supplierId,
        badge_type: badgeType,
        awarded_by: awardedBy,
        awarded_at: new Date().toISOString(),
        active: true,
      },
      { onConflict: 'supplier_id,badge_type' },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Fetch the top-rated suppliers leaderboard.
 * @param {{ category?: string, region?: string, limit?: number }} filters
 * @returns {Promise<object[]>}
 */
export async function fetchLeaderboard({ category, region, limit = 20 } = {}) {
  let query = supabase
    .from('supplier_scorecards')
    .select('supplier_id,overall_score,tier,quality_score,delivery_score,communication_score,compliance_score,assessed_at,profiles(full_name,avatar_url,country)')
    .order('overall_score', { ascending: false })
    .limit(limit);

  if (region) query = query.eq('profiles.country', region);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Get a supplier's verification status.
 * @param {string} supplierId
 * @returns {Promise<object>}
 */
export async function getVerificationStatus(supplierId) {
  const [scorecardRes, badgesRes] = await Promise.all([
    supabase.from('supplier_scorecards').select('tier,overall_score,assessed_at').eq('supplier_id', supplierId).single(),
    supabase.from('supplier_badges').select('badge_type,awarded_at,active').eq('supplier_id', supplierId),
  ]);

  const scorecard = scorecardRes.data || null;
  const badges = badgesRes.data || [];

  let verificationTier = 'unverified';
  if (scorecard?.tier) verificationTier = scorecard.tier;
  if (badges.some((b) => b.badge_type === 'verified' && b.active)) verificationTier = 'verified';

  return { supplierId, scorecard, badges, verificationTier };
}
