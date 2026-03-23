/**
 * Globex Sky - shipment.js
 * Shipment section: tracking lookup, history table, zone/rate management.
 */

/* ─────────────────────────────────────────────
   SHIPMENT TRACKING
───────────────────────────────────────────── */
function initShipmentTracking() {
  const form = document.querySelector('#trackingForm, [data-tracking-form]');
  const resultContainer = document.querySelector('#trackingResult, [data-tracking-result]');
  if (!form) return;

  // Pre-fill from URL param
  const trackingParam = new URLSearchParams(window.location.search).get('tracking');
  const input = form.querySelector('[name="tracking_number"], #trackingNumber');
  if (trackingParam && input) {
    input.value = trackingParam;
    form.dispatchEvent(new Event('submit'));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = input?.value.trim();
    if (!number) {
      if (typeof showToast === 'function') showToast('Please enter a tracking number.', 'error');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Tracking…'; }
    if (resultContainer) resultContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
      const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
      const res  = await fetch(`/api/v1/shipments/track?number=${encodeURIComponent(number)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Tracking failed');
      renderTrackingResult(data.data || data, resultContainer);
    } catch (err) {
      if (resultContainer) {
        resultContainer.innerHTML = `<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i>${err.message || 'No tracking information found for this number.'}</div>`;
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

function renderTrackingResult(info, container) {
  if (!container) return;

  const statusColors = {
    pending: 'secondary', in_transit: 'primary', out_for_delivery: 'warning',
    delivered: 'success', failed: 'danger', returned: 'info',
  };
  const statusColor = statusColors[(info.status || '').toLowerCase().replace(/ /g, '_')] || 'secondary';

  const timeline = Array.isArray(info.events) ? info.events : [];

  container.innerHTML = `
    <div class="tracking-result card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <div>
          <strong>Tracking #${info.tracking_number || info.number}</strong>
          ${info.carrier ? `<span class="text-muted ms-2">(${info.carrier})</span>` : ''}
        </div>
        <span class="badge bg-${statusColor} fs-6">${(info.status || 'Unknown').replace(/_/g, ' ').toUpperCase()}</span>
      </div>
      <div class="card-body">
        <div class="row mb-4">
          <div class="col-sm-4">
            <small class="text-muted d-block">From</small>
            <strong>${info.origin || '—'}</strong>
          </div>
          <div class="col-sm-4 text-center">
            <i class="fas fa-long-arrow-alt-right fs-3 text-primary"></i>
          </div>
          <div class="col-sm-4 text-end">
            <small class="text-muted d-block">To</small>
            <strong>${info.destination || '—'}</strong>
          </div>
        </div>
        ${info.estimated_delivery ? `<div class="alert alert-info mb-4"><i class="fas fa-calendar-alt me-2"></i><strong>Estimated Delivery:</strong> ${new Date(info.estimated_delivery).toLocaleDateString()}</div>` : ''}
        ${timeline.length ? `
          <h6 class="mb-3">Tracking Timeline</h6>
          <div class="tracking-timeline position-relative ps-4">
            ${timeline.map((event, i) => `
              <div class="timeline-event d-flex gap-3 mb-3 position-relative">
                <div class="timeline-icon rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                  style="width:32px;height:32px;background:${i === 0 ? '#0d6efd' : '#e9ecef'};color:${i === 0 ? '#fff' : '#6c757d'}">
                  <i class="fas fa-${i === 0 ? 'circle-dot' : 'circle'} small"></i>
                </div>
                <div>
                  <div class="fw-bold">${event.description || event.status}</div>
                  <div class="text-muted small">${event.location || ''} ${event.timestamp ? '— ' + new Date(event.timestamp).toLocaleString() : ''}</div>
                </div>
              </div>`).join('')}
          </div>` : ''}
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────
   SHIPMENT HISTORY
───────────────────────────────────────────── */
async function initShipmentHistory() {
  const container   = document.querySelector('.shipment-history, [data-shipment-history]');
  const searchInput = document.querySelector('#shipmentSearch, [data-shipment-search]');
  const statusFilter = document.querySelector('#shipmentStatus, [data-shipment-status]');
  if (!container) return;

  let all = [];

  const render = (list) => {
    container.innerHTML = list.length
      ? `<div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr><th>Tracking #</th><th>Order</th><th>Carrier</th><th>Origin</th><th>Destination</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${list.map((s) => `
                <tr>
                  <td><code>${s.tracking_number}</code></td>
                  <td><a href="/pages/account/order-detail.html?id=${s.order_id}">#${s.order_id}</a></td>
                  <td>${s.carrier || '—'}</td>
                  <td>${s.origin || '—'}</td>
                  <td>${s.destination || '—'}</td>
                  <td><span class="badge bg-${statusBadge(s.status)}">${s.status}</span></td>
                  <td>${new Date(s.created_at || s.date).toLocaleDateString()}</td>
                  <td>
                    <a href="/pages/shipment/tracking.html?tracking=${s.tracking_number}" class="btn btn-sm btn-outline-primary">Track</a>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="text-muted text-center py-5">No shipments found.</p>';
  };

  const applyFilters = () => {
    let list   = [...all];
    const q    = searchInput?.value.trim().toLowerCase();
    const stat = statusFilter?.value;
    if (q) list = list.filter((s) => s.tracking_number?.toLowerCase().includes(q) || String(s.order_id).includes(q));
    if (stat && stat !== 'all') list = list.filter((s) => s.status?.toLowerCase() === stat.toLowerCase());
    render(list);
  };

  searchInput?.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);

  try {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const res = await fetch('/api/v1/shipments', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    all = data.data || data || [];
    applyFilters();
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load shipments.</p>';
  }
}

function statusBadge(status) {
  const map = {
    pending: 'secondary', in_transit: 'primary', out_for_delivery: 'warning',
    delivered: 'success', failed: 'danger', returned: 'info',
  };
  return map[(status || '').toLowerCase().replace(/ /g, '_')] || 'secondary';
}

/* ─────────────────────────────────────────────
   SHIPPING RATE CALCULATOR
───────────────────────────────────────────── */
function initRateCalculator() {
  const form = document.querySelector('#rateCalculatorForm, [data-rate-calculator]');
  const result = document.querySelector('#rateResult, [data-rate-result]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Calculating…'; }

    try {
      const res  = await fetch('/api/v1/shipments/calculate-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      const rates = json.data || json.rates || json || [];

      if (result) {
        result.innerHTML = Array.isArray(rates) && rates.length
          ? `<h6 class="mt-3">Available Rates:</h6>` + rates.map((r) => `
              <div class="card mb-2">
                <div class="card-body d-flex justify-content-between align-items-center">
                  <div>
                    <strong>${r.carrier}</strong> — ${r.service}
                    <br><small class="text-muted">Estimated: ${r.estimated_days} business day(s)</small>
                  </div>
                  <span class="fs-5 fw-bold text-primary">$${parseFloat(r.rate || 0).toFixed(2)}</span>
                </div>
              </div>`).join('')
          : '<div class="alert alert-warning mt-3">No rates available for this route.</div>';
      }
    } catch (_) {
      if (result) result.innerHTML = '<div class="alert alert-danger mt-3">Failed to calculate rates.</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initShipmentTracking();
  initShipmentHistory();
  initRateCalculator();
});
