/**
 * parcel.js – ParcelService module for GlobexSky parcel shipping feature.
 * Handles shipping cost calculation, tracking timeline rendering, and form management.
 */

const ParcelService = (() => {
  // ─── Zone & Pricing Data ─────────────────────────────────────────────────

  /**
   * Country → shipping zone mapping with base cost per zone.
   * Keys are ISO-2 country codes or common names (lowercase).
   */
  const ZONES = {
    // Zone 1 – North America & UK: base $8
    US: { zone: 1, label: 'Zone 1 – North America & UK', base: 8 },
    CA: { zone: 1, label: 'Zone 1 – North America & UK', base: 8 },
    UK: { zone: 1, label: 'Zone 1 – North America & UK', base: 8 },
    GB: { zone: 1, label: 'Zone 1 – North America & UK', base: 8 },

    // Zone 2 – Europe: base $12
    DE: { zone: 2, label: 'Zone 2 – Europe', base: 12 },
    FR: { zone: 2, label: 'Zone 2 – Europe', base: 12 },
    IT: { zone: 2, label: 'Zone 2 – Europe', base: 12 },
    ES: { zone: 2, label: 'Zone 2 – Europe', base: 12 },
    NL: { zone: 2, label: 'Zone 2 – Europe', base: 12 },
    PL: { zone: 2, label: 'Zone 2 – Europe', base: 12 },
    SE: { zone: 2, label: 'Zone 2 – Europe', base: 12 },
    NO: { zone: 2, label: 'Zone 2 – Europe', base: 12 },

    // Zone 3 – Middle East & Asia: base $18
    AE: { zone: 3, label: 'Zone 3 – Middle East & Asia', base: 18 },
    SA: { zone: 3, label: 'Zone 3 – Middle East & Asia', base: 18 },
    TR: { zone: 3, label: 'Zone 3 – Middle East & Asia', base: 18 },
    CN: { zone: 3, label: 'Zone 3 – Middle East & Asia', base: 18 },
    JP: { zone: 3, label: 'Zone 3 – Middle East & Asia', base: 18 },
    KR: { zone: 3, label: 'Zone 3 – Middle East & Asia', base: 18 },
    IN: { zone: 3, label: 'Zone 3 – Middle East & Asia', base: 18 },
    SG: { zone: 3, label: 'Zone 3 – Middle East & Asia', base: 18 },

    // Zone 4 – Africa & South America: base $25
    ZA: { zone: 4, label: 'Zone 4 – Africa & South America', base: 25 },
    NG: { zone: 4, label: 'Zone 4 – Africa & South America', base: 25 },
    KE: { zone: 4, label: 'Zone 4 – Africa & South America', base: 25 },
    GH: { zone: 4, label: 'Zone 4 – Africa & South America', base: 25 },
    BR: { zone: 4, label: 'Zone 4 – Africa & South America', base: 25 },
    AR: { zone: 4, label: 'Zone 4 – Africa & South America', base: 25 },
    CO: { zone: 4, label: 'Zone 4 – Africa & South America', base: 25 },
    MX: { zone: 4, label: 'Zone 4 – Africa & South America', base: 25 },
  };

  /**
   * Weight tiers determining the cost multiplier applied to the base zone rate.
   */
  const WEIGHT_TIERS = [
    { max: 0.5, label: '0–0.5 kg',  multiplier: 1.0 },
    { max: 1.0, label: '0.5–1 kg',  multiplier: 1.5 },
    { max: 2.0, label: '1–2 kg',    multiplier: 2.0 },
    { max: 5.0, label: '2–5 kg',    multiplier: 3.0 },
    { max: 10,  label: '5–10 kg',   multiplier: 4.5 },
    { max: 20,  label: '10–20 kg',  multiplier: 7.0 },
    { max: Infinity, label: '20+ kg', multiplier: 10.0 },
  ];

  /** Additional service costs (added on top of base) */
  const SERVICE_COSTS = {
    insurance: 4.99,
    tracking: 2.50,
    signature: 3.00,
    fragile: 5.00,
  };

  /** Speed surcharges multiplied on the (base × multiplier) sub-total */
  const SPEED_SURCHARGES = {
    standard: 0,
    express: 8,
    overnight: 20,
  };

  // ─── Reference Number ────────────────────────────────────────────────────

  /**
   * Generate a unique parcel reference number in the format GS-YYYYMMDD-XXXXX.
   * @returns {string}
   */
  const generateReferenceNumber = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = String(Math.floor(10000 + Math.random() * 90000)); // 5 digits
    return `GS-${yyyy}${mm}${dd}-${rand}`;
  };

  // ─── Cost Calculation ────────────────────────────────────────────────────

  /**
   * Calculate the total shipping cost.
   * @param {string} country  ISO-2 country code (e.g. 'US').
   * @param {number} weightKg  Parcel weight in kg.
   * @param {string[]} services  Array of extra service keys (e.g. ['insurance','tracking']).
   * @param {string} speed  Delivery speed: 'standard' | 'express' | 'overnight'.
   * @returns {{ weightTier: object, baseCost: number, servicesCost: number, speedSurcharge: number, total: number }}
   */
  const calculateShipping = (country, weightKg, services = [], speed = 'standard') => {
    const zone = ZONES[country?.toUpperCase()] || { zone: 4, label: 'Zone 4', base: 25 };
    const tier = WEIGHT_TIERS.find((t) => weightKg <= t.max) || WEIGHT_TIERS[WEIGHT_TIERS.length - 1];

    const baseCost = parseFloat((zone.base * tier.multiplier).toFixed(2));

    const servicesCost = parseFloat(
      services.reduce((sum, s) => sum + (SERVICE_COSTS[s] || 0), 0).toFixed(2)
    );

    const speedSurcharge = SPEED_SURCHARGES[speed] ?? 0;

    const total = parseFloat((baseCost + servicesCost + speedSurcharge).toFixed(2));

    return {
      weightTier: tier,
      zone: zone,
      baseCost,
      servicesCost,
      speedSurcharge,
      total,
    };
  };

  // ─── Price Display ───────────────────────────────────────────────────────

  /**
   * Read the parcel form inputs and update the pricing calculator display elements.
   * Expects elements: #parcel-country, #parcel-weight, checkboxes [name="service"],
   * select [name="speed"], and output targets #parcel-price-base, #parcel-price-services,
   * #parcel-price-speed, #parcel-price-total, #parcel-weight-tier.
   */
  const updatePriceDisplay = () => {
    const countryEl = document.querySelector('#parcel-country');
    const weightEl = document.querySelector('#parcel-weight');
    const speedEl = document.querySelector('[name="speed"]');

    if (!countryEl || !weightEl) return;

    const country = countryEl.value || 'US';
    const weight = parseFloat(weightEl.value) || 0.5;
    const speed = speedEl?.value || 'standard';
    const services = [...document.querySelectorAll('[name="service"]:checked')].map((el) => el.value);

    const result = calculateShipping(country, weight, services, speed);

    const fmt = (n) => `$${n.toFixed(2)}`;
    const setEl = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };

    setEl('#parcel-price-base', fmt(result.baseCost));
    setEl('#parcel-price-services', fmt(result.servicesCost));
    setEl('#parcel-price-speed', fmt(result.speedSurcharge));
    setEl('#parcel-price-total', fmt(result.total));
    setEl('#parcel-weight-tier', result.weightTier.label);
    setEl('#parcel-zone-label', result.zone.label);
  };

  // ─── Tracking Timeline ───────────────────────────────────────────────────

  /**
   * Render a tracking timeline into #parcel-timeline.
   * @param {Array<{ name: string, status: 'done'|'active'|'pending', date: string, location: string, notes?: string }>} steps
   */
  const renderTrackingTimeline = (steps) => {
    const container = document.querySelector('#parcel-timeline');
    if (!container) return;

    const statusIcon = (status) => {
      if (status === 'done') return `<i class="fas fa-check-circle" style="color:#059669"></i>`;
      if (status === 'active') return `<i class="fas fa-circle-dot" style="color:#0052CC"></i>`;
      return `<i class="far fa-circle" style="color:#cbd5e1"></i>`;
    };

    const statusColor = { done: '#059669', active: '#0052CC', pending: '#94a3b8' };

    container.innerHTML = steps.map((step, i) => `
      <div class="timeline-step" style="display:flex;gap:16px;padding-bottom:${i < steps.length - 1 ? '24px' : '0'};position:relative">
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <div style="font-size:1.2rem">${statusIcon(step.status)}</div>
          ${i < steps.length - 1
            ? `<div style="flex:1;width:2px;background:${step.status === 'done' ? '#d1fae5' : '#f1f5f9'};margin-top:4px"></div>`
            : ''}
        </div>
        <div style="flex:1;padding-bottom:4px">
          <div style="font-family:'Poppins',sans-serif;font-weight:600;font-size:.9rem;color:${statusColor[step.status] || '#374151'}">${step.name}</div>
          <div style="font-size:.8rem;color:#64748b;margin-top:2px">${step.location} · ${step.date}</div>
          ${step.notes ? `<div style="font-size:.78rem;color:#94a3b8;margin-top:4px">${step.notes}</div>` : ''}
        </div>
      </div>
    `).join('');
  };

  // ─── Form Initialisation ─────────────────────────────────────────────────

  /**
   * Set up all event listeners for the parcel creation / pricing calculator form.
   */
  const initCreateForm = () => {
    // Live price updates when any input changes
    const liveInputs = document.querySelectorAll(
      '#parcel-country, #parcel-weight, [name="speed"], [name="service"]'
    );
    liveInputs.forEach((el) => el.addEventListener('change', updatePriceDisplay));
    updatePriceDisplay(); // initial render

    // Form submission
    const form = document.querySelector('#parcel-create-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const ref = generateReferenceNumber();
      const refEl = document.querySelector('#parcel-ref-output');
      if (refEl) {
        refEl.textContent = ref;
        refEl.closest('[id="parcel-ref-section"]')?.classList.remove('hidden');
      } else {
        alert(`Parcel created! Reference: ${ref}`);
      }
    });
  };

  /**
   * Set up the parcel tracking search form (#parcel-track-form).
   * On submit, fetches (or simulates) tracking data and renders the timeline.
   */
  const initTrackingSearch = () => {
    const form = document.querySelector('#parcel-track-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('[name="trackingRef"]');
      const ref = input?.value?.trim();

      if (!ref) {
        if (input) {
          input.style.borderColor = '#ef4444';
          input.placeholder = 'Enter a reference number';
        }
        return;
      }

      // Simulate tracking data (replace with real API call in production)
      const mockSteps = [
        { name: 'Order Placed',         status: 'done',    date: '2025-03-25 09:00', location: 'Online',          notes: 'Payment confirmed.' },
        { name: 'Picked Up by Courier', status: 'done',    date: '2025-03-25 14:30', location: 'Shanghai, CN',    notes: null },
        { name: 'Departed Origin Hub',  status: 'done',    date: '2025-03-26 02:15', location: 'Shanghai Airport', notes: 'Flight GS8821' },
        { name: 'Arrived Destination',  status: 'active',  date: '2025-03-27 08:45', location: 'Dubai, AE',       notes: 'Customs clearance in progress.' },
        { name: 'Out for Delivery',     status: 'pending', date: 'Estimated 2025-03-28', location: 'Dubai, AE',   notes: null },
        { name: 'Delivered',            status: 'pending', date: 'Estimated 2025-03-28', location: 'Dubai, AE',   notes: null },
      ];

      renderTrackingTimeline(mockSteps);
      document.querySelector('#parcel-tracking-result')?.classList.remove('hidden');
    });
  };

  // ─── Initialisation ───────────────────────────────────────────────────────

  /**
   * Bootstrap all ParcelService features. Called on DOMContentLoaded.
   */
  const init = () => {
    initCreateForm();
    initTrackingSearch();
  };

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    ZONES,
    WEIGHT_TIERS,
    generateReferenceNumber,
    calculateShipping,
    updatePriceDisplay,
    renderTrackingTimeline,
    initCreateForm,
    initTrackingSearch,
    init,
  };
})();

// Auto-initialise on DOM ready
document.addEventListener('DOMContentLoaded', ParcelService.init);

// Expose globally
window.ParcelService = ParcelService;
