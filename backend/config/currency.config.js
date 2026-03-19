/**
 * Currency configuration for Globex Sky.
 */
export const BASE_CURRENCY = 'USD';

/** How often to refresh exchange rates (milliseconds). Default: 1 hour. Override via env for faster refresh cycles. */
export const RATE_REFRESH_INTERVAL_MS = Number(process.env.CURRENCY_REFRESH_MS) || 3_600_000;

/**
 * Supported currencies with metadata.
 * Fields: code, name, symbol, flag, decimals
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar',           symbol: '$',   flag: '🇺🇸', decimals: 2 },
  { code: 'EUR', name: 'Euro',                symbol: '€',   flag: '🇪🇺', decimals: 2 },
  { code: 'GBP', name: 'British Pound',       symbol: '£',   flag: '🇬🇧', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka',    symbol: '৳',   flag: '🇧🇩', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan',        symbol: '¥',   flag: '🇨🇳', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen',        symbol: '¥',   flag: '🇯🇵', decimals: 0 },
  { code: 'INR', name: 'Indian Rupee',        symbol: '₹',   flag: '🇮🇳', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham',          symbol: 'د.إ', flag: '🇦🇪', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal',         symbol: '﷼',   flag: '🇸🇦', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit',   symbol: 'RM',  flag: '🇲🇾', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar',    symbol: 'S$',  flag: '🇸🇬', decimals: 2 },
  { code: 'THB', name: 'Thai Baht',           symbol: '฿',   flag: '🇹🇭', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won',    symbol: '₩',   flag: '🇰🇷', decimals: 0 },
  { code: 'AUD', name: 'Australian Dollar',   symbol: 'A$',  flag: '🇦🇺', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar',     symbol: 'C$',  flag: '🇨🇦', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc',         symbol: 'CHF', flag: '🇨🇭', decimals: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar',    symbol: 'HK$', flag: '🇭🇰', decimals: 2 },
  { code: 'TWD', name: 'Taiwan Dollar',       symbol: 'NT$', flag: '🇹🇼', decimals: 2 },
  { code: 'PHP', name: 'Philippine Peso',     symbol: '₱',   flag: '🇵🇭', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah',   symbol: 'Rp',  flag: '🇮🇩', decimals: 0 },
  { code: 'VND', name: 'Vietnamese Dong',     symbol: '₫',   flag: '🇻🇳', decimals: 0 },
  { code: 'PKR', name: 'Pakistani Rupee',     symbol: '₨',   flag: '🇵🇰', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee',    symbol: 'Rs',  flag: '🇱🇰', decimals: 2 },
  { code: 'NGN', name: 'Nigerian Naira',      symbol: '₦',   flag: '🇳🇬', decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling',     symbol: 'KSh', flag: '🇰🇪', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand',  symbol: 'R',   flag: '🇿🇦', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real',      symbol: 'R$',  flag: '🇧🇷', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso',        symbol: '$',   flag: '🇲🇽', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira',        symbol: '₺',   flag: '🇹🇷', decimals: 2 },
  { code: 'RUB', name: 'Russian Ruble',       symbol: '₽',   flag: '🇷🇺', decimals: 2 },
];

/**
 * Fallback rates relative to USD (used when external API is unavailable).
 */
export const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  BDT: 110.5,
  CNY: 7.24,
  JPY: 149.5,
  INR: 83.1,
  AED: 3.67,
  SAR: 3.75,
  MYR: 4.71,
  SGD: 1.35,
  THB: 35.1,
  KRW: 1325.0,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.90,
  HKD: 7.82,
  TWD: 31.9,
  PHP: 56.4,
  IDR: 15650.0,
  VND: 24350.0,
  PKR: 278.5,
  LKR: 321.0,
  NGN: 1550.0,
  KES: 128.5,
  ZAR: 18.9,
  BRL: 4.97,
  MXN: 17.2,
  TRY: 32.1,
  RUB: 92.5,
};
