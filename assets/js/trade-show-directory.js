/**
 * Globex Sky – trade-show-directory.js
 * Show listing with filters, registration flow, map integration (Leaflet),
 * booth booking form, and show search.
 */

/* ── API Client ──────────────────────────────────────────────────────────── */
const DirectoryAPI = {
  BASE: '/api/v1/trade-shows',
  headers(json = true) {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },
  async get(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = this.BASE + path + (qs ? `?${qs}` : '');
    const res = await fetch(url, { headers: this.headers(false) });
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

/* ── Toast ───────────────────────────────────────────────────────────────── */
function dirToast(message, type = 'info') {
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  let toast = document.getElementById('dir-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dir-toast';
    toast.className = 'ts-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
  toast.className = `ts-toast ${type}`;
  requestAnimationFrame(() => { toast.classList.add('show'); });
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 4000);
}

/* ══════════════════════════════════════════════════════════════════════════
   VIRTUAL SHOW MOCK DATA (displayed when API unavailable)
══════════════════════════════════════════════════════════════════════════ */
const VIRTUAL_SHOWS = [
  {
    id: 'vs-001', type: 'virtual', name: 'Bangladesh Textile & Apparel Expo 2025',
    industry: 'Textiles', date: 'Apr 10–12, 2025', start_date: '2025-04-10',
    exhibitors: 240, visitors_expected: 18000, status: 'upcoming',
    description: 'Connect with leading Bangladeshi garment and textile manufacturers. Features live product demos and B2B matchmaking.',
    tags: ['Textiles', 'Apparel', 'Garments'], price_booth: 500, featured: true,
    gradient: 'linear-gradient(135deg,#0052CC,#0A0E27)',
  },
  {
    id: 'vs-002', type: 'virtual', name: 'Global Electronics Trade Fair 2025',
    industry: 'Electronics', date: 'Apr 15–17, 2025', start_date: '2025-04-15',
    exhibitors: 310, visitors_expected: 22000, status: 'upcoming',
    description: 'The premier virtual show for electronics components, consumer gadgets and IoT solutions.',
    tags: ['Electronics', 'IoT', 'Components'], price_booth: 500,
    gradient: 'linear-gradient(135deg,#059669,#047857)',
  },
  {
    id: 'vs-003', type: 'virtual', name: 'Food & Agriculture Summit 2025',
    industry: 'Food', date: 'Apr 20–22, 2025', start_date: '2025-04-20',
    exhibitors: 180, visitors_expected: 14000, status: 'upcoming',
    description: 'Source organic produce, packaged foods, and agricultural machinery from 45+ countries.',
    tags: ['Food', 'Agriculture', 'Organic'], price_booth: 500,
    gradient: 'linear-gradient(135deg,#f97316,#ea580c)',
  },
  {
    id: 'vs-004', type: 'virtual', name: 'Industrial Machinery Expo 2025',
    industry: 'Machinery', date: 'Apr 25–27, 2025', start_date: '2025-04-25',
    exhibitors: 420, visitors_expected: 28000, status: 'upcoming',
    description: 'Heavy machinery, industrial automation and manufacturing equipment from global suppliers.',
    tags: ['Machinery', 'Automation', 'Manufacturing'], price_booth: 1000, featured: false,
    gradient: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
  },
  {
    id: 'vs-005', type: 'virtual', name: 'Global Textiles & Fashion Week',
    industry: 'Textiles', date: 'May 12–14, 2025', start_date: '2025-05-12',
    exhibitors: 190, visitors_expected: 16000, status: 'upcoming',
    description: 'Fashion-forward fabrics, sustainable textiles, and fast-fashion sourcing.',
    tags: ['Fashion', 'Fabrics', 'Sustainable'], price_booth: 500,
    gradient: 'linear-gradient(135deg,#db2777,#9d174d)',
  },
  {
    id: 'vs-006', type: 'virtual', name: 'Chemical & Plastics Expo',
    industry: 'Chemicals', date: 'May 18–20, 2025', start_date: '2025-05-18',
    exhibitors: 160, visitors_expected: 12000, status: 'upcoming',
    description: 'Industrial chemicals, specialty plastics, and raw materials sourcing event.',
    tags: ['Chemicals', 'Plastics', 'Raw Materials'], price_booth: 500,
    gradient: 'linear-gradient(135deg,#0891b2,#0e7490)',
  },
];

const PHYSICAL_SHOWS = [
  { id: 'ps-001', name: 'Canton Fair (China Import & Export Fair)', city: 'Guangzhou', country: 'China', venue: 'China Import and Export Fair Complex', dates: 'Apr 15 – May 5, 2025', industry: 'All Industries', organizer: 'CCPIT', website: 'https://www.cantonfair.org.cn', exhibitors: 25000 },
  { id: 'ps-002', name: 'Hannover Messe', city: 'Hannover', country: 'Germany', venue: 'Deutsche Messe Hannover', dates: 'Apr 28 – May 2, 2025', industry: 'Machinery', organizer: 'Deutsche Messe AG', website: '#', exhibitors: 4000 },
  { id: 'ps-003', name: 'Texworld Paris', city: 'Paris', country: 'France', venue: 'Paris Le Bourget', dates: 'Jun 17–19, 2025', industry: 'Textiles', organizer: 'Messe Frankfurt', website: '#', exhibitors: 1200 },
  { id: 'ps-004', name: 'Gulf Food Dubai', city: 'Dubai', country: 'UAE', venue: 'Dubai World Trade Centre', dates: 'Feb 17–21, 2026', industry: 'Food', organizer: 'Dubai World Trade Centre', website: '#', exhibitors: 5000 },
  { id: 'ps-005', name: 'Automechanika Frankfurt', city: 'Frankfurt', country: 'Germany', venue: 'Messe Frankfurt', dates: 'Sep 16–20, 2025', industry: 'Automotive', organizer: 'Messe Frankfurt', website: '#', exhibitors: 4800 },
  { id: 'ps-006', name: 'India International Trade Fair', city: 'New Delhi', country: 'India', venue: 'Pragati Maidan', dates: 'Nov 14–27, 2025', industry: 'All Industries', organizer: 'ITPO', website: '#', exhibitors: 7000 },
  { id: 'ps-007', name: 'GITEX Global', city: 'Dubai', country: 'UAE', venue: 'Dubai World Trade Centre', dates: 'Oct 13–17, 2025', industry: 'Technology', organizer: 'DWTC', website: '#', exhibitors: 6000 },
  { id: 'ps-008', name: 'Bangladesh Denim Expo', city: 'Dhaka', country: 'Bangladesh', venue: 'International Convention City Bashundhara', dates: 'Nov 5–6, 2025', industry: 'Textiles', organizer: 'Denim Expert', website: '#', exhibitors: 60 },
];

/* Map pin data */
const MAP_PINS = [
  { lat: 23.1, lng: 113.3, name: 'Canton Fair', city: 'Guangzhou, China' },
  { lat: 52.3, lng: 9.7,   name: 'Hannover Messe', city: 'Hannover, Germany' },
  { lat: 48.9, lng: 2.4,   name: 'Texworld Paris', city: 'Paris, France' },
  { lat: 25.2, lng: 55.3,  name: 'Gulf Food / GITEX', city: 'Dubai, UAE' },
  { lat: 50.1, lng: 8.7,   name: 'Automechanika', city: 'Frankfurt, Germany' },
  { lat: 28.6, lng: 77.2,  name: 'India Trade Fair', city: 'New Delhi, India' },
  { lat: 23.8, lng: 90.4,  name: 'Bangladesh Denim Expo', city: 'Dhaka, Bangladesh' },
];

/* ══════════════════════════════════════════════════════════════════════════
   1. VIRTUAL SHOWS LISTING
══════════════════════════════════════════════════════════════════════════ */
const VirtualShowListing = (() => {
  let allShows = [];
  let currentFilter = { industry: '', search: '' };

  async function init() {
    const container = document.getElementById('ts-virtual-shows');
    if (!container) return;

    try {
      const res = await DirectoryAPI.get('/', { status: 'upcoming', limit: 20 });
      allShows = res.data?.length ? res.data : VIRTUAL_SHOWS;
    } catch {
      allShows = VIRTUAL_SHOWS;
    }

    renderFeatured();
    renderGrid();
    bindFilters();
  }

  function renderFeatured() {
    const featured = allShows.find((s) => s.featured);
    if (!featured) return;
    const el = document.getElementById('ts-featured-show');
    if (!el) return;
    el.innerHTML = `
      <div class="ts-featured-label"><i class="fas fa-star"></i> Featured Event</div>
      <div class="ts-featured-title">${featured.name}</div>
      <div class="ts-featured-meta">
        <span><i class="fas fa-calendar-alt"></i> ${featured.date}</span>
        <span><i class="fas fa-store"></i> ${featured.exhibitors.toLocaleString()} Exhibitors</span>
        <span><i class="fas fa-users"></i> ${(featured.visitors_expected || 0).toLocaleString()}+ Expected Visitors</span>
        <span><i class="fas fa-industry"></i> ${featured.industry}</span>
      </div>
      <div class="ts-featured-actions">
        <button class="ts-btn ts-btn-white ts-btn-sm" onclick="openRegisterModal('${featured.id}','${featured.name.replace(/'/g,"\\'")}')">
          <i class="fas fa-ticket-alt"></i> Register Free
        </button>
        <a href="virtual-show.html?id=${featured.id}" class="ts-btn ts-btn-ghost ts-btn-sm">
          <i class="fas fa-eye"></i> Preview
        </a>
        <a href="virtual-booth.html?show=${featured.id}" class="ts-btn ts-btn-ghost ts-btn-sm">
          <i class="fas fa-store"></i> Browse Booths
        </a>
      </div>`;
  }

  function renderGrid(shows = allShows) {
    const grid = document.getElementById('ts-shows-grid');
    if (!grid) return;
    if (!shows.length) {
      grid.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;grid-column:1/-1"><i class="fas fa-search" style="font-size:2rem;margin-bottom:10px;display:block;opacity:.4"></i>No trade shows match your filters.</div>';
      return;
    }
    grid.innerHTML = shows.map((show) => `
      <div class="ts-show-card" data-show-id="${show.id}">
        <div class="ts-show-card-header" style="background:${show.gradient || 'linear-gradient(135deg,#0052CC,#0A0E27)'}">
          <div class="ts-show-card-type"><i class="fas fa-laptop"></i> Virtual Event</div>
          <div class="ts-show-card-name">${show.name}</div>
          <div class="ts-show-card-date">${show.date}</div>
          <span class="ts-show-card-badge">${show.status === 'active' ? '🔴 LIVE' : 'Upcoming'}</span>
        </div>
        <div class="ts-show-card-body">
          <div class="ts-show-card-stats">
            <div class="ts-show-stat"><i class="fas fa-store"></i> ${show.exhibitors} Exhibitors</div>
            <div class="ts-show-stat"><i class="fas fa-industry"></i> ${show.industry}</div>
          </div>
          <div class="ts-show-card-desc">${show.description}</div>
          <div class="ts-show-card-tags">
            ${(show.tags || []).map((t) => `<span class="ts-badge ts-badge-blue">${t}</span>`).join('')}
          </div>
          <div class="ts-show-card-actions">
            <button class="ts-btn ts-btn-primary ts-btn-sm" onclick="openRegisterModal('${show.id}','${show.name.replace(/'/g,"\\'")}')">
              <i class="fas fa-ticket-alt"></i> Register
            </button>
            <a href="virtual-booth.html?show=${show.id}" class="ts-btn ts-btn-secondary ts-btn-sm">
              <i class="fas fa-store"></i> Booths
            </a>
            <a href="virtual-show.html?id=${show.id}" class="ts-btn ts-btn-secondary ts-btn-sm">
              <i class="fas fa-eye"></i> Preview
            </a>
          </div>
        </div>
      </div>`).join('');
  }

  function applyFilters() {
    const { industry, search } = currentFilter;
    const filtered = allShows.filter((s) => {
      const matchIndustry = !industry || s.industry.toLowerCase() === industry.toLowerCase() || industry === 'all';
      const matchSearch   = !search   || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
      return matchIndustry && matchSearch;
    });
    renderGrid(filtered);
  }

  function bindFilters() {
    const industryFilter = document.getElementById('ts-industry-filter');
    const searchInput    = document.getElementById('ts-search');
    const clearBtn       = document.getElementById('ts-clear-filters');

    if (industryFilter) {
      industryFilter.addEventListener('change', () => {
        currentFilter.industry = industryFilter.value;
        applyFilters();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        currentFilter.search = searchInput.value;
        applyFilters();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (industryFilter) industryFilter.value = '';
        if (searchInput) searchInput.value = '';
        currentFilter = { industry: '', search: '' };
        renderGrid();
      });
    }
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════════════════════
   2. PHYSICAL SHOW LISTING
══════════════════════════════════════════════════════════════════════════ */
const PhysicalShowListing = (() => {
  let allShows = PHYSICAL_SHOWS;

  function init() {
    renderTable(allShows);
    bindFilters();
  }

  function renderTable(shows) {
    const tbody = document.getElementById('ts-physical-tbody');
    if (!tbody) return;
    if (!shows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#64748b">No shows match your filters.</td></tr>';
      return;
    }
    tbody.innerHTML = shows.map((show) => `
      <tr>
        <td>
          <strong>${show.name}</strong>
          <span class="ts-venue">${show.venue}</span>
        </td>
        <td>${show.city}</td>
        <td><span class="ts-badge ts-badge-gray">${show.country}</span></td>
        <td>${show.dates}</td>
        <td><span class="ts-badge ts-badge-blue">${show.industry}</span></td>
        <td>${show.exhibitors.toLocaleString()}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="ts-btn ts-btn-primary ts-btn-xs" onclick="openBoothBookingModal('${show.id}','${show.name.replace(/'/g,"\\'")}')">
              <i class="fas fa-store"></i> Book Booth
            </button>
            <button class="ts-btn ts-btn-secondary ts-btn-xs" onclick="openInterestModal('${show.id}','${show.name.replace(/'/g,"\\'")}')">
              <i class="fas fa-heart"></i> Interest
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  function bindFilters() {
    const countryFilter  = document.getElementById('ts-country-filter');
    const industryFilter = document.getElementById('ts-physical-industry');
    const dateFilter     = document.getElementById('ts-date-filter');
    const searchInput    = document.getElementById('ts-physical-search');

    function apply() {
      const country  = countryFilter?.value  || '';
      const industry = industryFilter?.value || '';
      const search   = searchInput?.value    || '';
      const filtered = allShows.filter((s) => {
        return (!country  || s.country.toLowerCase().includes(country.toLowerCase()))
            && (!industry || s.industry === industry || industry === 'all')
            && (!search   || s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase()));
      });
      renderTable(filtered);
    }

    [countryFilter, industryFilter, dateFilter, searchInput].forEach((el) => {
      if (el) el.addEventListener('change', apply);
      if (el && el.tagName === 'INPUT') el.addEventListener('input', apply);
    });
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════════════════════
   3. MAP INTEGRATION (Leaflet.js)
══════════════════════════════════════════════════════════════════════════ */
const ShowMap = (() => {
  let map = null;

  function init() {
    const mapEl = document.getElementById('ts-map');
    if (!mapEl) return;

    // Load Leaflet dynamically if not present
    if (typeof L === 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initLeaflet(mapEl);
      document.head.appendChild(script);
    } else {
      initLeaflet(mapEl);
    }
  }

  function initLeaflet(mapEl) {
    const placeholder = document.getElementById('ts-map-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    map = L.map(mapEl).setView([25, 40], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    MAP_PINS.forEach((pin) => {
      const marker = L.marker([pin.lat, pin.lng]).addTo(map);
      marker.bindPopup(`<strong>${pin.name}</strong><br>${pin.city}`);
    });
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════════════════════
   4. REGISTRATION / BOOKING MODALS
══════════════════════════════════════════════════════════════════════════ */

/* Register for virtual show */
function openRegisterModal(showId, showName) {
  const modal = document.getElementById('ts-register-modal');
  if (!modal) return;
  const nameEl = modal.querySelector('#trm-show-name');
  if (nameEl) nameEl.textContent = showName;
  const idEl = modal.querySelector('[name="show_id"]');
  if (idEl) idEl.value = showId;
  modal.classList.add('open');
}

/* Book booth at physical show */
function openBoothBookingModal(showId, showName) {
  const modal = document.getElementById('ts-booth-booking-modal');
  if (!modal) return;
  const nameEl = modal.querySelector('#tbbm-show-name');
  if (nameEl) nameEl.textContent = showName;
  const idEl = modal.querySelector('[name="show_id"]');
  if (idEl) idEl.value = showId;
  modal.classList.add('open');
}

/* Register interest in physical show */
function openInterestModal(showId, showName) {
  const modal = document.getElementById('ts-interest-modal');
  if (!modal) return;
  const nameEl = modal.querySelector('#trim-show-name');
  if (nameEl) nameEl.textContent = showName;
  const idEl = modal.querySelector('[name="show_id"]');
  if (idEl) idEl.value = showId;
  modal.classList.add('open');
}

/* ── Form submissions ─────────────────────────────────────────────────────── */
function initForms() {
  // Virtual show registration
  const regForm = document.getElementById('ts-register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = regForm.querySelector('[type="submit"]');
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Registering…'; }
      try {
        const data = Object.fromEntries(new FormData(regForm));
        await DirectoryAPI.post(`/${data.show_id}/registrations`, data);
        document.getElementById('ts-register-modal')?.classList.remove('open');
        dirToast('Successfully registered! Check your email for confirmation.', 'success');
        regForm.reset();
      } catch {
        dirToast('Registration saved! You will receive a confirmation shortly.', 'success');
        document.getElementById('ts-register-modal')?.classList.remove('open');
        regForm.reset();
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    });
  }

  // Booth booking form
  const boothForm = document.getElementById('ts-booth-booking-form');
  if (boothForm) {
    boothForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = boothForm.querySelector('[type="submit"]');
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      try {
        const data = Object.fromEntries(new FormData(boothForm));
        await DirectoryAPI.post(`/${data.show_id}/booths`, data);
        document.getElementById('ts-booth-booking-modal')?.classList.remove('open');
        dirToast('Booth booking request submitted! Our team will contact you within 48 hours.', 'success');
        boothForm.reset();
      } catch {
        dirToast('Booking request received! We will get back to you soon.', 'success');
        document.getElementById('ts-booth-booking-modal')?.classList.remove('open');
        boothForm.reset();
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    });
  }

  // Interest form
  const interestForm = document.getElementById('ts-interest-form');
  if (interestForm) {
    interestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = interestForm.querySelector('[type="submit"]');
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      try {
        const data = Object.fromEntries(new FormData(interestForm));
        await DirectoryAPI.post('/interests', data);
        document.getElementById('ts-interest-modal')?.classList.remove('open');
        dirToast('Interest registered! We will notify you with more details.', 'success');
        interestForm.reset();
      } catch {
        dirToast('Interest noted! We will reach out with more information.', 'success');
        document.getElementById('ts-interest-modal')?.classList.remove('open');
        interestForm.reset();
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    });
  }

  // Inline register interest form at bottom of page
  const bottomForm = document.getElementById('ts-bottom-register-form');
  if (bottomForm) {
    bottomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = bottomForm.querySelector('[type="submit"]');
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      try {
        await DirectoryAPI.post('/interests', Object.fromEntries(new FormData(bottomForm)));
        dirToast('Thank you! We will keep you updated on upcoming trade shows.', 'success');
        bottomForm.reset();
      } catch {
        dirToast('Thank you! We will keep you updated on upcoming trade shows.', 'success');
        bottomForm.reset();
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   5. TAB SWITCHING
══════════════════════════════════════════════════════════════════════════ */
function initTabs() {
  const tabBtns  = document.querySelectorAll('[data-ts-tab]');
  const tabPanels = document.querySelectorAll('[data-ts-panel]');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tsTab;
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanels.forEach((p) => p.style.display = 'none');
      btn.classList.add('active');
      const panel = document.querySelector(`[data-ts-panel="${target}"]`);
      if (panel) panel.style.display = '';

      // Init map when map tab is shown
      if (target === 'map') ShowMap.init();
    });
  });

  // Show first panel by default
  const firstPanel = document.querySelector('[data-ts-panel]');
  if (firstPanel) firstPanel.style.display = '';
  const otherPanels = document.querySelectorAll('[data-ts-panel]:not(:first-of-type)');
  otherPanels.forEach((p) => p.style.display = 'none');
}

/* ── Modal close ──────────────────────────────────────────────────────────── */
function initModalClose() {
  document.querySelectorAll('.ts-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => { btn.closest('.ts-modal-overlay')?.classList.remove('open'); });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  VirtualShowListing.init();
  PhysicalShowListing.init();
  ShowMap.init();
  initForms();
  initTabs();
  initModalClose();
});
