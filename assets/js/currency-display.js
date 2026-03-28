/**
 * currency-display.js
 *
 * Multi-currency pricing display for GlobexSky frontend.
 *
 * Features:
 *   - Renders a currency selector dropdown
 *   - Auto-detects the user's preferred currency on first visit
 *   - Persists selection in localStorage (key: gsky_currency)
 *   - Converts all elements with [data-price] attributes on currency change
 *   - Formats prices with correct locale and symbol
 *
 * Usage:
 *   Include this script on any page. Optionally, add a container with
 *   id="currency-selector-root" where the selector UI should be rendered.
 *
 *   Pricing elements:
 *     <span data-price="49.99" data-currency="USD">$49.99</span>
 *
 *   The script will convert and re-render all such elements whenever
 *   the selected currency changes.
 */

(function () {
  'use strict';

  const API_BASE = '/api/v1/currency-display';
  const LS_KEY = 'gsky_currency';

  // ─── State ─────────────────────────────────────────────────────────────────
  const state = {
    current: 'USD',
    rates: {},     // base USD → target
    currencies: [], // full list from /supported
    initialized: false,
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function getStoredCurrency() {
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  }

  function storeCurrency(code) {
    try { localStorage.setItem(LS_KEY, code); } catch { /* ignore */ }
  }

  async function apiFetch(path) {
    const resp = await fetch(API_BASE + path);
    if (!resp.ok) throw new Error(`API error ${resp.status}`);
    return resp.json();
  }

  /**
   * Convert an amount from USD (our stored base) to the target currency.
   * Uses the in-memory rates table fetched from /rates.
   */
  function convertAmount(amountUSD, toCurrency) {
    if (toCurrency === 'USD') return amountUSD;
    const rate = state.rates[toCurrency];
    if (!rate) return amountUSD;
    return Math.round(amountUSD * rate * 100) / 100;
  }

  /**
   * Format a number as a currency string using Intl.NumberFormat.
   */
  function formatAmount(amount, currencyCode) {
    const info = state.currencies.find(c => c.code === currencyCode);
    const locale = info?.locale || 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (_) {
      return `${info?.symbol || currencyCode} ${amount.toFixed(2)}`;
    }
  }

  // ─── DOM update ────────────────────────────────────────────────────────────

  /**
   * Re-render every [data-price] element with the current currency.
   * Each element must have:
   *   data-price    — original price in the base currency (data-currency or USD)
   *   data-currency — (optional) ISO code of the stored price; defaults to USD
   */
  function updatePriceElements() {
    const elements = document.querySelectorAll('[data-price]');
    elements.forEach(el => {
      const rawPrice = parseFloat(el.getAttribute('data-price'));
      if (isNaN(rawPrice)) return;

      // Convert to USD first (the universal base in our rates table)
      const srcCurrency = (el.getAttribute('data-currency') || 'USD').toUpperCase();
      let amountUSD = rawPrice;
      if (srcCurrency !== 'USD') {
        const srcRate = state.rates[srcCurrency];
        amountUSD = srcRate ? rawPrice / srcRate : rawPrice;
      }

      const converted = convertAmount(amountUSD, state.current);
      el.textContent = formatAmount(converted, state.current);
      el.setAttribute('data-converted-currency', state.current);
      el.setAttribute('data-converted-amount', converted);
    });
  }

  // ─── Selector UI ───────────────────────────────────────────────────────────

  function buildSelectorHTML() {
    const options = state.currencies
      .map(c => `<option value="${c.code}" ${c.code === state.current ? 'selected' : ''}>${c.symbol} ${c.code} — ${c.name}</option>`)
      .join('');

    return `
      <div class="gsky-currency-selector" role="region" aria-label="Currency selector">
        <label class="gsky-currency-label" for="gsky-currency-select">
          <span class="gsky-currency-icon" aria-hidden="true">💱</span>
          Currency
        </label>
        <div class="gsky-currency-select-wrap">
          <select id="gsky-currency-select" class="gsky-currency-select" aria-label="Select currency">
            ${options}
          </select>
        </div>
      </div>`;
  }

  function renderSelector() {
    const root = document.getElementById('currency-selector-root');
    if (!root) return;
    root.innerHTML = buildSelectorHTML();
    const select = root.querySelector('#gsky-currency-select');
    if (select) {
      select.addEventListener('change', e => {
        setCurrency(e.target.value);
      });
    }
  }

  function updateSelectorValue() {
    const select = document.getElementById('gsky-currency-select');
    if (select) select.value = state.current;
  }

  // ─── Currency change ───────────────────────────────────────────────────────

  function setCurrency(code) {
    if (!state.currencies.find(c => c.code === code)) return;
    state.current = code;
    storeCurrency(code);
    updateSelectorValue();
    updatePriceElements();
    document.dispatchEvent(new CustomEvent('gsky:currencyChanged', { detail: { currency: code } }));
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  async function init() {
    if (state.initialized) return;
    state.initialized = true;

    try {
      // 1. Load supported currencies
      const suppResp = await apiFetch('/supported');
      state.currencies = suppResp.data || [];

      // 2. Load exchange rates (USD base)
      const ratesResp = await apiFetch('/rates?base=USD');
      state.rates = ratesResp.data?.rates || {};

      // 3. Determine initial currency
      const stored = getStoredCurrency();
      if (stored && state.currencies.find(c => c.code === stored)) {
        state.current = stored;
      } else {
        // Auto-detect
        try {
          const detectResp = await apiFetch('/auto-detect');
          const detected = detectResp.data?.currency;
          if (detected && state.currencies.find(c => c.code === detected)) {
            state.current = detected;
          }
        } catch (_) { /* use default USD */ }
      }

      // 4. Render selector and update prices
      renderSelector();
      updatePriceElements();
    } catch (err) {
      console.warn('[GlobexSky] Currency display init failed:', err.message);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  window.GlobexCurrency = {
    init,
    setCurrency,
    getCurrency: () => state.current,
    formatAmount,
    convertAmount,
  };

  // Auto-init when the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
