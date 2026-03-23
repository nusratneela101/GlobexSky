/**
 * Globex Sky - advertising.js
 * Advertising: ad listing with stats, create ad multi-step form,
 * targeting options, budget settings, schedule.
 */

const AdsAPI = {
  BASE: '/api/v1/advertising',
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
  async del(path) {
    const res = await fetch(this.BASE + path, { method: 'DELETE', headers: this.headers(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   AD DASHBOARD / LISTING
───────────────────────────────────────────── */
async function initAdDashboard() {
  const section = document.querySelector('.ads-dashboard, [data-ads-dashboard]');
  if (!section) return;

  try {
    const data = await AdsAPI.get('/dashboard');
    const d    = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-stat="total-ads"]',   d.totalAds   ?? '—');
    set('[data-stat="active-ads"]',  d.activeAds  ?? '—');
    set('[data-stat="impressions"]', d.impressions ? d.impressions.toLocaleString() : '—');
    set('[data-stat="clicks"]',      d.clicks      ? d.clicks.toLocaleString() : '—');
    set('[data-stat="ctr"]',         d.ctr         ? d.ctr.toFixed(2) + '%' : '—');
    set('[data-stat="spent"]',       d.totalSpent  ? '$' + parseFloat(d.totalSpent).toFixed(2) : '—');

    // Performance chart
    const canvas = section.querySelector('#adPerformanceChart, [data-ad-chart]');
    if (canvas && typeof Chart !== 'undefined' && d.chartData) {
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: d.chartData.labels || [],
          datasets: [
            { label: 'Impressions', data: d.chartData.impressions || [], borderColor: '#0d6efd', tension: 0.4 },
            { label: 'Clicks',      data: d.chartData.clicks || [],      borderColor: '#198754', tension: 0.4 },
          ],
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } },
      });
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   ADS LIST
───────────────────────────────────────────── */
async function initAdsList() {
  const container = document.querySelector('.ads-list, [data-ads-list]');
  if (!container) return;

  const load = async () => {
    try {
      const data = await AdsAPI.get('/ads');
      const ads  = data.data || data || [];

      container.innerHTML = ads.length
        ? `<div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr><th>Ad Name</th><th>Type</th><th>Status</th><th>Budget</th><th>Spent</th><th>Impressions</th><th>CTR</th><th>Actions</th></tr>
              </thead>
              <tbody>
                ${ads.map((ad) => `
                  <tr>
                    <td>
                      <div class="fw-bold">${ad.name}</div>
                      <small class="text-muted">${new Date(ad.start_date).toLocaleDateString()} – ${new Date(ad.end_date).toLocaleDateString()}</small>
                    </td>
                    <td><span class="badge bg-info">${ad.type || 'Banner'}</span></td>
                    <td><span class="badge bg-${adStatusColor(ad.status)}">${ad.status}</span></td>
                    <td>$${parseFloat(ad.budget || 0).toFixed(2)}</td>
                    <td>$${parseFloat(ad.spent || 0).toFixed(2)}</td>
                    <td>${(ad.impressions || 0).toLocaleString()}</td>
                    <td>${ad.ctr ? ad.ctr.toFixed(2) + '%' : '—'}</td>
                    <td>
                      <div class="d-flex gap-1">
                        <a href="/pages/advertising/create.html?id=${ad.id}" class="btn btn-sm btn-outline-primary">Edit</a>
                        ${ad.status === 'active'
                          ? `<button class="btn btn-sm btn-outline-warning" data-pause-ad="${ad.id}">Pause</button>`
                          : `<button class="btn btn-sm btn-outline-success" data-resume-ad="${ad.id}">Resume</button>`}
                        <button class="btn btn-sm btn-outline-danger" data-delete-ad="${ad.id}">Delete</button>
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`
        : '<p class="text-muted text-center py-5">No ads yet. <a href="/pages/advertising/create.html">Create your first ad</a>.</p>';

      container.querySelectorAll('[data-pause-ad]').forEach((btn) => {
        btn.addEventListener('click', () => updateAdStatus(btn.dataset.pauseAd, 'paused', load));
      });
      container.querySelectorAll('[data-resume-ad]').forEach((btn) => {
        btn.addEventListener('click', () => updateAdStatus(btn.dataset.resumeAd, 'active', load));
      });
      container.querySelectorAll('[data-delete-ad]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this ad?')) return;
          try {
            await AdsAPI.del(`/ads/${btn.dataset.deleteAd}`);
            if (typeof showToast === 'function') showToast('Ad deleted.', 'success');
            load();
          } catch (_) { if (typeof showToast === 'function') showToast('Failed to delete ad.', 'error'); }
        });
      });
    } catch (_) {
      container.innerHTML = '<p class="text-danger">Failed to load ads.</p>';
    }
  };

  await load();
}

async function updateAdStatus(adId, status, reload) {
  try {
    await AdsAPI.post(`/ads/${adId}/status`, { status });
    if (typeof showToast === 'function') showToast(`Ad ${status}.`, 'success');
    reload();
  } catch (_) {
    if (typeof showToast === 'function') showToast('Failed to update ad.', 'error');
  }
}

function adStatusColor(status) {
  const m = { active: 'success', paused: 'warning', ended: 'secondary', rejected: 'danger', pending: 'info' };
  return m[(status || '').toLowerCase()] || 'secondary';
}

/* ─────────────────────────────────────────────
   CREATE AD (MULTI-STEP)
───────────────────────────────────────────── */
function initCreateAd() {
  const wizard = document.querySelector('.ad-wizard, [data-ad-wizard]');
  if (!wizard) return;

  const steps     = Array.from(wizard.querySelectorAll('.wizard-step, [data-step]'));
  const indicators = wizard.querySelectorAll('.step-indicator, [data-step-indicator]');
  let currentStep  = 0;
  const formData   = {};

  const showStep = (index) => {
    steps.forEach((s, i) => {
      s.classList.toggle('active', i === index);
      s.style.display = i === index ? 'block' : 'none';
    });
    indicators.forEach((ind, i) => {
      ind.classList.toggle('active', i === index);
      ind.classList.toggle('completed', i < index);
    });

    const prevBtn = wizard.querySelector('[data-wizard-prev]');
    const nextBtn = wizard.querySelector('[data-wizard-next]');
    const submitBtn = wizard.querySelector('[data-wizard-submit]');
    if (prevBtn) prevBtn.style.display = index > 0 ? 'inline-block' : 'none';
    if (nextBtn) nextBtn.style.display = index < steps.length - 1 ? 'inline-block' : 'none';
    if (submitBtn) submitBtn.style.display = index === steps.length - 1 ? 'inline-block' : 'none';
  };

  const collectStep = (index) => {
    const step = steps[index];
    step.querySelectorAll('input, select, textarea').forEach((field) => {
      if (field.type === 'checkbox') {
        if (!formData[field.name]) formData[field.name] = [];
        if (field.checked) formData[field.name].push(field.value);
      } else if (field.type === 'radio') {
        if (field.checked) formData[field.name] = field.value;
      } else {
        formData[field.name] = field.value;
      }
    });
  };

  const validateStep = (index) => {
    let valid = true;
    steps[index].querySelectorAll('[required]').forEach((field) => {
      field.classList.remove('is-invalid');
      if (!field.value.trim()) { field.classList.add('is-invalid'); valid = false; }
    });
    if (!valid && typeof showToast === 'function') showToast('Please fill in all required fields.', 'error');
    return valid;
  };

  wizard.querySelector('[data-wizard-next]')?.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    collectStep(currentStep);
    currentStep++;
    showStep(currentStep);
    updateReview();
  });

  wizard.querySelector('[data-wizard-prev]')?.addEventListener('click', () => {
    collectStep(currentStep);
    currentStep--;
    showStep(currentStep);
  });

  // Budget preview
  const budgetInput   = wizard.querySelector('[name="daily_budget"], [name="total_budget"]');
  const budgetPreview = wizard.querySelector('[data-budget-preview]');
  if (budgetInput && budgetPreview) {
    budgetInput.addEventListener('input', () => {
      const daily = parseFloat(budgetInput.value) || 0;
      const days  = parseInt(wizard.querySelector('[name="duration_days"]')?.value || '30', 10);
      budgetPreview.textContent = `Est. total: $${(daily * days).toFixed(2)}`;
    });
  }

  // Review/summary
  function updateReview() {
    const reviewEl = wizard.querySelector('[data-review-summary]');
    if (!reviewEl || currentStep < steps.length - 1) return;
    reviewEl.innerHTML = Object.entries(formData).filter(([, v]) => v && v.length).map(([k, v]) =>
      `<div class="d-flex justify-content-between py-1 border-bottom">
         <span class="text-muted">${k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
         <strong>${Array.isArray(v) ? v.join(', ') : v}</strong>
       </div>`
    ).join('');
  }

  // Final submit
  wizard.querySelector('[data-wizard-submit]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    collectStep(currentStep);
    const btn  = e.currentTarget;
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Creating Ad…';

    try {
      const adId = new URLSearchParams(window.location.search).get('id');
      const endpoint = adId ? `/ads/${adId}` : '/ads';
      const method   = adId ? 'PUT' : 'POST';
      const token    = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
      const res = await fetch(AdsAPI.BASE + endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (typeof showToast === 'function') showToast(adId ? 'Ad updated!' : 'Ad created successfully!', 'success');
      setTimeout(() => { window.location.href = '/pages/advertising/index.html'; }, 1500);
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Failed to save ad.', 'error');
      btn.disabled = false; btn.textContent = orig;
    }
  });

  showStep(0);
}

/* ─────────────────────────────────────────────
   AD ANALYTICS
───────────────────────────────────────────── */
async function initAdAnalytics() {
  const section = document.querySelector('.ad-analytics, [data-ad-analytics]');
  if (!section) return;

  const adId = new URLSearchParams(window.location.search).get('id');
  if (!adId) return;

  try {
    const data = await AdsAPI.get(`/ads/${adId}/analytics`);
    const d    = data.data || data;

    const canvas = section.querySelector('#adAnalyticsChart, [data-analytics-chart]');
    if (canvas && typeof Chart !== 'undefined' && d.chartData) {
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: d.chartData.labels || [],
          datasets: [
            { label: 'Impressions', data: d.chartData.impressions || [], borderColor: '#0d6efd', tension: 0.4, yAxisID: 'y' },
            { label: 'Clicks',      data: d.chartData.clicks || [],      borderColor: '#198754', tension: 0.4, yAxisID: 'y1' },
          ],
        },
        options: {
          responsive: true,
          scales: {
            y:  { position: 'left', beginAtZero: true },
            y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } },
          },
        },
      });
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initAdDashboard();
  initAdsList();
  initCreateAd();
  initAdAnalytics();
});
