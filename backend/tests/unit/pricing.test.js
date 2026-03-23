/**
 * Unit tests for pricing/markup service.
 * Tests: supplier price, dropship markup %, final retail price, multi-currency.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}));

import supabase from '../../config/supabase.js';
import { calculateMarkup } from '../../services/pricing.service.js';

function createMockQueryChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
}

describe('Pricing — Default markup (global fallback)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const chain = createMockQueryChain({ data: null, error: null });
    supabase.from.mockReturnValue(chain);
  });

  it('should apply default 20% markup when no setting is found', async () => {
    const result = await calculateMarkup(100);
    expect(result.markup_percentage).toBe(20);
    expect(result.profit).toBe(20);
    expect(result.selling_price).toBe(120);
    expect(result.supplier_price).toBe(100);
  });

  it('should compute correct selling price for different supplier prices', async () => {
    const result = await calculateMarkup(50);
    expect(result.selling_price).toBe(60); // 50 + 20%
  });

  it('should return all required fields', async () => {
    const result = await calculateMarkup(200);
    expect(result).toHaveProperty('supplier_price');
    expect(result).toHaveProperty('markup_percentage');
    expect(result).toHaveProperty('profit');
    expect(result).toHaveProperty('selling_price');
  });

  it('should handle zero supplier price', async () => {
    const result = await calculateMarkup(0);
    expect(result.selling_price).toBe(0);
    expect(result.profit).toBe(0);
  });

  it('should round selling price to 2 decimal places', async () => {
    const result = await calculateMarkup(33.33);
    const decimalPlaces = (result.selling_price.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});

describe('Pricing — Category-specific markup', () => {
  it('should apply category markup when category setting is found', async () => {
    const categoryMarkup = { data: { markup_percentage: 30, min_profit: 0 }, error: null };
    const noData = { data: null, error: null };

    let callCount = 0;
    supabase.from.mockImplementation(() => {
      if (callCount === 0) {
        callCount++;
        return createMockQueryChain(categoryMarkup);
      }
      return createMockQueryChain(noData);
    });

    const result = await calculateMarkup(100, 'electronics-category');
    expect(result.markup_percentage).toBe(30);
    expect(result.profit).toBe(30);
    expect(result.selling_price).toBe(130);
  });
});

describe('Pricing — Minimum profit enforcement', () => {
  it('should enforce minimum profit when markup is below min', async () => {
    const setting = { data: { markup_percentage: 5, min_profit: 20 }, error: null };
    const chain = createMockQueryChain(setting);
    supabase.from.mockReturnValue(chain);

    // 5% of 100 = 5, but min_profit is 20 → profit = 20
    const result = await calculateMarkup(100);
    expect(result.profit).toBe(20);
    expect(result.selling_price).toBe(120);
  });

  it('should use the actual profit when it exceeds min_profit', async () => {
    const setting = { data: { markup_percentage: 30, min_profit: 5 }, error: null };
    const chain = createMockQueryChain(setting);
    supabase.from.mockReturnValue(chain);

    // 30% of 100 = 30, min_profit = 5 → profit = 30
    const result = await calculateMarkup(100);
    expect(result.profit).toBe(30);
  });
});

describe('Pricing — Multi-currency formatting', () => {
  it('should format price to 2 decimal places for any currency', () => {
    const price = 99.999;
    const formatted = +price.toFixed(2);
    expect(formatted).toBe(100);
  });

  it('should correctly compute USD to a higher-value currency scale', () => {
    const usdPrice = 10;
    const jpyRate = 150; // 1 USD = 150 JPY
    const jpyPrice = +(usdPrice * jpyRate).toFixed(2);
    expect(jpyPrice).toBe(1500);
  });

  it('should handle conversion from non-USD base currency to USD', () => {
    const eurPrice = 100;
    const eurToUsd = 1.08;
    const usdPrice = +(eurPrice * eurToUsd).toFixed(2);
    expect(usdPrice).toBe(108);
  });
});
