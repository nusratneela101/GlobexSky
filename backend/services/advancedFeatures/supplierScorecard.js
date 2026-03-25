/**
 * Globex Sky — Supplier Scorecard Service
 * Scoring algorithm, badge system, transaction levels, and supplier comparison.
 */

import supabase from '../../config/supabase.js';

/** Badge definitions and their minimum score thresholds */
export const BADGE_TYPES = {
  TOP_RATED: 'Top Rated',
  FAST_RESPONDER: 'Fast Responder',
  QUALITY_CHAMPION: 'Quality Champion',
  VERIFIED_PRO: 'Verified Pro',
  HIGH_VOLUME: 'High Volume',
};

/** Transaction level thresholds (number of completed orders) */
const LEVEL_THRESHOLDS = [0, 10, 50, 200, 500];

/**
 * Calculate the overall score (0–100) for a supplier.
 * @param {string} supplierId
 * @returns {Promise<{ supplierId: string, score: number }>}
 */
export async function calculateScore(supplierId) {
  const breakdown = await getScoreBreakdown(supplierId);
  // Weights reflect B2B trade platform priorities:
  //   on-time delivery & quality are equally critical (25% each),
  //   response rate drives buyer trust (20%), and
  //   transaction success + buyer satisfaction round out the score (15% each).
  const score = Math.round(
    breakdown.responseRate * 0.2
    + breakdown.onTimeDelivery * 0.25
    + breakdown.qualityScore * 0.25
    + breakdown.transactionSuccess * 0.15
    + breakdown.buyerSatisfaction * 0.15,
  );
  return { supplierId, score: Math.min(100, Math.max(0, score)) };
}

/**
 * Get the score breakdown across key performance dimensions.
 * @param {string} supplierId
 * @returns {Promise<{ responseRate: number, onTimeDelivery: number, qualityScore: number, transactionSuccess: number, buyerSatisfaction: number }>}
 */
export async function getScoreBreakdown(supplierId) {
  const { data } = await supabase
    .from('supplier_metrics')
    .select('response_rate, on_time_delivery, quality_score, transaction_success, buyer_satisfaction')
    .eq('supplier_id', supplierId)
    .maybeSingle();

  return {
    responseRate: data?.response_rate ?? 0,
    onTimeDelivery: data?.on_time_delivery ?? 0,
    qualityScore: data?.quality_score ?? 0,
    transactionSuccess: data?.transaction_success ?? 0,
    buyerSatisfaction: data?.buyer_satisfaction ?? 0,
  };
}

/**
 * Award a badge to a supplier.
 * @param {string} supplierId
 * @param {string} badgeType - One of the BADGE_TYPES values
 * @returns {Promise<object>}
 */
export async function awardBadge(supplierId, badgeType) {
  const validBadges = Object.values(BADGE_TYPES);
  if (!validBadges.includes(badgeType)) {
    throw new Error(`Invalid badge type "${badgeType}". Valid types: ${validBadges.join(', ')}`);
  }

  const { data, error } = await supabase
    .from('supplier_badges')
    .upsert([{
      supplier_id: supplierId,
      badge_type: badgeType,
      awarded_at: new Date().toISOString(),
    }], { onConflict: 'supplier_id,badge_type' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all badges earned by a supplier.
 * @param {string} supplierId
 * @returns {Promise<object[]>}
 */
export async function getSupplierBadges(supplierId) {
  const { data, error } = await supabase
    .from('supplier_badges')
    .select('badge_type, awarded_at')
    .eq('supplier_id', supplierId)
    .order('awarded_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Get the transaction level (1–5) for a supplier based on completed order count.
 * @param {string} supplierId
 * @returns {Promise<{ supplierId: string, level: number, completedOrders: number }>}
 */
export async function getTransactionLevel(supplierId) {
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('status', 'completed');

  const completedOrders = count ?? 0;
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (completedOrders >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  return { supplierId, level, completedOrders };
}

/**
 * Get a full capability assessment for a supplier.
 * @param {string} supplierId
 * @returns {Promise<object>}
 */
export async function getCapabilityAssessment(supplierId) {
  const [scoreResult, badges, levelResult] = await Promise.all([
    calculateScore(supplierId),
    getSupplierBadges(supplierId),
    getTransactionLevel(supplierId),
  ]);

  const breakdown = await getScoreBreakdown(supplierId);

  return {
    supplierId,
    overallScore: scoreResult.score,
    breakdown,
    badges: badges.map((b) => b.badge_type),
    transactionLevel: levelResult.level,
    completedOrders: levelResult.completedOrders,
  };
}

/**
 * Compare multiple suppliers by their overall scores and breakdowns.
 * @param {string[]} supplierIds
 * @returns {Promise<object[]>}
 */
export async function compareSuppliers(supplierIds) {
  const assessments = await Promise.allSettled(
    supplierIds.map((id) => getCapabilityAssessment(id)),
  );

  return assessments
    .map((r, i) => ({
      supplierId: supplierIds[i],
      ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message }),
    }))
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
}
