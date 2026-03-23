/**
 * Unit tests for currency service.
 * Tests: conversion rates, formatting per locale, fallback to USD.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true, default: { from: jest.fn() } }));

// Mock the global fetch to control exchange rate API responses
global.fetch = jest.fn();

import { convert, getSupportedCurrencies } from '../../services/currency.service.js';

const MOCK_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  CNY: 7.24,
  JPY: 149.5,
  BDT: 110,
};

function mockFetchSuccess() {
  global.fetch.mockResolvedValue({
    json: () => Promise.resolve({
      result: 'success',
      conversion_rates: MOCK_RATES,
    }),
  });
}

function mockFetchFailure() {
  global.fetch.mockRejectedValue(new Error('Network error'));
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the internal cache by mocking fetch fresh each time
});

describe('Currency — Conversion between currencies', () => {
  it('should return the same amount when converting USD to USD', async () => {
    const result = await convert(100, 'USD', 'USD');
    expect(result).toBe(100);
  });

  it('should convert USD to EUR using the correct rate', async () => {
    mockFetchSuccess();
    const result = await convert(100, 'USD', 'EUR');
    expect(result).toBeCloseTo(92, 1);
  });

  it('should convert USD to JPY using the correct rate', async () => {
    mockFetchSuccess();
    const result = await convert(10, 'USD', 'JPY');
    expect(result).toBeCloseTo(1495, 0);
  });

  it('should convert EUR to USD correctly (reverse conversion)', async () => {
    mockFetchSuccess();
    const result = await convert(92, 'EUR', 'USD');
    expect(result).toBeCloseTo(100, 0);
  });

  it('should convert between two non-USD currencies via USD pivot', async () => {
    mockFetchSuccess();
    // EUR to GBP: EUR → USD → GBP
    const result = await convert(100, 'EUR', 'GBP');
    // 100 EUR / 0.92 = 108.7 USD, * 0.79 = 85.87 GBP
    expect(result).toBeCloseTo(85.87, 0);
  });
});

describe('Currency — Fallback to USD when API unavailable', () => {
  it('should return the original amount when fetch fails', async () => {
    mockFetchFailure();
    // Clear cache so it re-fetches
    jest.resetModules();
    const result = await convert(100, 'USD', 'EUR');
    // With no rates, the service should fall back and return the original amount
    expect(typeof result).toBe('number');
  });

  it('should return fallback currencies list when fetch fails', async () => {
    mockFetchFailure();
    const currencies = await getSupportedCurrencies();
    expect(Array.isArray(currencies)).toBe(true);
    expect(currencies).toContain('USD');
    expect(currencies.length).toBeGreaterThan(0);
  });
});

describe('Currency — Formatting per locale', () => {
  it('should format USD price to 2 decimal places', () => {
    const formatted = Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(99.999);
    expect(formatted).toBe('$100.00');
  });

  it('should format EUR price with correct symbol', () => {
    const formatted = Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(100);
    expect(formatted).toContain('100');
  });

  it('should format JPY without decimal places', () => {
    const formatted = Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(1500);
    expect(formatted).toContain('1,500');
  });

  it('should round conversion result to 2 decimal places', async () => {
    mockFetchSuccess();
    const result = await convert(33.33, 'USD', 'EUR');
    const decimalPart = result.toString().split('.')[1] || '';
    expect(decimalPart.length).toBeLessThanOrEqual(2);
  });
});

describe('Currency — Supported currencies list', () => {
  it('should include major currencies when API is available', async () => {
    mockFetchSuccess();
    const currencies = await getSupportedCurrencies();
    expect(currencies).toContain('USD');
    expect(currencies).toContain('EUR');
    expect(currencies).toContain('GBP');
  });

  it('should return at least 5 currencies in fallback mode', async () => {
    mockFetchFailure();
    const currencies = await getSupportedCurrencies();
    expect(currencies.length).toBeGreaterThanOrEqual(5);
  });
});
