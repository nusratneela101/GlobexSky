/**
 * Globex Sky - trade-shows.js
 * Trade show pages: browse, search/filter, event registration, booth registration,
 * virtual show/booth placeholder, schedule meeting at show.
 */

const TradeShowsAPI = {
  BASE: '/api/v1/trade-shows',
  headers(json = true) {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },
  async get(path) {
    const res = await fetch(this.BASE + path, { headers: this.headers(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async post(path, body = {}) {
    const res = await fetch(this.BASE + path, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   BROWSE / LISTING
───────────────────────────────────────────── */
async function initTradeShowBrowse() {
  const container  = document.querySelector('.trade-shows-list, [data-trade-shows-list]');
  const searchInput = document.querySelector('#showSearch, [data-show-search]');
  const typeFilter  = document.querySelector('#showType, [data-show-type]');
  if (!container) return;

  let shows = [];

  const render = (list) => {
    container.innerHTML = list.length
      ? `<div class="row g-4">` + list.map((show) => {
          const upcoming = new Date(show.start_date) > Date.now();
          const ongoing  = new Date(show.start_date) <= Date.now() && new Date(show.end_date) >= Date.now();
          const badge    = ongoing ? 'success' : upcoming ? 'primary' : 'secondary';
          const label    = ongoing ? 'LIVE NOW' : upcoming ? 'Upcoming' : 'Ended';
          return `
          <div class="col-md-6 col-lg-4">
            <div class="card trade-show-card h-100">
              <div class="position-relative">
                <img src="${show.banner || '/assets/images/trade-show-placeholder.png'}" class="card-img-top" alt="${show.title}" style="height:180px;object-fit:cover">
                <span class="badge bg-${badge} position-absolute top-0 end-0 m-2">${label}</span>
              </div>
              <div class="card-body d-flex flex-column">
                <h5 class="card-title">${show.title}</h5>
                <p class="text-muted small mb-2"><i class="fas fa-map-marker-alt me-1"></i>${show.location || 'Virtual'}</p>
                <p class="text-muted small mb-2"><i class="fas fa-calendar me-1"></i>${new Date(show.start_date).toLocaleDateString()} – ${new Date(show.end_date).toLocaleDateString()}</p>
                <p class="card-text text-muted small">${(show.description || '').slice(0, 100)}${show.description?.length > 100 ? '…' : ''}</p>
                <div class="mt-auto pt-2 d-flex gap-2">
                  <a href="/pages/trade-shows/register.html?id=${show.id}" class="btn btn-sm btn-primary flex-grow-1">Register</a>
                  ${show.virtual ? `<a href="/pages/trade-shows/virtual-show.html?id=${show.id}" class="btn btn-sm btn-outline-info">Virtual</a>` : ''}
                </div>
              </div>
            </div>
          </div>`;
        }).join('') + `</div>`
      : '<p class="text-muted text-center py-5">No trade shows found.</p>';
  };

  const applyFilters = () => {
    let list = [...shows];
    const q  = searchInput?.value.trim().toLowerCase();
    const t  = typeFilter?.value;
    if (q) list = list.filter((s) => s.title.toLowerCase().includes(q) || (s.location || '').toLowerCase().includes(q));
    if (t === 'virtual')  list = list.filter((s) => s.virtual);
    if (t === 'physical') list = list.filter((s) => !s.virtual);
    if (t === 'upcoming') list = list.filter((s) => new Date(s.start_date) > Date.now());
    if (t === 'ongoing')  list = list.filter((s) => new Date(s.start_date) <= Date.now() && new Date(s.end_date) >= Date.now());
    render(list);
  };

  searchInput?.addEventListener('input', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);

  try {
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
    const data = await TradeShowsAPI.get('');
    shows = data.data || data || [];
    applyFilters();
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load trade shows.</p>';
  }
}

/* ─────────────────────────────────────────────
   EVENT REGISTRATION
───────────────────────────────────────────── */
async function initShowRegistration() {
  const form = document.querySelector('#showRegistrationForm, [data-show-registration]');
  if (!form) return;

  // Load show details from URL param
  const showId = new URLSearchParams(window.location.search).get('id');
  if (showId) {
    form.querySelector('[name="show_id"]')?.setAttribute('value', showId);
    try {
      const data = await TradeShowsAPI.get(`/${showId}`);
      const show = data.data || data;
      document.querySelector('[data-show-title]')?.textContent && (document.querySelector('[data-show-title]').textContent = show.title || '');
      document.querySelector('[data-show-date]') && (document.querySelector('[data-show-date]').textContent = `${new Date(show.start_date).toLocaleDateString()} – ${new Date(show.end_date).toLocaleDateString()}`);
    } catch (_) {}
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Registering…'; }

    try {
      const data = Object.fromEntries(new FormData(form));
      await TradeShowsAPI.post(`/${data.show_id || showId}/register`, data);
      if (typeof showToast === 'function') showToast('Registration successful! Confirmation email sent.', 'success');
      form.closest('.card, .modal-body')?.insertAdjacentHTML('afterend',
        '<div class="alert alert-success mt-3"><i class="fas fa-check-circle me-2"></i>You have successfully registered for this trade show!</div>');
      form.style.display = 'none';
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Registration failed.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   BOOTH REGISTRATION
───────────────────────────────────────────── */
function initBoothRegistration() {
  const form = document.querySelector('#boothRegistrationForm, [data-booth-registration]');
  if (!form) return;

  const showId = new URLSearchParams(window.location.search).get('id');
  if (showId) form.querySelector('[name="show_id"]')?.setAttribute('value', showId);

  // Booth size pricing
  const sizeSelect   = form.querySelector('[name="booth_size"]');
  const priceDisplay = document.querySelector('[data-booth-price]');
  const prices       = { small: 500, medium: 1000, large: 2000, xl: 3500 };

  sizeSelect?.addEventListener('change', () => {
    if (priceDisplay) priceDisplay.textContent = '$' + (prices[sizeSelect.value] || 0).toLocaleString();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

    try {
      const data = Object.fromEntries(new FormData(form));
      await TradeShowsAPI.post(`/${data.show_id || showId}/booth`, data);
      if (typeof showToast === 'function') showToast('Booth reserved! Proceeding to payment.', 'success');
      window.location.href = `/pages/payment/index.html?for=booth&show=${data.show_id || showId}`;
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Booth registration failed.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   VIRTUAL SHOW / BOOTH VIEWER
───────────────────────────────────────────── */
function initVirtualShow() {
  const container = document.querySelector('.virtual-show-container, [data-virtual-show]');
  if (!container) return;

  const showId = new URLSearchParams(window.location.search).get('id');

  // If A-Frame is available, render a basic 360° environment
  if (typeof AFRAME !== 'undefined') {
    container.innerHTML = `
      <a-scene style="height:600px">
        <a-sky src="/assets/images/trade-show-360.jpg" rotation="0 -130 0"></a-sky>
        <a-text value="GlobexSky Virtual Trade Show" position="0 2 -4" color="#0d6efd" align="center" width="6"></a-text>
        <a-box position="-1 0.5 -3" rotation="0 45 0" color="#0d6efd" shadow></a-box>
        <a-sphere position="0 1.25 -5" radius="1.25" color="#EF2D5E" shadow></a-sphere>
        <a-cylinder position="1 0.75 -3" radius="0.5" height="1.5" color="#FFC65D" shadow></a-cylinder>
        <a-plane position="0 0 -4" rotation="-90 0 0" width="4" height="4" color="#7BC8A4" shadow></a-plane>
        <a-camera><a-cursor></a-cursor></a-camera>
      </a-scene>`;
  } else {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-vr-cardboard text-primary" style="font-size:4rem"></i>
        <h4 class="mt-3">Virtual Trade Show</h4>
        ${showId ? `<p class="text-muted">Show ID: ${showId}</p>` : ''}
        <p class="text-muted">3D/VR environment requires A-Frame library to be loaded.</p>
        <button class="btn btn-primary" onclick="window.open('https://hubs.mozilla.com/','_blank','noopener')">
          <i class="fas fa-external-link-alt me-2"></i>Open in Mozilla Hubs
        </button>
      </div>`;
  }
}

/* ─────────────────────────────────────────────
   SCHEDULE MEETING AT SHOW
───────────────────────────────────────────── */
function initShowMeetingSchedule() {
  const form = document.querySelector('#showMeetingForm, [data-show-meeting-form]');
  if (!form) return;

  const showId = new URLSearchParams(window.location.search).get('show') || new URLSearchParams(window.location.search).get('id');
  if (showId) form.querySelector('[name="show_id"]')?.setAttribute('value', showId);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Scheduling…'; }

    try {
      const data = Object.fromEntries(new FormData(form));
      await TradeShowsAPI.post('/meetings', data);
      if (typeof showToast === 'function') showToast('Meeting scheduled! A confirmation email has been sent.', 'success');
      form.reset();
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Failed to schedule meeting.', 'error');
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
  initTradeShowBrowse();
  initShowRegistration();
  initBoothRegistration();
  initVirtualShow();
  initShowMeetingSchedule();
});
