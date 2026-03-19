import supabase from '../config/supabase.js';

/**
 * Loyalty tier configuration.
 */
export const TIERS = {
  MEMBER:   { name: 'Member',   min: 0,       discount: 0,    free_shipping_threshold: null, priority_support: false, exclusive_access: false },
  SILVER:   { name: 'Silver',   min: 5000,    discount: 5,    free_shipping_threshold: 100,  priority_support: false, exclusive_access: false },
  GOLD:     { name: 'Gold',     min: 15000,   discount: 10,   free_shipping_threshold: 75,   priority_support: true,  exclusive_access: false },
  PLATINUM: { name: 'Platinum', min: 50000,   discount: 15,   free_shipping_threshold: 50,   priority_support: true,  exclusive_access: true  },
  VIP:      { name: 'VIP',      min: 100000,  discount: 20,   free_shipping_threshold: 0,    priority_support: true,  exclusive_access: true  },
};

/**
 * Points earning rules.
 */
export const POINTS_RULES = {
  purchase: 10,    // 10 points per $1 spent
  review: 50,
  referral: 200,
  signup: 100,
};

/**
 * Determine tier from total lifetime points.
 * @param {number} totalPoints
 */
export function determineTier(totalPoints) {
  const tierOrder = ['VIP', 'PLATINUM', 'GOLD', 'SILVER', 'MEMBER'];
  for (const tierKey of tierOrder) {
    if (totalPoints >= TIERS[tierKey].min) return { key: tierKey, ...TIERS[tierKey] };
  }
  return { key: 'MEMBER', ...TIERS.MEMBER };
}

/**
 * Get the next tier above the current one.
 * @param {string} currentTierKey
 */
export function getNextTier(currentTierKey) {
  const order = ['MEMBER', 'SILVER', 'GOLD', 'PLATINUM', 'VIP'];
  const idx = order.indexOf(currentTierKey);
  if (idx < 0 || idx >= order.length - 1) return null;
  const nextKey = order[idx + 1];
  return { key: nextKey, ...TIERS[nextKey] };
}

/**
 * Enroll a user in the loyalty program.
 * @param {string} userId
 */
export async function enrollUserInLoyalty(userId) {
  const { data: existing } = await supabase
    .from('loyalty_members')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) throw new Error('User is already enrolled in the loyalty program.');

  const { data, error } = await supabase
    .from('loyalty_members')
    .insert([{
      user_id: userId,
      total_points: POINTS_RULES.signup,
      redeemed_points: 0,
      tier: 'MEMBER',
      status: 'active',
    }])
    .select()
    .single();

  if (error) throw error;

  // Record signup bonus transaction
  await supabase.from('loyalty_transactions').insert([{
    user_id: userId,
    type: 'earn',
    action: 'signup',
    points: POINTS_RULES.signup,
    description: 'Welcome bonus for joining the loyalty program',
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  }]);

  return data;
}

/**
 * Get a user's points balance and recent transaction history.
 * @param {string} userId
 */
export async function getUserPointsBalance(userId) {
  const { data: member, error: mErr } = await supabase
    .from('loyalty_members')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (mErr || !member) throw new Error('User is not enrolled in the loyalty program.');

  const { data: transactions } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const tier = determineTier(member.total_points);
  const nextTier = getNextTier(tier.key);

  return {
    total_points: member.total_points,
    redeemed_points: member.redeemed_points,
    available_points: member.total_points - member.redeemed_points,
    tier,
    next_tier: nextTier,
    points_to_next_tier: nextTier ? Math.max(0, nextTier.min - member.total_points) : 0,
    transactions: transactions || [],
  };
}

/**
 * Award points to a user for a given action.
 * @param {string} userId
 * @param {'purchase'|'review'|'referral'|'signup'} action
 * @param {number} [purchaseAmount] - Only for purchase action
 * @param {string} [referenceId] - Order/review ID for traceability
 */
export async function awardPoints(userId, action, purchaseAmount = 0, referenceId = null) {
  const { data: member, error } = await supabase
    .from('loyalty_members')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !member) throw new Error('User is not enrolled in the loyalty program.');

  let pointsEarned;
  let description;

  if (action === 'purchase') {
    pointsEarned = Math.floor(purchaseAmount * POINTS_RULES.purchase);
    description = `Points earned for purchase of $${purchaseAmount.toFixed(2)}`;
  } else {
    pointsEarned = POINTS_RULES[action] || 0;
    description = `Points earned for ${action}`;
  }

  if (pointsEarned <= 0) throw new Error('No points to award for this action.');

  const newTotal = (member.total_points || 0) + pointsEarned;
  const newTier = determineTier(newTotal);

  await supabase
    .from('loyalty_members')
    .update({ total_points: newTotal, tier: newTier.key })
    .eq('user_id', userId);

  const { data: txn, error: txnErr } = await supabase
    .from('loyalty_transactions')
    .insert([{
      user_id: userId,
      type: 'earn',
      action,
      points: pointsEarned,
      description,
      reference_id: referenceId,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }])
    .select()
    .single();

  if (txnErr) throw txnErr;

  return { points_earned: pointsEarned, new_total: newTotal, tier: newTier, transaction: txn };
}

/**
 * Redeem points for a reward or discount.
 * @param {string} userId
 * @param {number} pointsToRedeem
 * @param {string} rewardId
 * @param {string} description
 */
export async function redeemPointsForReward(userId, pointsToRedeem, rewardId, description) {
  const { data: member, error } = await supabase
    .from('loyalty_members')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !member) throw new Error('User is not enrolled in the loyalty program.');

  const available = (member.total_points || 0) - (member.redeemed_points || 0);
  if (available < pointsToRedeem) throw new Error(`Insufficient points. Available: ${available}, Required: ${pointsToRedeem}`);

  // Validate reward exists
  const { data: reward, error: rwErr } = await supabase
    .from('loyalty_rewards')
    .select('*')
    .eq('id', rewardId)
    .eq('is_active', true)
    .single();

  if (rwErr || !reward) throw new Error('Reward not found or no longer available.');
  if (reward.points_required > pointsToRedeem) throw new Error(`This reward requires ${reward.points_required} points.`);

  const newRedeemed = (member.redeemed_points || 0) + pointsToRedeem;
  await supabase
    .from('loyalty_members')
    .update({ redeemed_points: newRedeemed })
    .eq('user_id', userId);

  const { data: txn, error: txnErr } = await supabase
    .from('loyalty_transactions')
    .insert([{
      user_id: userId,
      type: 'redeem',
      action: 'reward_redemption',
      points: -pointsToRedeem,
      description: description || `Redeemed for: ${reward.name}`,
      reference_id: rewardId,
    }])
    .select()
    .single();

  if (txnErr) throw txnErr;
  return { points_redeemed: pointsToRedeem, reward, transaction: txn };
}

/**
 * Get the rewards catalog.
 */
export async function getRewardsCatalog() {
  const { data, error } = await supabase
    .from('loyalty_rewards')
    .select('*')
    .eq('is_active', true)
    .order('points_required', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get loyalty program analytics (admin).
 */
export async function getLoyaltyAnalyticsData() {
  const { data: members } = await supabase
    .from('loyalty_members')
    .select('total_points, redeemed_points, tier, status');

  const { data: transactions } = await supabase
    .from('loyalty_transactions')
    .select('type, points, created_at');

  const m = members || [];
  const t = transactions || [];

  const totalIssued = t.filter(x => x.type === 'earn').reduce((s, x) => s + x.points, 0);
  const totalRedeemed = t.filter(x => x.type === 'redeem').reduce((s, x) => s + Math.abs(x.points), 0);

  const tierBreakdown = m.reduce((acc, mem) => {
    acc[mem.tier] = (acc[mem.tier] || 0) + 1;
    return acc;
  }, {});

  return {
    total_members: m.length,
    active_members: m.filter(x => x.status === 'active').length,
    total_points_issued: totalIssued,
    total_points_redeemed: totalRedeemed,
    outstanding_points: totalIssued - totalRedeemed,
    tier_breakdown: tierBreakdown,
  };
}
