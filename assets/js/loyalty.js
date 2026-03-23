/**
 * Globex Sky - loyalty.js
 * Loyalty program: points balance display, rewards catalog, redeem points,
 * buyer rewards, supplier membership tiers.
 */

const LoyaltyAPI = {
  BASE: '/api/v1/loyalty',
  headers() {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  },
  async get(path) {
    const res = await fetch(this.BASE + path, { headers: this.headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async post(path, body = {}) {
    const res = await fetch(this.BASE + path, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   POINTS BALANCE + OVERVIEW
───────────────────────────────────────────── */
async function initLoyaltyOverview() {
  const section = document.querySelector('.loyalty-overview, [data-loyalty-overview]');
  if (!section) return;

  try {
    const data = await LoyaltyAPI.get('/balance');
    const d    = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-stat="points"]',     (d.points || 0).toLocaleString());
    set('[data-stat="tier"]',       d.tier      || '—');
    set('[data-stat="next-tier"]',  d.nextTier  || '—');
    set('[data-stat="points-to-next"]', d.pointsToNext ? (d.pointsToNext).toLocaleString() + ' pts' : '—');
    set('[data-stat="lifetime"]',   (d.lifetimePoints || 0).toLocaleString());

    // Progress bar toward next tier
    const progressBar = section.querySelector('.tier-progress, [data-tier-progress]');
    if (progressBar && d.tierProgress !== undefined) {
      progressBar.style.width = Math.min(100, d.tierProgress) + '%';
      progressBar.setAttribute('aria-valuenow', d.tierProgress);
    }

    // Tier badge
    const tierBadge = section.querySelector('[data-tier-badge]');
    if (tierBadge) {
      const colors = { bronze: 'warning', silver: 'secondary', gold: 'warning', platinum: 'info', diamond: 'primary' };
      const tier   = (d.tier || 'bronze').toLowerCase();
      tierBadge.className = `badge bg-${colors[tier] || 'secondary'} fs-6`;
      tierBadge.textContent = d.tier || 'Bronze';
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   REWARDS CATALOG
───────────────────────────────────────────── */
async function initRewardsCatalog() {
  const container  = document.querySelector('.rewards-catalog, [data-rewards-catalog]');
  const categoryFilter = document.querySelector('#rewardCategory, [data-reward-category]');
  if (!container) return;

  let allRewards = [];

  const render = (list) => {
    container.innerHTML = list.length
      ? `<div class="row g-3">` + list.map((r) => `
          <div class="col-sm-6 col-md-4 col-lg-3">
            <div class="card reward-card h-100 ${r.featured ? 'border-primary' : ''}">
              <img src="${r.image || '/assets/images/reward-placeholder.png'}" class="card-img-top" alt="${r.name}" style="height:160px;object-fit:cover">
              <div class="card-body d-flex flex-column">
                ${r.featured ? '<span class="badge bg-primary mb-2">Featured</span>' : ''}
                <h6 class="card-title">${r.name}</h6>
                <p class="text-muted small">${r.description || ''}</p>
                <div class="mt-auto pt-2">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold text-warning"><i class="fas fa-star me-1"></i>${(r.points_required || 0).toLocaleString()} pts</span>
                    <span class="badge bg-light text-dark">${r.category || 'General'}</span>
                  </div>
                  <button class="btn btn-primary btn-sm w-100" data-redeem-reward="${r.id}"
                    data-reward-name="${r.name}" data-reward-points="${r.points_required}">
                    Redeem
                  </button>
                </div>
              </div>
            </div>
          </div>`).join('') + `</div>`
      : '<p class="text-muted text-center py-5">No rewards available.</p>';

    container.querySelectorAll('[data-redeem-reward]').forEach((btn) => {
      btn.addEventListener('click', () => redeemReward(btn));
    });
  };

  const applyFilter = () => {
    const cat = categoryFilter?.value;
    render(cat ? allRewards.filter((r) => r.category === cat) : allRewards);
  };
  categoryFilter?.addEventListener('change', applyFilter);

  try {
    const data  = await LoyaltyAPI.get('/rewards');
    allRewards  = data.data || data || [];
    applyFilter();
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load rewards.</p>';
  }
}

async function redeemReward(btn) {
  const id    = btn.dataset.redeemReward;
  const name  = btn.dataset.rewardName;
  const pts   = parseInt(btn.dataset.rewardPoints, 10);

  if (!confirm(`Redeem "${name}" for ${pts.toLocaleString()} points?`)) return;
  btn.disabled = true; btn.textContent = 'Processing…';

  try {
    await LoyaltyAPI.post('/redeem', { reward_id: id });
    if (typeof showToast === 'function') showToast(`"${name}" redeemed successfully!`, 'success');
    btn.textContent = 'Redeemed ✓';
    btn.classList.replace('btn-primary', 'btn-success');
    // Refresh balance
    initLoyaltyOverview();
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Failed to redeem reward.', 'error');
    btn.disabled = false;
    btn.textContent = 'Redeem';
  }
}

/* ─────────────────────────────────────────────
   POINTS HISTORY
───────────────────────────────────────────── */
async function initPointsHistory() {
  const container = document.querySelector('.points-history, [data-points-history]');
  if (!container) return;

  try {
    const data   = await LoyaltyAPI.get('/history');
    const history = data.data || data || [];

    container.innerHTML = history.length
      ? `<div class="table-responsive">
          <table class="table table-hover">
            <thead><tr><th>Date</th><th>Description</th><th>Points</th><th>Balance</th></tr></thead>
            <tbody>
              ${history.map((h) => `
                <tr>
                  <td>${new Date(h.created_at || h.date).toLocaleDateString()}</td>
                  <td>${h.description || h.type}</td>
                  <td class="${h.points >= 0 ? 'text-success' : 'text-danger'} fw-bold">
                    ${h.points >= 0 ? '+' : ''}${h.points.toLocaleString()}
                  </td>
                  <td>${(h.balance || 0).toLocaleString()}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="text-muted text-center py-4">No points history.</p>';
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load history.</p>';
  }
}

/* ─────────────────────────────────────────────
   BUYER REWARDS (special section)
───────────────────────────────────────────── */
async function initBuyerRewards() {
  const section = document.querySelector('.buyer-rewards, [data-buyer-rewards]');
  if (!section) return;

  try {
    const data    = await LoyaltyAPI.get('/buyer-rewards');
    const rewards = data.data || data || [];

    const container = section.querySelector('.buyer-rewards-list, [data-buyer-rewards-list]');
    if (container) {
      container.innerHTML = rewards.length
        ? rewards.map((r) => `
          <div class="reward-tier-item d-flex gap-3 align-items-center border-bottom py-3">
            <div class="reward-icon rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style="width:48px;height:48px;background:#fff3cd">
              <i class="fas fa-${r.icon || 'gift'} text-warning fs-5"></i>
            </div>
            <div class="flex-grow-1">
              <h6 class="mb-1">${r.title}</h6>
              <p class="text-muted small mb-1">${r.description || ''}</p>
              <small class="text-warning fw-bold"><i class="fas fa-star me-1"></i>${(r.points_required || 0).toLocaleString()} pts required</small>
            </div>
            <button class="btn btn-sm btn-warning" data-claim-reward="${r.id}" data-reward-name="${r.title}" data-reward-points="${r.points_required}">
              Claim
            </button>
          </div>`).join('')
        : '<p class="text-muted">No buyer rewards available.</p>';

      container.querySelectorAll('[data-claim-reward]').forEach((btn) => {
        btn.addEventListener('click', () => redeemReward(btn));
      });
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   SUPPLIER MEMBERSHIP TIERS
───────────────────────────────────────────── */
async function initSupplierMembership() {
  const section = document.querySelector('.supplier-membership, [data-supplier-membership]');
  if (!section) return;

  const tiers = [
    { name: 'Bronze',   minPoints: 0,     color: '#cd7f32', perks: ['Basic listing', '5% commission discount', 'Standard support'] },
    { name: 'Silver',   minPoints: 1000,  color: '#c0c0c0', perks: ['Featured listing', '10% commission discount', 'Priority support', 'Analytics access'] },
    { name: 'Gold',     minPoints: 5000,  color: '#ffd700', perks: ['Top listing', '15% commission discount', '24/7 support', 'Advanced analytics', 'Campaign access'] },
    { name: 'Platinum', minPoints: 15000, color: '#e5e4e2', perks: ['Premium listing', '20% commission discount', 'Dedicated manager', 'All features', 'Custom branding'] },
  ];

  const container = section.querySelector('.tier-cards, [data-tier-cards]');
  if (container) {
    container.innerHTML = `<div class="row g-4">` + tiers.map((t) => `
      <div class="col-md-6 col-lg-3">
        <div class="card tier-card h-100 text-center" style="border-top:4px solid ${t.color}">
          <div class="card-body">
            <div class="mb-3" style="font-size:2.5rem;color:${t.color}">
              <i class="fas fa-medal"></i>
            </div>
            <h5>${t.name}</h5>
            <p class="text-muted small">${t.minPoints > 0 ? (t.minPoints).toLocaleString() + '+ points' : 'Starting tier'}</p>
            <ul class="list-unstyled text-start small">
              ${t.perks.map((p) => `<li class="mb-1"><i class="fas fa-check text-success me-2"></i>${p}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>`).join('') + `</div>`;
  }

  // Show current tier
  try {
    const data   = await LoyaltyAPI.get('/supplier-tier');
    const d      = data.data || data;
    const tierEl = section.querySelector('[data-current-tier]');
    if (tierEl) tierEl.textContent = d.tier || '—';
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initLoyaltyOverview();
  initRewardsCatalog();
  initPointsHistory();
  initBuyerRewards();
  initSupplierMembership();
});
