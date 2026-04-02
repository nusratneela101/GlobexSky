/**
 * Globex Sky — shipping.js
 * Centralized Shipping API client + page initialization for all shipping pages.
 *
 * Depends on: config.js (window.GlobexConfig), api-service.js (optional)
 */

/* ─────────────────────────────────────────────
   SHIPPING API CLIENT
───────────────────────────────────────────── */
const ShippingAPI = {
  get BASE() {
    const base = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';
    return base + '/shipping';
  },

  headers() {
    let token = null;
    try {
      const session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      token = (session && session.token) || localStorage.getItem('globexToken') || localStorage.getItem('token') || null;
    } catch (_) {}
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  },

  async _fetch(path, opts) {
    const res  = await fetch(this.BASE + path, Object.assign({ headers: this.headers() }, opts || {}));
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || json.error || 'Request failed');
    return json;
  },

  /** POST /api/v1/shipping/rates */
  async calculateRates(origin, destination, weight, dimensions) {
    return this._fetch('/rates', {
      method: 'POST',
      body:   JSON.stringify({ origin, destination, weight, dimensions }),
    });
  },

  /** GET /api/v1/shipping/track/:trackingNumber */
  async trackShipment(trackingNumber) {
    return this._fetch('/track/' + encodeURIComponent(trackingNumber));
  },

  /** POST /api/v1/shipping/create */
  async createShipment(orderData) {
    return this._fetch('/create', {
      method: 'POST',
      body:   JSON.stringify(orderData),
    });
  },

  /** GET /api/v1/shipping/carriers */
  async getCarriers(region) {
    const qs = region ? '?region=' + encodeURIComponent(region) : '';
    return this._fetch('/carriers' + qs);
  },

  /** GET /api/v1/shipping/history */
  async getShippingHistory() {
    return this._fetch('/history');
  },

  /** GET /api/v1/shipping/methods */
  async getShippingMethods() {
    return this._fetch('/methods');
  },
};

window.ShippingAPI = ShippingAPI;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function _esc(v) {
  const d = document.createElement('div');
  d.textContent = String(v == null ? '' : v);
  return d.innerHTML;
}

function _statusBadge(status) {
  const map = {
    pending:          'badge-gray',
    picked_up:        'badge-blue',
    in_transit:       'badge-blue',
    customs:          'badge-orange',
    out_for_delivery: 'badge-orange',
    delivered:        'badge-green',
    failed:           'badge-red',
    returned:         'badge-red',
  };
  const key = (status || '').toLowerCase().replace(/ /g, '_');
  return map[key] || 'badge-gray';
}

function _statusLabel(status) {
  return (status || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function _fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch (_) { return iso; }
}

function _fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch (_) { return iso; }
}

/* ─────────────────────────────────────────────
   TRACKING PAGE INIT
───────────────────────────────────────────── */
function initTrackingPage() {
  const form      = document.getElementById('trackingForm');
  const input     = document.getElementById('trackingNumber');
  const resultBox = document.getElementById('trackingResult');
  const refreshBtn = document.getElementById('refreshTracking');
  if (!form || !resultBox) return;

  let currentTrackingNumber = null;

  // Read ?tracking= from URL
  const urlParam = new URLSearchParams(window.location.search).get('tracking');
  if (urlParam && input) {
    input.value = urlParam;
    currentTrackingNumber = urlParam;
    _doTrack(urlParam);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const num = input ? input.value.trim() : '';
    if (!num) return;
    currentTrackingNumber = num;
    _doTrack(num);
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      if (currentTrackingNumber) _doTrack(currentTrackingNumber);
    });
  }

  async function _doTrack(trackingNumber) {
    resultBox.innerHTML = '<div style="text-align:center;padding:32px"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem;color:#0052CC"></i><div style="margin-top:12px;color:#64748b">Fetching tracking info…</div></div>';

    try {
      const res  = await ShippingAPI.trackShipment(trackingNumber);
      const data = res.data || {};
      _renderTracking(data, resultBox);
    } catch (err) {
      resultBox.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:20px;color:#dc2626;display:flex;align-items:center;gap:10px"><i class="fas fa-exclamation-triangle"></i><span>${_esc(err.message || 'No tracking information found for this number.')}</span></div>`;
    }
  }

  function _renderTracking(data, container) {
    const events  = Array.isArray(data.events) ? data.events : [];
    const badgeCls = _statusBadge(data.status);

    container.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
          <div>
            <div style="font-family:'Poppins',sans-serif;font-size:1.1rem;font-weight:700;color:#0a0e27">Tracking #${_esc(data.tracking_number || data.trackingNumber || '—')}</div>
            ${data.carrier ? `<div style="font-size:.85rem;color:#64748b;margin-top:2px">${_esc(data.carrier)}</div>` : ''}
          </div>
          <span class="badge ${badgeCls}" style="padding:6px 14px;font-size:.82rem">${_statusLabel(data.status)}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:20px">
          <div style="background:#f8fafc;padding:12px;border-radius:8px">
            <div style="font-size:.78rem;color:#64748b;margin-bottom:4px"><i class="fas fa-map-marker-alt" style="margin-right:4px;color:#0052CC"></i>FROM</div>
            <div style="font-weight:600;font-size:.9rem">${_esc(data.origin || '—')}</div>
          </div>
          <div style="background:#f8fafc;padding:12px;border-radius:8px">
            <div style="font-size:.78rem;color:#64748b;margin-bottom:4px"><i class="fas fa-flag" style="margin-right:4px;color:#059669"></i>TO</div>
            <div style="font-weight:600;font-size:.9rem">${_esc(data.destination || '—')}</div>
          </div>
          ${data.estimated_delivery ? `<div style="background:#eff6ff;padding:12px;border-radius:8px;border:1px solid #bfdbfe">
            <div style="font-size:.78rem;color:#2563eb;margin-bottom:4px"><i class="fas fa-calendar" style="margin-right:4px"></i>EST. DELIVERY</div>
            <div style="font-weight:600;font-size:.9rem;color:#2563eb">${_fmtDate(data.estimated_delivery)}</div>
          </div>` : ''}
        </div>

        ${events.length ? `
        <div>
          <div style="font-family:'Poppins',sans-serif;font-weight:600;color:#0a0e27;margin-bottom:16px">Tracking Timeline</div>
          <div style="position:relative;padding-left:28px">
            <div style="position:absolute;left:9px;top:12px;bottom:12px;width:2px;background:#e2e8f0"></div>
            ${events.map((ev, i) => `
              <div style="position:relative;margin-bottom:24px${i === events.length - 1 ? ';margin-bottom:0' : ''}">
                <div style="position:absolute;left:-19px;width:20px;height:20px;background:${i === 0 ? '#0052CC' : '#e2e8f0'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:${i === 0 ? '#fff' : '#94a3b8'}"><i class="fas fa-${i === 0 ? 'circle-dot' : 'circle'}"></i></div>
                <div style="font-family:'Poppins',sans-serif;font-size:.88rem;font-weight:600;color:${i === 0 ? '#0052CC' : '#0a0e27'}">${_esc(ev.status || ev.description || '')}</div>
                <div style="font-size:.8rem;color:#64748b;margin-top:1px">${ev.location ? _esc(ev.location) + ' — ' : ''}${_fmtDateTime(ev.timestamp)}</div>
                ${ev.description && ev.status && ev.description !== ev.status ? `<div style="font-size:.8rem;color:#94a3b8;margin-top:2px">${_esc(ev.description)}</div>` : ''}
              </div>`).join('')}
          </div>
        </div>` : '<div style="color:#64748b;font-size:.88rem;margin-top:8px">No tracking events available yet.</div>'}
      </div>`;

    if (refreshBtn) refreshBtn.style.display = 'inline-flex';
  }
}

/* ─────────────────────────────────────────────
   HISTORY PAGE INIT
───────────────────────────────────────────── */
function initHistoryPage() {
  const container    = document.getElementById('shipmentHistoryBody');
  const statusFilter = document.getElementById('statusFilter');
  const monthFilter  = document.getElementById('monthFilter');
  if (!container) return;

  let all = [];

  const render = (list) => {
    if (!list.length) {
      container.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:#64748b">No shipments found.</td></tr>';
      return;
    }
    container.innerHTML = list.map((s) => `
      <tr>
        <td><code style="font-size:.82rem">${_esc(s.tracking_number || s.trackingNumber || '—')}</code></td>
        <td>${s.order_id ? `<a href="../account/order-detail.html?id=${_esc(s.order_id)}" style="color:#0052CC;text-decoration:none">#${_esc(s.order_id)}</a>` : '—'}</td>
        <td>—</td>
        <td>${_esc(s.carrier || '—')}</td>
        <td>${_esc(s.origin || '—')}</td>
        <td>${_esc(s.destination || '—')}</td>
        <td>${_fmtDate(s.created_at)}</td>
        <td>${s.estimated_delivery ? _fmtDate(s.estimated_delivery) : '—'}</td>
        <td><span class="badge ${_statusBadge(s.status)}">${_statusLabel(s.status)}</span></td>
        <td><a href="tracking.html?tracking=${encodeURIComponent(s.tracking_number || s.trackingNumber || '')}" class="btn btn-sm btn-primary"><i class="fas fa-map-marker-alt"></i> Track</a></td>
      </tr>`).join('');
  };

  const applyFilters = () => {
    let list = [...all];
    const stat  = statusFilter && statusFilter.value !== 'All Status' ? statusFilter.value.toLowerCase().replace(/ /g, '_') : null;
    const month = monthFilter ? monthFilter.value : null;
    if (stat) list = list.filter((s) => (s.status || '').toLowerCase().replace(/ /g, '_').includes(stat));
    if (month) list = list.filter((s) => s.created_at && s.created_at.startsWith(month));
    render(list);
  };

  if (statusFilter) statusFilter.addEventListener('change', applyFilters);
  if (monthFilter)  monthFilter.addEventListener('change', applyFilters);

  container.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px"><i class="fas fa-circle-notch fa-spin" style="color:#0052CC"></i></td></tr>';

  ShippingAPI.getShippingHistory()
    .then((res) => { all = res.data || []; applyFilters(); })
    .catch(() => {
      container.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:#dc2626">Failed to load shipping history. Please try again.</td></tr>';
    });
}

/* ─────────────────────────────────────────────
   RATES PAGE INIT
───────────────────────────────────────────── */
function initRatesPage() {
  const form      = document.getElementById('rateCalculatorForm');
  const resultBox = document.getElementById('ratesResult');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const fd          = new FormData(form);
    const origin      = fd.get('origin') || '';
    const destination = fd.get('destination') || '';
    const weight      = parseFloat(fd.get('weight') || 1);
    const dims        = {
      length: parseFloat(fd.get('length') || 0),
      width:  parseFloat(fd.get('width')  || 0),
      height: parseFloat(fd.get('height') || 0),
    };

    const btn  = form.querySelector('[type="submit"]');
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Calculating…'; }
    if (resultBox) resultBox.innerHTML = '<div style="text-align:center;padding:32px"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem;color:#0052CC"></i></div>';

    try {
      const res   = await ShippingAPI.calculateRates(origin, destination, weight, dims);
      const rates = res.data || [];
      if (resultBox) {
        resultBox.innerHTML = rates.length
          ? `<div style="margin-top:8px">
              <div style="font-family:'Poppins',sans-serif;font-weight:600;color:#0a0e27;margin-bottom:16px">Available Shipping Options</div>
              <div style="overflow-x:auto">
                <table class="table">
                  <thead><tr><th>Method</th><th>Carrier</th><th>Est. Delivery</th><th>Price</th><th></th></tr></thead>
                  <tbody>
                    ${rates.map((r, idx) => `
                      <tr>
                        <td><strong>${_esc(r.method_name)}</strong><div style="font-size:.78rem;color:#64748b">${_esc(r.description || '')}</div></td>
                        <td>${_esc(r.carrier)}</td>
                        <td>${_esc(r.estimated_days)}</td>
                        <td style="font-family:'Poppins',sans-serif;font-weight:700;color:#0052CC">$${parseFloat(r.price || 0).toFixed(2)}</td>
                        <td><button class="btn btn-sm btn-primary" data-rate-index="${idx}" style="white-space:nowrap"><i class="fas fa-check"></i> Select</button></td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>`
          : '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:20px;color:#92400e;margin-top:8px"><i class="fas fa-exclamation-triangle" style="margin-right:8px"></i>No rates available for this route.</div>';

        // Use event delegation to avoid inline onclick and XSS
        resultBox.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-rate-index]');
          if (!btn) return;
          const idx = parseInt(btn.dataset.rateIndex, 10);
          if (!isNaN(idx) && rates[idx]) {
            ShippingAPI._selectedRate = rates[idx];
            alert('Rate selected: ' + rates[idx].method_name + ' — $' + rates[idx].price + '. Proceed to checkout to book this shipment.');
          }
        }, { once: true });
      }
    } catch (err) {
      if (resultBox) resultBox.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:20px;color:#dc2626;margin-top:8px"><i class="fas fa-exclamation-triangle" style="margin-right:8px"></i>${_esc(err.message || 'Failed to calculate rates.')}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   CARRIERS PAGE INIT
───────────────────────────────────────────── */
function initCarriersPage() {
  const container    = document.getElementById('carriersGrid');
  const regionFilter = document.getElementById('regionFilter');
  if (!container) return;

  let all = [];

  const render = (list) => {
    if (!list.length) {
      container.innerHTML = '<p style="text-align:center;padding:32px;color:#64748b;grid-column:1/-1">No carriers found.</p>';
      return;
    }
    container.innerHTML = list.map((c) => `
      <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#0052CC,#00C9A7);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Poppins',sans-serif;font-weight:700;font-size:.85rem;flex-shrink:0">${_esc(c.logo || (c.name || '?').substring(0, 3))}</div>
          <div>
            <div style="font-family:'Poppins',sans-serif;font-weight:700;color:#0a0e27">${_esc(c.name)}</div>
            <div style="font-size:.78rem;color:#64748b">${_esc(c.avg_delivery_days)} days avg</div>
          </div>
          <div style="margin-left:auto;background:#fef9c3;color:#92400e;padding:4px 10px;border-radius:20px;font-size:.78rem;font-weight:600"><i class="fas fa-star" style="color:#f59e0b;margin-right:3px"></i>${_esc(c.rating)}</div>
        </div>
        <div style="font-size:.85rem;color:#64748b">${_esc(c.description || '')}</div>
        <div>
          ${(c.supported_regions || []).map((r) => `<span style="display:inline-block;background:#e0f2fe;color:#0369a1;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:500;margin:2px 4px 2px 0">${_esc(r)}</span>`).join('')}
        </div>
      </div>`).join('');
  };

  const applyFilter = () => {
    const region = regionFilter ? regionFilter.value : '';
    render(region
      ? all.filter((c) => c.supported_regions.some((r) => r.toLowerCase().includes(region.toLowerCase())))
      : all);
  };

  if (regionFilter) regionFilter.addEventListener('change', applyFilter);

  container.innerHTML = '<div style="text-align:center;padding:32px;grid-column:1/-1"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem;color:#0052CC"></i></div>';

  ShippingAPI.getCarriers()
    .then((res) => { all = res.data || []; applyFilter(); })
    .catch(() => {
      container.innerHTML = '<p style="text-align:center;padding:32px;color:#dc2626;grid-column:1/-1">Failed to load carriers.</p>';
    });
}

/* ─────────────────────────────────────────────
   CHECKOUT SHIPPING RATES INIT
───────────────────────────────────────────── */
function initCheckoutShippingRates(opts) {
  const options  = opts || {};
  const country  = options.country || '';
  const weight   = options.weight  || 1;
  const container = document.getElementById('shippingMethodsContainer');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:16px;color:#64748b"><i class="fas fa-circle-notch fa-spin"></i> Loading shipping rates…</div>';

  ShippingAPI.calculateRates('', country, weight, {})
    .then((res) => {
      const rates = res.data || [];
      if (!rates.length) {
        container.innerHTML = '<div style="color:#64748b;font-size:.88rem">Shipping rates unavailable. Please contact support.</div>';
        return;
      }
      container.innerHTML = rates.map((r, i) => `
        <label style="display:flex;align-items:center;gap:14px;border:1.5px solid ${i === 0 ? 'var(--primary,#0052CC)' : 'var(--border,#e2e8f0)'};border-radius:12px;padding:14px 16px;cursor:pointer;${i === 0 ? 'background:#f0f4ff;' : ''}margin-bottom:10px">
          <input type="radio" name="shipping-method" value="${_esc(r.method_id)}" ${i === 0 ? 'checked' : ''} data-price="${r.price}" style="accent-color:var(--primary,#0052CC);width:16px;height:16px">
          <div style="flex:1">
            <div style="font-weight:600;font-size:.9rem;color:var(--dark,#0a0e27)">${_esc(r.method_name)}</div>
            <div style="font-size:.78rem;color:var(--muted,#64748b)">${_esc(r.estimated_days)} · ${_esc(r.carrier)}</div>
          </div>
          <div style="font-family:'Poppins',sans-serif;font-weight:700;color:${r.price === 0 ? '#16a34a' : 'var(--dark,#0a0e27)'};font-size:.9rem">${r.price === 0 ? 'FREE' : '$' + r.price.toFixed(2)}</div>
        </label>`).join('');

      // Update order summary when selection changes
      container.querySelectorAll('input[name="shipping-method"]').forEach((radio) => {
        radio.addEventListener('change', function () {
          const el = document.getElementById('summary-shipping');
          if (el) el.textContent = parseFloat(this.dataset.price || 0) === 0 ? 'FREE' : '$' + parseFloat(this.dataset.price).toFixed(2);
        });
      });
    })
    .catch(() => {
      // Fall back to static options silently — checkout will still work
    });
}

window.initCheckoutShippingRates = initCheckoutShippingRates;

/* ─────────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  initTrackingPage();
  initHistoryPage();
  initRatesPage();
  initCarriersPage();
});
