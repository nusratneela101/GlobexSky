/**
 * currencyConversion.service.js
 *
 * Fetch live exchange rates, cache them in-process, and convert prices.
 * Rate source: exchangerate-api.com (free tier, no key required for open endpoint).
 * Falls back to cached DB rates when the API is unavailable.
 */

import CurrencyRate from '../models/CurrencyRate.js';

// ─── In-memory cache ──────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const rateCache = new Map(); // key: `${base}_${target}` → { rate, expiresAt }
let allRatesCache = null;
let allRatesCacheExpiry = 0;

// Base currency used when fetching a full rates table
const DEFAULT_BASE = 'USD';

// List of commonly-used currencies shown in the selector UI
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar',            symbol: '$',  locale: 'en-US' },
  { code: 'EUR', name: 'Euro',                 symbol: '€',  locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound',        symbol: '£',  locale: 'en-GB' },
  { code: 'JPY', name: 'Japanese Yen',         symbol: '¥',  locale: 'ja-JP' },
  { code: 'CNY', name: 'Chinese Yuan',         symbol: '¥',  locale: 'zh-CN' },
  { code: 'INR', name: 'Indian Rupee',         symbol: '₹',  locale: 'en-IN' },
  { code: 'BDT', name: 'Bangladeshi Taka',     symbol: '৳',  locale: 'bn-BD' },
  { code: 'AED', name: 'UAE Dirham',           symbol: 'د.إ', locale: 'ar-AE' },
  { code: 'SAR', name: 'Saudi Riyal',          symbol: '﷼',  locale: 'ar-SA' },
  { code: 'MYR', name: 'Malaysian Ringgit',    symbol: 'RM', locale: 'ms-MY' },
  { code: 'SGD', name: 'Singapore Dollar',     symbol: 'S$', locale: 'en-SG' },
  { code: 'AUD', name: 'Australian Dollar',    symbol: 'A$', locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar',      symbol: 'C$', locale: 'en-CA' },
  { code: 'CHF', name: 'Swiss Franc',          symbol: 'Fr', locale: 'de-CH' },
  { code: 'KRW', name: 'South Korean Won',     symbol: '₩',  locale: 'ko-KR' },
  { code: 'THB', name: 'Thai Baht',            symbol: '฿',  locale: 'th-TH' },
  { code: 'IDR', name: 'Indonesian Rupiah',    symbol: 'Rp', locale: 'id-ID' },
  { code: 'TRY', name: 'Turkish Lira',         symbol: '₺',  locale: 'tr-TR' },
  { code: 'BRL', name: 'Brazilian Real',       symbol: 'R$', locale: 'pt-BR' },
  { code: 'MXN', name: 'Mexican Peso',         symbol: 'MX$', locale: 'es-MX' },
  { code: 'ZAR', name: 'South African Rand',   symbol: 'R',  locale: 'en-ZA' },
  { code: 'NGN', name: 'Nigerian Naira',       symbol: '₦',  locale: 'en-NG' },
  { code: 'EGP', name: 'Egyptian Pound',       symbol: 'E£', locale: 'ar-EG' },
  { code: 'PKR', name: 'Pakistani Rupee',      symbol: '₨',  locale: 'ur-PK' },
  { code: 'RUB', name: 'Russian Ruble',        symbol: '₽',  locale: 'ru-RU' },
];

const SUPPORTED_CODES = new Set(SUPPORTED_CURRENCIES.map(c => c.code));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cacheKey(base, target) {
  return `${base}_${target}`;
}

function getCachedRate(base, target) {
  const entry = rateCache.get(cacheKey(base, target));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    rateCache.delete(cacheKey(base, target));
    return null;
  }
  return entry.rate;
}

function setCachedRate(base, target, rate) {
  rateCache.set(cacheKey(base, target), { rate, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Round a value to 2 decimal places (cents).
 * @param {number} value
 * @returns {number}
 */
function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

// ─── Live rate fetching ───────────────────────────────────────────────────────

/**
 * Fetch all rates from exchangerate-api (open endpoint, no key needed).
 * Stores results in DB and updates in-memory cache.
 * @param {string} [base='USD']
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchLiveRates(base = DEFAULT_BASE) {
  const url = `https://open.er-api.com/v6/latest/${base}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  let resp;
  try {
    resp = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!resp.ok) throw new Error(`Exchange rate API error: ${resp.status}`);
  const json = await resp.json();
  if (json.result !== 'success') throw new Error('Exchange rate API returned failure');

  const rates = json.rates ?? {};

  // Persist to DB (non-blocking failure)
  CurrencyRate.bulkUpsert(base, rates, 'open.er-api.com').catch(err => {
    console.warn('[CurrencyConversion] Failed to persist rates to DB:', err.message);
  });

  // Update in-memory cache
  for (const [target, rate] of Object.entries(rates)) {
    setCachedRate(base, target, rate);
  }

  return rates;
}

/**
 * Get all exchange rates for the base currency.
 * Uses in-memory cache first, then DB, then live API.
 * @param {string} [base='USD']
 * @returns {Promise<Record<string, number>>}
 */
export async function getAllRates(base = DEFAULT_BASE) {
  const now = Date.now();
  if (allRatesCache && base === DEFAULT_BASE && now < allRatesCacheExpiry) {
    return allRatesCache;
  }

  // Try live API
  try {
    const rates = await fetchLiveRates(base);
    if (base === DEFAULT_BASE) {
      allRatesCache = rates;
      allRatesCacheExpiry = now + CACHE_TTL_MS;
    }
    return rates;
  } catch (_err) {
    // Fall back to DB
    const rows = await CurrencyRate.findByBase(base);
    if (rows.length > 0) {
      const rates = Object.fromEntries(rows.map(r => [r.target_currency, r.rate]));
      if (base === DEFAULT_BASE) {
        allRatesCache = rates;
        allRatesCacheExpiry = now + CACHE_TTL_MS;
      }
      return rates;
    }
    throw new Error('Exchange rates unavailable');
  }
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Get the exchange rate between two currencies.
 * @param {string} from
 * @param {string} to
 * @returns {Promise<number>}
 */
export async function getRate(from, to) {
  from = from.toUpperCase();
  to = to.toUpperCase();
  if (from === to) return 1;

  // Check in-memory cache
  const cached = getCachedRate(from, to);
  if (cached !== null) return cached;

  // If from === DEFAULT_BASE we can get it from allRates
  if (from === DEFAULT_BASE) {
    const rates = await getAllRates(DEFAULT_BASE);
    const rate = rates[to];
    if (!rate) throw new Error(`Unsupported currency: ${to}`);
    setCachedRate(from, to, rate);
    return rate;
  }

  // Convert via DEFAULT_BASE as pivot:  from → USD → to
  const ratesFrom = await getAllRates(DEFAULT_BASE);
  const fromToUsd = ratesFrom[from];
  const usdToTo = ratesFrom[to];
  if (!fromToUsd || !usdToTo) throw new Error(`Unsupported currency pair: ${from}/${to}`);
  const rate = usdToTo / fromToUsd;
  setCachedRate(from, to, rate);
  return rate;
}

/**
 * Convert a single price from one currency to another.
 * @param {number} amount
 * @param {string} from  ISO 4217 code
 * @param {string} to    ISO 4217 code
 * @returns {Promise<{ amount: number, from: string, to: string, rate: number }>}
 */
export async function convertPrice(amount, from, to) {
  const rate = await getRate(from, to);
  return {
    amount: roundToCents(amount * rate),
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    rate,
  };
}

/**
 * Bulk convert an array of prices.
 * @param {number[]} amounts
 * @param {string} from
 * @param {string} to
 * @returns {Promise<{ amounts: number[], from: string, to: string, rate: number }>}
 */
export async function bulkConvertPrices(amounts, from, to) {
  const rate = await getRate(from, to);
  return {
    amounts: amounts.map(a => roundToCents(a * rate)),
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    rate,
  };
}

/**
 * Detect likely currency from Accept-Language or X-Forwarded-For headers.
 * This is a best-effort heuristic; for production you'd use a GeoIP database.
 * @param {object} req  Express request
 * @returns {string}  ISO 4217 code
 */
export function detectCurrencyFromRequest(req) {
  // Check Accept-Language header (e.g. 'en-US,en;q=0.9')
  const lang = req.headers['accept-language'] || '';
  const primary = lang.split(',')[0].trim(); // e.g. 'en-US'
  const region = primary.split('-')[1]?.toUpperCase(); // e.g. 'US'

  const regionMap = {
    US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', NZ: 'NZD',
    DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
    AT: 'EUR', PT: 'EUR', FI: 'EUR', IE: 'EUR', GR: 'EUR', LU: 'EUR',
    JP: 'JPY', CN: 'CNY', IN: 'INR', BD: 'BDT', AE: 'AED', SA: 'SAR',
    MY: 'MYR', SG: 'SGD', KR: 'KRW', TH: 'THB', ID: 'IDR', TR: 'TRY',
    BR: 'BRL', MX: 'MXN', ZA: 'ZAR', NG: 'NGN', EG: 'EGP', PK: 'PKR',
    RU: 'RUB', CH: 'CHF',
  };

  const detected = region && regionMap[region];
  if (detected && SUPPORTED_CODES.has(detected)) return detected;

  // Fallback: try matching the language tag itself (e.g. 'zh' → CNY)
  const langCode = primary.split('-')[0].toUpperCase();
  const langMap = { ZH: 'CNY', JA: 'JPY', KO: 'KRW', AR: 'AED', HI: 'INR' };
  const fromLang = langMap[langCode];
  if (fromLang && SUPPORTED_CODES.has(fromLang)) return fromLang;

  return DEFAULT_BASE; // default to USD
}

/**
 * Format a price for display given an ISO currency code.
 * @param {number} amount
 * @param {string} currencyCode
 * @param {string} [locale]
 * @returns {string}
 */
export function formatPrice(amount, currencyCode, locale) {
  const info = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode.toUpperCase());
  const resolvedLocale = locale || info?.locale || 'en-US';
  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
    }).format(amount);
  } catch (_err) {
    return `${info?.symbol ?? currencyCode} ${amount.toFixed(2)}`;
  }
}
