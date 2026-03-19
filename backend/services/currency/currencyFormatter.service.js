import { SUPPORTED_CURRENCIES } from '../../config/currency.config.js';

const currencyMap = Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c.code, c]));

/**
 * Format a numeric amount as a currency string.
 * @param {number} amount
 * @param {string} currencyCode
 * @returns {string}
 */
export function formatCurrency(amount, currencyCode) {
  const info = currencyMap[currencyCode];
  if (!info) return `${amount} ${currencyCode}`;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(amount);
  } catch {
    // Fallback for currencies not supported by Intl
    const fixed = amount.toFixed(info.decimals);
    return `${info.symbol}${fixed}`;
  }
}

/**
 * Get just the symbol for a currency code.
 * @param {string} currencyCode
 * @returns {string}
 */
export function getCurrencySymbol(currencyCode) {
  return currencyMap[currencyCode]?.symbol ?? currencyCode;
}

/**
 * Get full currency info object.
 * @param {string} currencyCode
 * @returns {object|null}
 */
export function getCurrencyInfo(currencyCode) {
  return currencyMap[currencyCode] ?? null;
}
