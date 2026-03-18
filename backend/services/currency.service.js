/**
 * Currency conversion service.
 * Fetches live exchange rates from ExchangeRate-API.
 */

const BASE_CURRENCY = 'USD';
let ratesCache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getRates() {
  if (ratesCache && Date.now() - cacheTime < CACHE_TTL) return ratesCache;

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) throw new Error('Exchange rate API key not configured.');
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${BASE_CURRENCY}`);
    const json = await res.json();
    if (json.result !== 'success') throw new Error('Failed to fetch exchange rates.');
    ratesCache = json.conversion_rates;
    cacheTime = Date.now();
    return ratesCache;
  } catch (err) {
    console.error('[CurrencyService]', err.message);
    return null;
  }
}

/**
 * Convert an amount from one currency to another.
 */
export async function convert(amount, from = 'USD', to = 'USD') {
  if (from === to) return amount;
  const rates = await getRates();
  if (!rates) return amount; // Fallback: no conversion
  const inUSD = from === 'USD' ? amount : amount / (rates[from] || 1);
  const converted = to === 'USD' ? inUSD : inUSD * (rates[to] || 1);
  return +converted.toFixed(2);
}

export async function getSupportedCurrencies() {
  const rates = await getRates();
  return rates ? Object.keys(rates) : ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CNY', 'JPY'];
}
