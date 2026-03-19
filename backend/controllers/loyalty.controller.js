import {
  enrollUserInLoyalty,
  getUserPointsBalance,
  awardPoints,
  redeemPointsForReward,
  determineTier,
  getRewardsCatalog,
  getLoyaltyAnalyticsData,
} from '../services/loyalty.service.js';

export async function enrollMember(req, res, next) {
  try {
    const data = await enrollUserInLoyalty(req.user.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getPoints(req, res, next) {
  try {
    const data = await getUserPointsBalance(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function earnPoints(req, res, next) {
  try {
    const { action, purchase_amount, reference_id } = req.body;
    const data = await awardPoints(req.user.id, action, purchase_amount || 0, reference_id || null);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function redeemPoints(req, res, next) {
  try {
    const { points, reward_id, description } = req.body;
    const data = await redeemPointsForReward(req.user.id, points, reward_id, description);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getMemberTier(req, res, next) {
  try {
    const balance = await getUserPointsBalance(req.user.id);
    res.json({ success: true, data: { tier: balance.tier, next_tier: balance.next_tier, points_to_next_tier: balance.points_to_next_tier } });
  } catch (err) { next(err); }
}

export async function getAvailableRewards(req, res, next) {
  try {
    const data = await getRewardsCatalog();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getLoyaltyAnalytics(req, res, next) {
  try {
    const data = await getLoyaltyAnalyticsData();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
