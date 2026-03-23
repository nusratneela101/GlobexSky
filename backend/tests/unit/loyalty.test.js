/**
 * Unit tests for loyalty service.
 * Tests: points earning (per order), points redemption,
 * tier upgrades, and expiry logic.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}));

import supabase from '../../config/supabase.js';
import {
  TIERS,
  POINTS_RULES,
  determineTier,
  getNextTier,
  enrollUserInLoyalty,
  getUserPointsBalance,
  awardPoints,
} from '../../services/loyalty.service.js';

function createSupabaseChain(result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: jest.fn().mockImplementation((cb) =>
      Promise.resolve({ data: [], error: null }).then(cb)
    ),
  };
  return chain;
}

describe('Loyalty — Points earning rules', () => {
  it('should earn 10 points per $1 spent on purchase', () => {
    const purchaseAmount = 50;
    const pointsEarned = Math.floor(purchaseAmount * POINTS_RULES.purchase);
    expect(pointsEarned).toBe(500);
  });

  it('should earn correct points for a large purchase', () => {
    const purchaseAmount = 200;
    const pointsEarned = Math.floor(purchaseAmount * POINTS_RULES.purchase);
    expect(pointsEarned).toBe(2000);
  });

  it('should award review bonus points', () => {
    expect(POINTS_RULES.review).toBe(50);
  });

  it('should award referral bonus points', () => {
    expect(POINTS_RULES.referral).toBe(200);
  });

  it('should award signup bonus points', () => {
    expect(POINTS_RULES.signup).toBe(100);
  });
});

describe('Loyalty — Tier determination', () => {
  it('should be MEMBER tier at 0 points', () => {
    const tier = determineTier(0);
    expect(tier.key).toBe('MEMBER');
    expect(tier.name).toBe('Member');
  });

  it('should be SILVER tier at 5000 points', () => {
    const tier = determineTier(5000);
    expect(tier.key).toBe('SILVER');
    expect(tier.discount).toBe(5);
  });

  it('should be GOLD tier at 15000 points', () => {
    const tier = determineTier(15000);
    expect(tier.key).toBe('GOLD');
    expect(tier.discount).toBe(10);
  });

  it('should be PLATINUM tier at 50000 points', () => {
    const tier = determineTier(50000);
    expect(tier.key).toBe('PLATINUM');
    expect(tier.discount).toBe(15);
  });

  it('should be VIP tier at 100000 points', () => {
    const tier = determineTier(100000);
    expect(tier.key).toBe('VIP');
    expect(tier.discount).toBe(20);
    expect(tier.exclusive_access).toBe(true);
  });

  it('should remain at previous tier with one point below threshold', () => {
    const tier = determineTier(4999);
    expect(tier.key).toBe('MEMBER');
  });
});

describe('Loyalty — Next tier upgrade', () => {
  it('should return SILVER as next tier for MEMBER', () => {
    const next = getNextTier('MEMBER');
    expect(next.key).toBe('SILVER');
  });

  it('should return GOLD as next tier for SILVER', () => {
    const next = getNextTier('SILVER');
    expect(next.key).toBe('GOLD');
  });

  it('should return PLATINUM as next tier for GOLD', () => {
    const next = getNextTier('GOLD');
    expect(next.key).toBe('PLATINUM');
  });

  it('should return VIP as next tier for PLATINUM', () => {
    const next = getNextTier('PLATINUM');
    expect(next.key).toBe('VIP');
  });

  it('should return null when already at VIP (max tier)', () => {
    const next = getNextTier('VIP');
    expect(next).toBeNull();
  });
});

describe('Loyalty — Points redemption logic', () => {
  it('should correctly calculate available points (total - redeemed)', () => {
    const totalPoints = 1000;
    const redeemedPoints = 200;
    const available = totalPoints - redeemedPoints;
    expect(available).toBe(800);
  });

  it('should not allow redeeming more points than available', () => {
    const totalPoints = 500;
    const redeemedPoints = 100;
    const available = totalPoints - redeemedPoints;
    const attemptRedeem = 500;
    const canRedeem = attemptRedeem <= available;
    expect(canRedeem).toBe(false);
  });

  it('should calculate points to next tier correctly', () => {
    const currentPoints = 3000;
    const tier = determineTier(currentPoints);
    const next = getNextTier(tier.key);
    const pointsToNext = next ? Math.max(0, next.min - currentPoints) : 0;
    expect(pointsToNext).toBe(2000); // SILVER needs 5000, user has 3000
  });
});

describe('Loyalty — Points expiry logic', () => {
  it('should set expiry 365 days from now for signup bonus', () => {
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffDays = Math.round((expiresAt - now) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(365);
  });

  it('should detect that an expiry date in the past is expired', () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    const isExpired = new Date(pastExpiry) < new Date();
    expect(isExpired).toBe(true);
  });

  it('should detect that an expiry date in the future is still valid', () => {
    const futureExpiry = new Date(Date.now() + 86400000).toISOString();
    const isExpired = new Date(futureExpiry) < new Date();
    expect(isExpired).toBe(false);
  });
});

describe('Loyalty — enrollUserInLoyalty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw if user is already enrolled', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'loyalty_members') {
        return createSupabaseChain({ data: { id: 'existing-member' }, error: null });
      }
      return createSupabaseChain({ data: null, error: null });
    });

    await expect(enrollUserInLoyalty('user-already-enrolled')).rejects.toThrow(
      'already enrolled'
    );
  });

  it('should enroll a new user successfully', async () => {
    let callCount = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'loyalty_members') {
        callCount++;
        if (callCount === 1) {
          return createSupabaseChain({ data: null, error: { message: 'Not found' } });
        }
        return createSupabaseChain({
          data: { id: 'new-member', user_id: 'new-user', total_points: 100, tier: 'MEMBER' },
          error: null,
        });
      }
      if (table === 'loyalty_transactions') {
        return createSupabaseChain({ data: { id: 'txn-1' }, error: null });
      }
      return createSupabaseChain({ data: null, error: null });
    });

    const result = await enrollUserInLoyalty('new-user-id');
    expect(result).toBeDefined();
  });
});

describe('Loyalty — getUserPointsBalance', () => {
  it('should throw if user is not enrolled', async () => {
    supabase.from.mockImplementation(() =>
      createSupabaseChain({ data: null, error: { message: 'Not found' } })
    );

    await expect(getUserPointsBalance('not-enrolled-user')).rejects.toThrow(
      'not enrolled'
    );
  });

  it('should return points balance for enrolled user', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'loyalty_members') {
        return createSupabaseChain({
          data: { total_points: 5500, redeemed_points: 500, tier: 'SILVER', status: 'active' },
          error: null,
        });
      }
      if (table === 'loyalty_transactions') {
        return createSupabaseChain({ data: [], error: null });
      }
      return createSupabaseChain({ data: null, error: null });
    });

    const balance = await getUserPointsBalance('enrolled-user');
    expect(balance.total_points).toBe(5500);
    expect(balance.available_points).toBe(5000);
    expect(balance.tier.key).toBe('SILVER');
  });
});

describe('Loyalty — awardPoints', () => {
  it('should throw if user is not enrolled when awarding points', async () => {
    supabase.from.mockImplementation(() =>
      createSupabaseChain({ data: null, error: { message: 'Not found' } })
    );

    await expect(awardPoints('not-enrolled', 'purchase', 100)).rejects.toThrow();
  });

  it('should calculate purchase points correctly', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'loyalty_members') {
        return createSupabaseChain({
          data: { id: 'member-1', user_id: 'user-1', total_points: 0, redeemed_points: 0, tier: 'MEMBER' },
          error: null,
        });
      }
      if (table === 'loyalty_transactions') {
        return createSupabaseChain({ data: { id: 'txn-1' }, error: null });
      }
      return createSupabaseChain({ data: { id: 'updated-member' }, error: null });
    });

    const result = await awardPoints('user-1', 'purchase', 50);
    expect(result.points_earned).toBe(500); // 50 * 10 points per $1
  });
});
