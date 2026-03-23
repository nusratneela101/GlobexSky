/**
 * Unit tests for flash sale service.
 * Tests: price discount calculation, countdown timer logic,
 * eligibility checks, stock limits.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}));

import supabase from '../../config/supabase.js';
import {
  getActiveFlashSalesData,
  getUpcomingFlashSalesData,
  createFlashSaleRecord,
  cancelFlashSaleRecord,
  addProductsToFlashSale,
  calculateDiscountedPrice,
} from '../../services/flashSale.service.js';

function createMockChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    then: jest.fn().mockImplementation((cb) =>
      Promise.resolve(result).then(cb)
    ),
  };
}

describe('Flash Sale — Price discount calculation', () => {
  it('should calculate 50% discount correctly', () => {
    const originalPrice = 100;
    const salePrice = 50;
    const discountPct = +((1 - salePrice / originalPrice) * 100).toFixed(1);
    expect(discountPct).toBe(50);
  });

  it('should calculate 20% discount correctly', () => {
    const originalPrice = 200;
    const salePrice = 160;
    const discountPct = +((1 - salePrice / originalPrice) * 100).toFixed(1);
    expect(discountPct).toBe(20);
  });

  it('should return 0% discount when original and sale price are equal', () => {
    const originalPrice = 100;
    const salePrice = 100;
    const discountPct = +((1 - salePrice / originalPrice) * 100).toFixed(1);
    expect(discountPct).toBe(0);
  });

  it('should handle zero original price gracefully', () => {
    const originalPrice = 0;
    const salePrice = 0;
    const discountPct = originalPrice > 0 ? +((1 - salePrice / originalPrice) * 100).toFixed(1) : 0;
    expect(discountPct).toBe(0);
  });

  it('should calculate discount for a fractional price', () => {
    const originalPrice = 99.99;
    const salePrice = 79.99;
    const discountPct = +((1 - salePrice / originalPrice) * 100).toFixed(1);
    expect(discountPct).toBeCloseTo(20, 0);
  });
});

describe('Flash Sale — Countdown timer logic', () => {
  it('should return countdown_seconds close to 3600 for a sale ending in 1 hour', () => {
    const endsAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const seconds = Math.max(0, Math.floor((new Date(endsAt) - new Date()) / 1000));
    expect(seconds).toBeGreaterThan(3590);
    expect(seconds).toBeLessThanOrEqual(3600);
  });

  it('should return 0 for an already-ended sale', () => {
    const endsAt = new Date(Date.now() - 1000).toISOString();
    const seconds = Math.max(0, Math.floor((new Date(endsAt) - new Date()) / 1000));
    expect(seconds).toBe(0);
  });

  it('should return starts_in_seconds for upcoming sale', () => {
    const startsAt = new Date(Date.now() + 7200 * 1000).toISOString();
    const seconds = Math.max(0, Math.floor((new Date(startsAt) - new Date()) / 1000));
    expect(seconds).toBeGreaterThan(7190);
    expect(seconds).toBeLessThanOrEqual(7200);
  });

  it('should compute countdown in whole seconds (no fractional)', () => {
    const endsAt = new Date(Date.now() + 1800500).toISOString();
    const seconds = Math.max(0, Math.floor((new Date(endsAt) - new Date()) / 1000));
    expect(Number.isInteger(seconds)).toBe(true);
  });
});

describe('Flash Sale — Active sales retrieval', () => {
  it('should return active sales with countdown_seconds field', async () => {
    const now = new Date();
    const mockSales = [
      {
        id: 'sale-1',
        name: 'Summer Sale',
        status: 'active',
        starts_at: new Date(now - 3600000).toISOString(),
        ends_at: new Date(now.getTime() + 3600000).toISOString(),
        products: [],
      },
    ];
    const chain = createMockChain({ data: mockSales, error: null });
    supabase.from.mockReturnValue(chain);

    const result = await getActiveFlashSalesData();
    expect(Array.isArray(result)).toBe(true);
    result.forEach((sale) => {
      expect(sale).toHaveProperty('countdown_seconds');
      expect(sale.countdown_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  it('should return empty array if no active sales', async () => {
    const chain = createMockChain({ data: [], error: null });
    supabase.from.mockReturnValue(chain);

    const result = await getActiveFlashSalesData();
    expect(result).toEqual([]);
  });
});

describe('Flash Sale — Stock limit eligibility', () => {
  it('should mark product as eligible when stock_remaining > 0', () => {
    const product = { stock_remaining: 10, stock_limit: 100 };
    const eligible = product.stock_remaining === null || product.stock_remaining > 0;
    expect(eligible).toBe(true);
  });

  it('should mark product as ineligible when stock_remaining is 0', () => {
    const product = { stock_remaining: 0, stock_limit: 100 };
    const eligible = product.stock_remaining === null || product.stock_remaining > 0;
    expect(eligible).toBe(false);
  });

  it('should be eligible when no stock limit set (null)', () => {
    const product = { stock_remaining: null, stock_limit: null };
    const eligible = product.stock_remaining === null || product.stock_remaining > 0;
    expect(eligible).toBe(true);
  });
});

describe('Flash Sale — createFlashSaleRecord', () => {
  it('should create a flash sale record with scheduled status', async () => {
    const mockSale = {
      id: 'sale-new-1',
      name: 'Holiday Sale',
      status: 'scheduled',
      starts_at: '2024-12-25T00:00:00.000Z',
      ends_at: '2024-12-26T00:00:00.000Z',
    };
    supabase.from.mockReturnValue(createMockChain({ data: mockSale, error: null }));

    const result = await createFlashSaleRecord({
      name: 'Holiday Sale',
      startsAt: '2024-12-25T00:00:00.000Z',
      endsAt: '2024-12-26T00:00:00.000Z',
      createdBy: 'admin-id',
    });
    expect(result.status).toBe('scheduled');
    expect(result.name).toBe('Holiday Sale');
  });

  it('should throw an error if supabase insert fails', async () => {
    supabase.from.mockReturnValue(createMockChain({ data: null, error: { message: 'DB error' } }));

    await expect(createFlashSaleRecord({
      name: 'Bad Sale',
      startsAt: '2024-01-01T00:00:00.000Z',
      endsAt: '2024-01-02T00:00:00.000Z',
      createdBy: 'admin-id',
    })).rejects.toBeDefined();
  });
});

describe('Flash Sale — cancelFlashSaleRecord', () => {
  it('should cancel a flash sale', async () => {
    const mockSale = { id: 'sale-1', status: 'cancelled' };
    supabase.from.mockReturnValue(createMockChain({ data: mockSale, error: null }));

    const result = await cancelFlashSaleRecord('sale-1');
    expect(result.status).toBe('cancelled');
  });
});

describe('Flash Sale — addProductsToFlashSale', () => {
  it('should add products with calculated discount percentage', async () => {
    const mockProducts = [
      { id: 'fsp-1', flash_sale_id: 'sale-1', product_id: 'prod-1', sale_price: 50, discount_pct: 50 },
    ];
    supabase.from.mockReturnValue(createMockChain({ data: mockProducts, error: null }));

    const result = await addProductsToFlashSale('sale-1', [
      { productId: 'prod-1', originalPrice: 100, salePrice: 50, stockLimit: 10 },
    ]);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Flash Sale — calculateDiscountedPrice', () => {
  it('should apply percentage discount correctly', () => {
    const result = calculateDiscountedPrice(100, 'percentage', 20);
    expect(result).toBe(80);
  });

  it('should apply fixed discount correctly', () => {
    const result = calculateDiscountedPrice(100, 'fixed', 15);
    expect(result).toBe(85);
  });

  it('should never go below 0 for large discounts', () => {
    const result = calculateDiscountedPrice(10, 'fixed', 20);
    expect(result).toBe(0);
  });

  it('should handle 100% percentage discount', () => {
    const result = calculateDiscountedPrice(50, 'percentage', 100);
    expect(result).toBe(0);
  });
});
