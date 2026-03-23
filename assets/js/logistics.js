/**
 * Globex Sky - logistics.js
 * Logistics pages: freight quote, warehousing listing, shipping calculator.
 */

/* ─────────────────────────────────────────────
   FREIGHT QUOTE REQUEST
───────────────────────────────────────────── */
function initFreightQuote() {
  const form = document.querySelector('#freightQuoteForm, [data-freight-form]');
  const result = document.querySelector('#freightQuoteResult, [data-freight-result]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Getting Quotes…'; }
    if (result) result.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
      const data = Object.fromEntries(new FormData(form));
      const res  = await fetch('/api/v1/logistics/freight/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      const quotes = json.data || json.quotes || json || [];

      if (result) {
        result.innerHTML = Array.isArray(quotes) && quotes.length
          ? `<h5 class="mb-3">Available Freight Options</h5>
             <div class="row g-3">
               ${quotes.map((q) => `
                 <div class="col-md-6">
                   <div class="card h-100">
                     <div class="card-body">
                       <div class="d-flex justify-content-between align-items-start mb-2">
                         <div>
                           <h6 class="mb-0">${q.carrier}</h6>
                           <small class="text-muted">${q.service_type || 'Standard'}</small>
                         </div>
                         <span class="fs-5 fw-bold text-primary">$${parseFloat(q.price || 0).toFixed(2)}</span>
                       </div>
                       <ul class="list-unstyled small text-muted mb-3">
                         <li><i class="fas fa-clock me-1"></i>Transit: ${q.transit_days} days</li>
                         <li><i class="fas fa-shield-alt me-1"></i>Insurance: ${q.insurance ? 'Included' : 'Optional'}</li>
                         <li><i class="fas fa-map-marker-alt me-1"></i>Tracking: ${q.tracking ? 'Yes' : 'No'}</li>
                       </ul>
                       <button class="btn btn-primary btn-sm w-100" data-select-quote="${q.id}" data-quote-json='${JSON.stringify(q)}'>
                         Select This Option
                       </button>
                     </div>
                   </div>
                 </div>`).join('')}
             </div>`
          : '<div class="alert alert-warning">No freight options available for this route.</div>';

        result.querySelectorAll('[data-select-quote]').forEach((btn) => {
          btn.addEventListener('click', () => {
            try {
              const q = JSON.parse(btn.dataset.quoteJson);
              sessionStorage.setItem('selectedFreight', JSON.stringify(q));
              if (typeof showToast === 'function') showToast(`Selected: ${q.carrier} — $${parseFloat(q.price).toFixed(2)}`, 'success');
              // Scroll to booking section if it exists
              document.querySelector('#freightBooking, [data-freight-booking]')?.scrollIntoView({ behavior: 'smooth' });
            } catch (_) {}
          });
        });
      }
    } catch (_) {
      if (result) result.innerHTML = '<div class="alert alert-danger">Failed to fetch freight quotes.</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   WAREHOUSING LISTING
───────────────────────────────────────────── */
async function initWarehousingList() {
  const container   = document.querySelector('.warehouses-list, [data-warehouses-list]');
  const searchInput = document.querySelector('#warehouseSearch, [data-warehouse-search]');
  const countryFilter = document.querySelector('#warehouseCountry, [data-warehouse-country]');
  if (!container) return;

  let warehouses = [];

  const render = (list) => {
    container.innerHTML = list.length
      ? `<div class="row g-4">` + list.map((w) => `
          <div class="col-md-6 col-xl-4">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                  <h6 class="mb-0">${w.name}</h6>
                  <span class="badge bg-${w.available ? 'success' : 'secondary'}">${w.available ? 'Available' : 'Full'}</span>
                </div>
                <p class="text-muted small mb-2">
                  <i class="fas fa-map-marker-alt me-1"></i>${w.city}, ${w.country}
                </p>
                <ul class="list-unstyled small text-muted mb-3">
                  <li><i class="fas fa-warehouse me-1"></i>Capacity: ${w.capacity ? w.capacity.toLocaleString() + ' m²' : '—'}</li>
                  <li><i class="fas fa-thermometer-half me-1"></i>Temp Control: ${w.temp_controlled ? 'Yes' : 'No'}</li>
                  <li><i class="fas fa-shield-alt me-1"></i>Security: ${w.security || '24/7'}</li>
                </ul>
                <div class="d-flex justify-content-between align-items-center">
                  <span class="fw-bold text-primary">$${parseFloat(w.price_per_sqm || 0).toFixed(2)}/m²/mo</span>
                  <button class="btn btn-sm btn-primary" data-inquire-warehouse="${w.id}" ${!w.available ? 'disabled' : ''}>
                    Inquire
                  </button>
                </div>
              </div>
            </div>
          </div>`).join('') + `</div>`
      : '<p class="text-muted text-center py-5">No warehouses found.</p>';

    container.querySelectorAll('[data-inquire-warehouse]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modal = document.querySelector('#warehouseInquiryModal, [data-warehouse-inquiry-modal]');
        if (modal) {
          modal.querySelector('[name="warehouse_id"]')?.setAttribute('value', btn.dataset.inquireWarehouse);
          if (typeof bootstrap !== 'undefined') new bootstrap.Modal(modal).show();
        } else {
          window.location.href = `/pages/logistics/warehousing.html?inquire=${btn.dataset.inquireWarehouse}`;
        }
      });
    });
  };

  const applyFilters = () => {
    let list    = [...warehouses];
    const q     = searchInput?.value.trim().toLowerCase();
    const country = countryFilter?.value;
    if (q) list = list.filter((w) => w.name.toLowerCase().includes(q) || w.city?.toLowerCase().includes(q));
    if (country) list = list.filter((w) => w.country === country);
    render(list);
  };

  searchInput?.addEventListener('input', applyFilters);
  countryFilter?.addEventListener('change', applyFilters);

  try {
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
    const res  = await fetch('/api/v1/logistics/warehouses');
    const data = await res.json();
    warehouses = data.data || data || [];
    applyFilters();
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load warehouses.</p>';
  }
}

/* ─────────────────────────────────────────────
   SHIPPING CALCULATOR
───────────────────────────────────────────── */
function initShippingCalculator() {
  const form   = document.querySelector('#shippingCalculatorForm, [data-shipping-calculator]');
  const result = document.querySelector('#shippingResult, [data-shipping-result]');
  if (!form) return;

  // Dimensional weight calculator
  const lengthInput = form.querySelector('[name="length"]');
  const widthInput  = form.querySelector('[name="width"]');
  const heightInput = form.querySelector('[name="height"]');
  const dimWeightEl = document.querySelector('[data-dim-weight]');

  const calcDimWeight = () => {
    const l = parseFloat(lengthInput?.value || 0);
    const w = parseFloat(widthInput?.value  || 0);
    const h = parseFloat(heightInput?.value || 0);
    if (l && w && h && dimWeightEl) {
      const dw = (l * w * h) / 5000; // standard divisor
      dimWeightEl.textContent = `Dim. Weight: ${dw.toFixed(2)} kg`;
    }
  };

  [lengthInput, widthInput, heightInput].forEach((el) => el?.addEventListener('input', calcDimWeight));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Calculating…'; }
    if (result) result.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>';

    try {
      const data = Object.fromEntries(new FormData(form));
      const res  = await fetch('/api/v1/logistics/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      const rates = json.data || json.rates || json || [];

      if (result) {
        result.innerHTML = Array.isArray(rates) && rates.length
          ? `<h6 class="mt-2 mb-3">Estimated Shipping Rates:</h6>
             <div class="table-responsive">
               <table class="table table-bordered table-sm">
                 <thead>
                   <tr><th>Service</th><th>Carrier</th><th>Rate</th><th>Days</th></tr>
                 </thead>
                 <tbody>
                   ${rates.map((r) => `
                     <tr>
                       <td>${r.service}</td>
                       <td>${r.carrier}</td>
                       <td class="fw-bold text-primary">$${parseFloat(r.rate || 0).toFixed(2)}</td>
                       <td>${r.estimated_days} days</td>
                     </tr>`).join('')}
                 </tbody>
               </table>
             </div>`
          : '<div class="alert alert-warning mt-2">No rates available for this route.</div>';
      }
    } catch (_) {
      if (result) result.innerHTML = '<div class="alert alert-danger mt-2">Failed to calculate shipping rates.</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function validateForm(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    field.classList.remove('is-invalid');
    if (!field.value.trim()) { field.classList.add('is-invalid'); valid = false; }
  });
  if (!valid && typeof showToast === 'function') showToast('Please fill in all required fields.', 'error');
  return valid;
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initFreightQuote();
  initWarehousingList();
  initShippingCalculator();
});
