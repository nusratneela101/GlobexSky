/**
 * Unit tests for commission calculation service.
 * Mocks Supabase to test: per-unit %, category-based %, tier-based %,
 * and minimum commission floor.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}));

import supabase from '../../config/supabase.js';
import { calculateCommissionAmount } from '../../services/commission.service.js';

function createMockQueryChain(result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

describe('Commission — Default rate (no settings found)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Return no setting from DB — triggers default 5% rate
    const chain = createMockQueryChain({ data: null, error: null });
    supabase.from.mockReturnValue(chain);
  });

  it('should apply default 5% commission when no settings found', async () => {
    const result = await calculateCommissionAmount(100);
    expect(result.commission).toBe(5);
    expect(result.rate_percentage).toBe(5);
    expect(result.order_value).toBe(100);
  });

  it('should compute correct default commission for a large order', async () => {
    const result = await calculateCommissionAmount(1000);
    expect(result.commission).toBe(50);
    expect(result.flat_fee).toBe(0);
  });

  it('should handle zero order value', async () => {
    const result = await calculateCommissionAmount(0);
    expect(result.commission).toBe(0);
  });

  it('should return correct structure with required fields', async () => {
    const result = await calculateCommissionAmount(200);
    expect(result).toHaveProperty('order_value');
    expect(result).toHaveProperty('rate_percentage');
    expect(result).toHaveProperty('flat_fee');
    expect(result).toHaveProperty('commission');
  });
});

describe('Commission — Category-based rate', () => {
  it('should apply category-specific rate when category setting is found', async () => {
    const categorySetting = {
      data: { type: 'category', rate_percentage: 8, flat_fee: 0, min_commission: 0, max_commission: 9999 },
      error: null,
    };
    const noSettingChain = createMockQueryChain({ data: null, error: null });
    const categoryChain = createMockQueryChain(categorySetting);

    let callCount = 0;
    supabase.from.mockImplementation(() => {
      if (callCount === 0) {
        callCount++;
        return categoryChain;
      }
      return noSettingChain;
    });

    const result = await calculateCommissionAmount(100, 'category-uuid-001');
    expect(result.rate_percentage).toBe(8);
    expect(result.commission).toBe(8);
  });

  it('should fall back to default rate when category setting not found', async () => {
    const noSettingChain = createMockQueryChain({ data: null, error: null });
    supabase.from.mockReturnValue(noSettingChain);

    const result = await calculateCommissionAmount(100, 'non-existent-category');
    expect(result.rate_percentage).toBe(5);
  });
});

describe('Commission — Minimum commission floor', () => {
  it('should enforce minimum commission when calculated amount is below min', async () => {
    const setting = {
      data: { type: 'default', rate_percentage: 2, flat_fee: 0, min_commission: 10, max_commission: 9999 },
      error: null,
    };
    const chain = createMockQueryChain(setting);
    supabase.from.mockReturnValue(chain);

    // 2% of 100 = 2, but min is 10
    const result = await calculateCommissionAmount(100);
    expect(result.commission).toBe(10);
  });

  it('should enforce maximum commission cap', async () => {
    const setting = {
      data: { type: 'default', rate_percentage: 20, flat_fee: 0, min_commission: 0, max_commission: 50 },
      error: null,
    };
    const chain = createMockQueryChain(setting);
    supabase.from.mockReturnValue(chain);

    // 20% of 500 = 100, but max is 50
    const result = await calculateCommissionAmount(500);
    expect(result.commission).toBe(50);
  });
});

describe('Commission — Flat fee', () => {
  it('should add flat fee to percentage commission', async () => {
    const setting = {
      data: { type: 'default', rate_percentage: 5, flat_fee: 2, min_commission: 0, max_commission: 9999 },
      error: null,
    };
    const chain = createMockQueryChain(setting);
    supabase.from.mockReturnValue(chain);

    // 5% of 100 = 5 + flat_fee 2 = 7
    const result = await calculateCommissionAmount(100);
    expect(result.commission).toBe(7);
    expect(result.flat_fee).toBe(2);
  });
});
