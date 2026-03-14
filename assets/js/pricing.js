/**
 * GlobexSky - pricing.js
 * Parcel shipping price calculator.
 *
 * Pricing rules:
 *   Base rate per kg:
 *     Zone 1 (US / CA / MX)           $5 / kg
 *     Zone 2 (EU / UK)                $8 / kg
 *     Zone 3 (Middle East / Asia)     $12 / kg
 *     Zone 4 (Africa / Others)        $15 / kg
 *
 *   Minimum charge: $15
 *   Volumetric weight: (L × W × H) / 5000  (cm³ → kg)
 *   Chargeable weight: max(actual, volumetric)
 *
 *   Speed multipliers:
 *     Standard  × 1.0
 *     Express   × 1.8
 *     Economy   × 0.85
 *
 *   Add-ons:
 *     Insurance          $5
 *     Fragile Handling   $3
 *     Customs Clearance  $10
 */

/* ─────────────────────────────────────────────
   ZONE MAP
───────────────────────────────────────────── */

/** Countries grouped by shipping zone. */
const ZONE_MAP = {
  1: ['US', 'CA', 'MX'],
  2: [
    'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE',
    'NO', 'DK', 'FI', 'PL', 'PT', 'IE', 'CZ', 'HU', 'RO', 'GR',
    'HR', 'BG', 'SK', 'LT', 'LV', 'EE', 'SI', 'LU', 'MT', 'CY',
  ],
  3: [
    // Middle East
    'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'TR', 'IL',
    'IQ', 'IR', 'YE', 'SY',
    // Asia-Pacific
    'CN', 'JP', 'KR', 'IN', 'SG', 'MY', 'TH', 'ID', 'PH', 'VN',
    'PK', 'BD', 'LK', 'NP', 'MM', 'KH', 'LA', 'TW', 'HK', 'MO',
    'MN', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'AF',
    // Oceania
    'AU', 'NZ',
  ],
};

const ZONE_RATES = {
  1: 5,
  2: 8,
  3: 12,
  4: 15, // Africa / Rest of World
};

const SPEED_MULTIPLIERS = {
  standard: 1.0,
  express: 1.8,
  economy: 0.85,
};

const ADDON_PRICES = {
  insurance: 5,
  fragile: 3,
  customs: 10,
};

const MINIMUM_CHARGE = 15;

/* ─────────────────────────────────────────────
   ZONE LOOKUP
───────────────────────────────────────────── */

/**
 * Determine the shipping zone number for a given country code.
 * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. "US", "DE").
 * @returns {1|2|3|4}
 */
function getZone(countryCode) {
  const code = (countryCode || '').toUpperCase().trim();
  for (const [zone, countries] of Object.entries(ZONE_MAP)) {
    if (countries.includes(code)) return Number(zone);
  }
  return 4; // Default: Zone 4 (Africa / Others)
}

/* ─────────────────────────────────────────────
   CORE CALCULATION
───────────────────────────────────────────── */

/**
 * Calculate the shipping price for a parcel.
 *
 * @param {{
 *   country  : string,   — ISO 3166-1 alpha-2 country code
 *   weight   : number,   — actual weight in kg
 *   length   : number,   — parcel length in cm
 *   width    : number,   — parcel width in cm
 *   height   : number,   — parcel height in cm
 *   speed    : 'standard'|'express'|'economy',
 *   addons   : string[]  — any of: 'insurance', 'fragile', 'customs'
 * }} params
 *
 * @returns {{
 *   zone             : number,
 *   baseRate         : number,   — $/kg for the zone
 *   actualWeight     : number,
 *   volumetricWeight : number,
 *   chargeableWeight : number,
 *   baseCharge       : number,
 *   speed            : string,
 *   speedMultiplier  : number,
 *   speedCharge      : number,
 *   addons           : string[],
 *   addonsBreakdown  : { name: string, price: number }[],
 *   addonsTotal      : number,
 *   subtotal         : number,
 *   minimumApplied   : boolean,
 *   total            : number,
 * }}
 */
function calculateParcelPrice({ country, weight, length, width, height, speed = 'standard', addons = [] }) {
  const actualWeight = Math.max(0, Number(weight) || 0);
  const l = Math.max(0, Number(length) || 0);
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);

  // Volumetric weight (cm³ / 5000 = kg)
  const volumetricWeight = (l * w * h) / 5000;

  // Chargeable weight is the greater of actual and volumetric
  const chargeableWeight = Math.max(actualWeight, volumetricWeight);

  const zone = getZone(country);
  const baseRate = ZONE_RATES[zone];
  const baseCharge = chargeableWeight * baseRate;

  const speedKey = (speed || 'standard').toLowerCase();
  const speedMultiplier = SPEED_MULTIPLIERS[speedKey] ?? 1.0;
  const speedCharge = baseCharge * speedMultiplier;

  // Add-ons
  const addonsBreakdown = (addons || [])
    .filter((a) => ADDON_PRICES[a] !== undefined)
    .map((a) => ({ name: a, price: ADDON_PRICES[a] }));
  const addonsTotal = addonsBreakdown.reduce((sum, a) => sum + a.price, 0);

  const subtotal = speedCharge + addonsTotal;
  const minimumApplied = subtotal < MINIMUM_CHARGE;
  const total = minimumApplied ? MINIMUM_CHARGE : subtotal;

  return {
    zone,
    baseRate,
    actualWeight: +actualWeight.toFixed(3),
    volumetricWeight: +volumetricWeight.toFixed(3),
    chargeableWeight: +chargeableWeight.toFixed(3),
    baseCharge: +baseCharge.toFixed(2),
    speed: speedKey,
    speedMultiplier,
    speedCharge: +speedCharge.toFixed(2),
    addons: addons || [],
    addonsBreakdown,
    addonsTotal: +addonsTotal.toFixed(2),
    subtotal: +subtotal.toFixed(2),
    minimumApplied,
    total: +total.toFixed(2),
  };
}

/* ─────────────────────────────────────────────
   DOM RENDERER
───────────────────────────────────────────── */

/** Map add-on keys to human-readable labels. */
const ADDON_LABELS = {
  insurance: 'Insurance',
  fragile: 'Fragile Handling',
  customs: 'Customs Clearance',
};

const ZONE_NAMES = {
  1: 'Zone 1 — US / CA / MX',
  2: 'Zone 2 — Europe & UK',
  3: 'Zone 3 — Middle East & Asia',
  4: 'Zone 4 — Africa & Others',
};

/**
 * Render a price breakdown table into a DOM container.
 * @param {ReturnType<calculateParcelPrice>} breakdown
 * @param {HTMLElement} container
 */
function renderPriceBreakdown(breakdown, container) {
  if (!container) return;

  const currency = localStorage.getItem('globexCurrency') || 'USD';
  const symbol = window.GlobexSky?.CURRENCY_SYMBOLS?.[currency] || '$';

  const fmt = (n) => `${symbol}${Number(n).toFixed(2)}`;
  const speedLabel = breakdown.speed.charAt(0).toUpperCase() + breakdown.speed.slice(1);

  const addonRows = breakdown.addonsBreakdown.length
    ? breakdown.addonsBreakdown
        .map(
          (a) => `
        <tr>
          <td>${ADDON_LABELS[a.name] || a.name}</td>
          <td class="text-right">${fmt(a.price)}</td>
        </tr>`
        )
        .join('')
    : '';

  container.innerHTML = `
    <div class="price-breakdown">
      <h3 class="breakdown-title">Shipping Cost Breakdown</h3>

      <table class="breakdown-table">
        <tbody>
          <tr class="breakdown-zone">
            <td>Shipping Zone</td>
            <td class="text-right">${ZONE_NAMES[breakdown.zone] || `Zone ${breakdown.zone}`}</td>
          </tr>
          <tr>
            <td>Rate per kg</td>
            <td class="text-right">${fmt(breakdown.baseRate)} / kg</td>
          </tr>
          <tr>
            <td>Actual Weight</td>
            <td class="text-right">${breakdown.actualWeight} kg</td>
          </tr>
          <tr>
            <td>Volumetric Weight <small>(L×W×H / 5000)</small></td>
            <td class="text-right">${breakdown.volumetricWeight} kg</td>
          </tr>
          <tr class="breakdown-highlight">
            <td>Chargeable Weight <small>(higher of above)</small></td>
            <td class="text-right">${breakdown.chargeableWeight} kg</td>
          </tr>
          <tr>
            <td>Base Charge</td>
            <td class="text-right">${fmt(breakdown.baseCharge)}</td>
          </tr>
          <tr>
            <td>${speedLabel} Multiplier</td>
            <td class="text-right">× ${breakdown.speedMultiplier}</td>
          </tr>
          <tr>
            <td>Charge after Speed</td>
            <td class="text-right">${fmt(breakdown.speedCharge)}</td>
          </tr>
          ${addonRows}
          ${
            breakdown.addonsTotal > 0
              ? `<tr><td>Add-ons Total</td><td class="text-right">${fmt(breakdown.addonsTotal)}</td></tr>`
              : ''
          }
          <tr class="breakdown-subtotal">
            <td>Subtotal</td>
            <td class="text-right">${fmt(breakdown.subtotal)}</td>
          </tr>
          ${
            breakdown.minimumApplied
              ? `<tr class="breakdown-minimum">
                   <td colspan="2">Minimum charge of ${fmt(MINIMUM_CHARGE)} applied.</td>
                 </tr>`
              : ''
          }
        </tbody>
        <tfoot>
          <tr class="breakdown-total">
            <td><strong>Total Estimated Cost</strong></td>
            <td class="text-right"><strong>${fmt(breakdown.total)}</strong></td>
          </tr>
        </tfoot>
      </table>

      <p class="breakdown-disclaimer">
        Rates are estimates only. Final charges may vary based on carrier, customs, and fuel surcharges.
      </p>
    </div>
  `;

  // Animate in
  requestAnimationFrame(() => container.classList.add('breakdown-visible'));
}

/* ─────────────────────────────────────────────
   CALCULATOR FORM
───────────────────────────────────────────── */

/** Read form values and return params object for calculateParcelPrice(). */
function readFormValues(form) {
  const get = (name) => form.querySelector(`[name="${name}"]`)?.value ?? '';

  const addons = [];
  if (form.querySelector('[name="addon-insurance"]')?.checked) addons.push('insurance');
  if (form.querySelector('[name="addon-fragile"]')?.checked) addons.push('fragile');
  if (form.querySelector('[name="addon-customs"]')?.checked) addons.push('customs');

  return {
    country: get('country'),
    weight: parseFloat(get('weight')) || 0,
    length: parseFloat(get('length')) || 0,
    width: parseFloat(get('width')) || 0,
    height: parseFloat(get('height')) || 0,
    speed: get('speed') || 'standard',
    addons,
  };
}

/**
 * Wire up the calculator form for real-time calculation.
 * Called automatically on DOMContentLoaded if the form exists.
 */
function initCalculator() {
  const form = document.getElementById('parcel-calculator')
    || document.querySelector('.parcel-calculator, [data-calculator="parcel"]');

  if (!form) return;

  const outputEl = document.getElementById('price-breakdown-output')
    || document.querySelector('.price-breakdown-output, [data-calculator-output]');

  /** Run the calculation and render results. */
  const recalculate = () => {
    const params = readFormValues(form);

    // Need at least a country to produce meaningful output
    if (!params.country) {
      if (outputEl) {
        outputEl.innerHTML = `<p class="breakdown-placeholder">Enter shipment details above to see the price estimate.</p>`;
        outputEl.classList.remove('breakdown-visible');
      }
      return;
    }

    const breakdown = calculateParcelPrice(params);
    if (outputEl) renderPriceBreakdown(breakdown, outputEl);

    // Also update any standalone total display
    const totalDisplay = document.querySelector('.calculator-total-price, [data-calculator-total]');
    const symbol = window.GlobexSky?.CURRENCY_SYMBOLS?.[localStorage.getItem('globexCurrency') || 'USD'] || '$';
    if (totalDisplay) totalDisplay.textContent = `${symbol}${breakdown.total.toFixed(2)}`;
  };

  // Recalculate on every input/change in the form
  form.addEventListener('input', recalculate);
  form.addEventListener('change', recalculate);

  // Prevent form submission; recalculate on submit button click
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    recalculate();
  });

  // Run once on init to handle pre-filled forms
  recalculate();
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', initCalculator);

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};
Object.assign(window.GlobexSky, {
  calculateParcelPrice,
  renderPriceBreakdown,
  getZone,
  initCalculator,
  ZONE_MAP,
  ZONE_RATES,
  ZONE_NAMES,
  ADDON_PRICES,
  SPEED_MULTIPLIERS,
});
