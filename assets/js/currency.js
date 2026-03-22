/**
 * Globex Sky — currency.js
 * Currency management: fetch exchange rates, convert prices,
 * currency selector UI, locale-aware formatting, hourly cache.
 */

const Currency = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────── */
  const STORAGE_KEY   = 'globexCurrencyRates';
  const PREF_KEY      = 'globexCurrency';
  const HOUR_IN_MS    = 60 * 60 * 1000;
  const CACHE_TTL     = HOUR_IN_MS; // refresh exchange rates every hour

  const SUPPORTED = {
    USD: { symbol: '$',  name: 'US Dollar',          locale: 'en-US' },
    EUR: { symbol: '€',  name: 'Euro',                locale: 'de-DE' },
    GBP: { symbol: '£',  name: 'British Pound',       locale: 'en-GB' },
    JPY: { symbol: '¥',  name: 'Japanese Yen',        locale: 'ja-JP' },
    CNY: { symbol: '¥',  name: 'Chinese Yuan',        locale: 'zh-CN' },
    INR: { symbol: '₹',  name: 'Indian Rupee',        locale: 'en-IN' },
    BDT: { symbol: '৳',  name: 'Bangladeshi Taka',    locale: 'bn-BD' },
    AED: { symbol: 'د.إ',name: 'UAE Dirham',           locale: 'ar-AE' },
    SAR: { symbol: '﷼',  name: 'Saudi Riyal',          locale: 'ar-SA' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar',     locale: 'en-CA' },
    AUD: { symbol: 'A$', name: 'Australian Dollar',   locale: 'en-AU' },
    CHF: { symbol: 'Fr', name: 'Swiss Franc',         locale: 'de-CH' },
    KRW: { symbol: '₩',  name: 'South Korean Won',    locale: 'ko-KR' },
    SGD: { symbol: 'S$', name: 'Singapore Dollar',    locale: 'en-SG' },
    MYR: { symbol: 'RM', name: 'Malaysian Ringgit',   locale: 'ms-MY' },
    IDR: { symbol: 'Rp', name: 'Indonesian Rupiah',   locale: 'id-ID' },
    THB: { symbol: '฿',  name: 'Thai Baht',            locale: 'th-TH' },
    BRL: { symbol: 'R$', name: 'Brazilian Real',      locale: 'pt-BR' },
    MXN: { symbol: 'MX$',name: 'Mexican Peso',         locale: 'es-MX' },
    TRY: { symbol: '₺',  name: 'Turkish Lira',         locale: 'tr-TR' },
    RUB: { symbol: '₽',  name: 'Russian Ruble',        locale: 'ru-RU' },
    ZAR: { symbol: 'R',  name: 'South African Rand',  locale: 'en-ZA' },
    NGN: { symbol: '₦',  name: 'Nigerian Naira',       locale: 'en-NG' },
    PKR: { symbol: '₨',  name: 'Pakistani Rupee',      locale: 'en-PK' },
  };

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  let _rates   = { USD: 1 }; // base = USD
  let _current = (localStorage.getItem(PREF_KEY) || window.GlobexConfig?.DEFAULT_CURRENCY || 'USD');

  /* ─────────────────────────────────────────────
     CACHE HELPERS
  ───────────────────────────────────────────── */
  function _loadCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (raw && raw.ts && Date.now() - raw.ts < CACHE_TTL) {
        _rates = raw.rates;
        return true;
      }
    } catch (_) {}
    return false;
  }

  function _saveCache(rates) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), rates }));
  }

  /* ─────────────────────────────────────────────
     RATE FETCHING
  ───────────────────────────────────────────── */
  async function fetchRates() {
    if (_loadCache()) return _rates;

    try {
      // Try backend first (proxies an exchange-rate API)
      const baseURL = window.GlobexConfig?.API_BASE_URL || '/api/v1';
      const res = await fetch(`${baseURL}/currency/rates?base=USD`);
      if (res.ok) {
        const json = await res.json();
        const rates = json.data?.rates || json.rates;
        if (rates) {
          _rates = { USD: 1, ...rates };
          _saveCache(_rates);
          return _rates;
        }
      }
    } catch (_) { /* fall through to open API */ }

    try {
      // Public fallback — exchangerate.host (no key needed)
      const res = await fetch('https://api.exchangerate.host/latest?base=USD');
      if (res.ok) {
        const json = await res.json();
        _rates = { USD: 1, ...json.rates };
        _saveCache(_rates);
      }
    } catch (_) { /* use fallback static rates */ }

    return _rates;
  }

  /* ─────────────────────────────────────────────
     CONVERSION
  ───────────────────────────────────────────── */
  /**
   * Convert an amount from one currency to another.
   * @param {number} amount
   * @param {string} from  - source currency code (default: USD)
   * @param {string} to    - target currency code (default: current)
   * @returns {number}
   */
  function convert(amount, from = 'USD', to = _current) {
    if (from === to) return amount;
    const rateFrom = _rates[from] || 1;
    const rateTo   = _rates[to]   || 1;
    return (amount / rateFrom) * rateTo;
  }

  /**
   * Format a price amount in the specified currency.
   * @param {number} amount   - amount in the given currency
   * @param {string} currency - ISO 4217 code (default: current)
   * @returns {string}
   */
  function format(amount, currency = _current) {
    const meta = SUPPORTED[currency];
    try {
      return new Intl.NumberFormat(meta?.locale || 'en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
        maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
      }).format(amount);
    } catch (_) {
      return `${meta?.symbol || currency} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Convert from USD then format.
   * @param {number} usdAmount
   * @param {string} [toCurrency]
   * @returns {string}
   */
  function formatFromUSD(usdAmount, toCurrency = _current) {
    return format(convert(usdAmount, 'USD', toCurrency), toCurrency);
  }

  /* ─────────────────────────────────────────────
     CURRENT CURRENCY
  ───────────────────────────────────────────── */
  function getCurrent() { return _current; }

  function setCurrent(code) {
    if (!SUPPORTED[code]) return;
    _current = code;
    localStorage.setItem(PREF_KEY, code);
    _updateAllPrices();
    _updateSelectorUI(code);
    document.dispatchEvent(new CustomEvent('currency:changed', { detail: { currency: code } }));
  }

  /* ─────────────────────────────────────────────
     DOM — UPDATE ALL PRICES
  ───────────────────────────────────────────── */
  function _updateAllPrices() {
    document.querySelectorAll('[data-price-usd]').forEach((el) => {
      const usd = parseFloat(el.dataset.priceUsd);
      if (!isNaN(usd)) el.textContent = formatFromUSD(usd);
    });
  }

  /* ─────────────────────────────────────────────
     DOM — CURRENCY SELECTOR
  ───────────────────────────────────────────── */
  function _buildSelectorOptions(selectEl) {
    selectEl.innerHTML = '';
    Object.entries(SUPPORTED).forEach(([code, meta]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${code} — ${meta.name}`;
      if (code === _current) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  function _updateSelectorUI(code) {
    document.querySelectorAll('[data-currency-selector], .currency-selector').forEach((el) => {
      if (el.tagName === 'SELECT') {
        el.value = code;
      } else {
        el.textContent = code;
      }
    });
    // Update visible label in dropdowns
    document.querySelectorAll('[data-currency-label]').forEach((el) => {
      const meta = SUPPORTED[code];
      el.textContent = meta ? `${code} ${meta.symbol}` : code;
    });
  }

  function initSelector() {
    document.querySelectorAll('[data-currency-selector], .currency-selector').forEach((el) => {
      if (el.tagName === 'SELECT') {
        _buildSelectorOptions(el);
        el.addEventListener('change', () => setCurrent(el.value));
      } else {
        // Dropdown trigger button
        el.addEventListener('click', (e) => e.stopPropagation());
      }
    });

    // Option items in a custom dropdown
    document.querySelectorAll('[data-set-currency]').forEach((el) => {
      el.addEventListener('click', () => setCurrent(el.dataset.setCurrency));
    });

    _updateSelectorUI(_current);
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  async function init() {
    await fetchRates();
    initSelector();
    _updateAllPrices();

    // Auto-refresh rates every hour
    setInterval(async () => {
      localStorage.removeItem(STORAGE_KEY); // bust cache
      await fetchRates();
      _updateAllPrices();
    }, CACHE_TTL);
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  return {
    init,
    fetchRates,
    convert,
    format,
    formatFromUSD,
    getCurrent,
    setCurrent,
    initSelector,
    SUPPORTED,
  };
})();

window.Currency = Currency;
