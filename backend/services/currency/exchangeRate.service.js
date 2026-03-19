import { SUPPORTED_CURRENCIES, FALLBACK_RATES, RATE_REFRESH_INTERVAL_MS, BASE_CURRENCY } from '../../config/currency.config.js';

// ─── In-memory rate cache ─────────────────────────────────────────────────────
let rateCache = {
  base: BASE_CURRENCY,
  rates: { ...FALLBACK_RATES },
  fetchedAt: null,
};

// ─── Fetch latest exchange rates (mocked — swap for real API in production) ───
export async function fetchLatestRates(baseCurrency = BASE_CURRENCY) {
  const now = Date.now();

  // Return cached rates if still fresh
  if (rateCache.fetchedAt && (now - rateCache.fetchedAt) < RATE_REFRESH_INTERVAL_MS && rateCache.base === baseCurrency) {
    return { ...rateCache };
  }

  // Build rates relative to the requested base currency
  const usdToBase = FALLBACK_RATES[baseCurrency] ?? 1;
  const rates = {};
  for (const [code, usdRate] of Object.entries(FALLBACK_RATES)) {
    rates[code] = parseFloat((usdRate / usdToBase).toFixed(6));
  }

  rateCache = { base: baseCurrency, rates, fetchedAt: now };
  return { ...rateCache };
}

// ─── Convert amount between currencies ───────────────────────────────────────
export async function convert(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return { amount, fromCurrency, toCurrency, result: amount, rate: 1 };

  const { rates } = await fetchLatestRates(BASE_CURRENCY);

  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (!fromRate || !toRate) throw new Error(`Unsupported currency: ${fromCurrency} or ${toCurrency}`);

  // Convert via USD as the bridge
  const amountInUsd = amount / fromRate;
  const result = parseFloat((amountInUsd * toRate).toFixed(4));
  const rate = parseFloat((toRate / fromRate).toFixed(6));

  return { amount, fromCurrency, toCurrency, result, rate };
}

// ─── Get supported currencies list ───────────────────────────────────────────
export function getSupportedCurrencies() {
  return SUPPORTED_CURRENCIES;
}

// ─── Historical rates (mocked — in production, fetch from historical API) ────
export async function getHistoricalRates(baseCurrency = BASE_CURRENCY, date) {
  // Simulate slight variance from fallback rates for historical data
  const variance = date ? 0.97 + Math.random() * 0.06 : 1;
  const usdToBase = FALLBACK_RATES[baseCurrency] ?? 1;
  const rates = {};
  for (const [code, usdRate] of Object.entries(FALLBACK_RATES)) {
    rates[code] = parseFloat(((usdRate / usdToBase) * variance).toFixed(6));
  }
  return { base: baseCurrency, date: date ?? new Date().toISOString().split('T')[0], rates };
}
