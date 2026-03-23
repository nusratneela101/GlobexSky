/**
 * Globex Sky - campaigns.js
 * Campaign, flash sale, and promotions pages:
 * countdown timers, coupon code handling, add-to-cart, listing filters.
 */

/* ─────────────────────────────────────────────
   FLASH SALE COUNTDOWN PER PRODUCT
───────────────────────────────────────────── */
function initFlashSaleCountdowns() {
  document.querySelectorAll('[data-flash-end], .flash-countdown').forEach((el) => {
    const endTime = new Date(el.dataset.flashEnd || el.dataset.countdown).getTime();
    if (isNaN(endTime)) return;

    const hEl = el.querySelector('[data-h], .h');
    const mEl = el.querySelector('[data-m], .m');
    const sEl = el.querySelector('[data-s], .s');

    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (hEl) hEl.textContent = String(h).padStart(2, '0');
      if (mEl) mEl.textContent = String(m).padStart(2, '0');
      if (sEl) sEl.textContent = String(s).padStart(2, '0');
      if (diff <= 0) {
        clearInterval(id);
        const card = el.closest('.flash-sale-item, .product-card, [data-flash-item]');
        card?.classList.add('sale-ended');
        const cartBtn = card?.querySelector('[data-add-to-cart]');
        if (cartBtn) { cartBtn.disabled = true; cartBtn.textContent = 'Sale Ended'; }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
  });
}

/* ─────────────────────────────────────────────
   GLOBAL CAMPAIGN COUNTDOWN BANNER
───────────────────────────────────────────── */
function initCampaignBannerCountdown() {
  const banner  = document.querySelector('.campaign-banner, [data-campaign-banner]');
  const endAttr = banner?.dataset.endTime || banner?.dataset.flashEnd;
  if (!banner || !endAttr) return;

  const endTime = new Date(endAttr).getTime();
  if (isNaN(endTime)) return;

  const dEl = banner.querySelector('[data-d]');
  const hEl = banner.querySelector('[data-h]');
  const mEl = banner.querySelector('[data-m]');
  const sEl = banner.querySelector('[data-s]');

  const tick = () => {
    const diff = Math.max(0, endTime - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (dEl) dEl.textContent = String(d).padStart(2, '0');
    if (hEl) hEl.textContent = String(h).padStart(2, '0');
    if (mEl) mEl.textContent = String(m).padStart(2, '0');
    if (sEl) sEl.textContent = String(s).padStart(2, '0');
    if (diff <= 0) { clearInterval(id); banner.classList.add('campaign-ended'); }
  };
  tick();
  const id = setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────
   ADD TO CART FROM FLASH SALE CARDS
───────────────────────────────────────────── */
function initCampaignAddToCart() {
  const grids = document.querySelectorAll('.flash-sale-grid, .campaign-products, [data-campaign-grid]');
  grids.forEach((grid) => {
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add-to-cart], .btn-add-to-cart');
      if (!btn) return;
      if (btn.disabled) return;
      const card = btn.closest('[data-product-id], .product-card, .flash-sale-item');
      if (!card) return;
      const id       = card.dataset.productId || card.dataset.id;
      const name     = card.dataset.productName || card.querySelector('.product-name, .card-title')?.textContent?.trim() || 'Product';
      const price    = parseFloat(card.dataset.salePrice || card.dataset.productPrice || card.querySelector('.sale-price, .product-price')?.textContent?.replace(/[^0-9.]/g, '')) || 0;
      const image    = card.dataset.productImage || card.querySelector('img')?.src || '';
      const quantity = 1;

      if (typeof addToCart === 'function') {
        addToCart({ id, name, price, image, quantity, supplier: card.dataset.supplier || '', minOrder: 1 });
        if (typeof showToast === 'function') showToast(`${name} added to cart!`, 'success');
        btn.textContent = 'Added ✓';
        btn.classList.add('btn-success');
        setTimeout(() => { btn.textContent = 'Add to Cart'; btn.classList.remove('btn-success'); }, 2000);
      }
    });
  });
}

/* ─────────────────────────────────────────────
   COUPON CODE
───────────────────────────────────────────── */
function initCouponCode() {
  const form = document.querySelector('#couponForm, [data-coupon-form]');
  if (!form) return;

  const input    = form.querySelector('[name="coupon"], #couponInput');
  const applyBtn = form.querySelector('[type="submit"], [data-apply-coupon]');
  const statusEl = form.querySelector('[data-coupon-status], .coupon-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = input?.value.trim();
    if (!code) { if (typeof showToast === 'function') showToast('Please enter a coupon code.', 'error'); return; }

    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Applying…'; }
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'coupon-status'; }

    try {
      const res  = await fetch('/api/v1/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.valid || data.success) {
        const discount = data.discount_amount || data.discount || 0;
        const type     = data.discount_type || 'fixed';
        if (statusEl) {
          statusEl.textContent = `✓ Coupon applied! ${type === 'percent' ? data.discount + '%' : '$' + parseFloat(discount).toFixed(2)} off.`;
          statusEl.className = 'coupon-status text-success';
        }
        // Store coupon
        sessionStorage.setItem('globexCoupon', JSON.stringify({ code, discount, type }));
        // Fire event
        document.dispatchEvent(new CustomEvent('couponApplied', { detail: { code, discount, type } }));
        if (typeof showToast === 'function') showToast('Coupon applied successfully!', 'success');
      } else {
        if (statusEl) {
          statusEl.textContent = data.message || 'Invalid or expired coupon code.';
          statusEl.className = 'coupon-status text-danger';
        }
        if (typeof showToast === 'function') showToast(data.message || 'Invalid coupon code.', 'error');
      }
    } catch (_) {
      if (statusEl) { statusEl.textContent = 'Failed to validate coupon.'; statusEl.className = 'coupon-status text-danger'; }
    } finally {
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply'; }
    }
  });

  // Remove coupon
  document.querySelector('[data-remove-coupon]')?.addEventListener('click', () => {
    sessionStorage.removeItem('globexCoupon');
    if (input) input.value = '';
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'coupon-status'; }
    document.dispatchEvent(new CustomEvent('couponRemoved'));
    if (typeof showToast === 'function') showToast('Coupon removed.', 'info');
  });
}

/* ─────────────────────────────────────────────
   CAMPAIGN LISTING (filter active/upcoming/ended)
───────────────────────────────────────────── */
async function initCampaignListing() {
  const container  = document.querySelector('.campaigns-list, [data-campaigns-list]');
  const filterBtns = document.querySelectorAll('[data-campaign-filter]');
  if (!container) return;

  let allCampaigns = [];

  const load = async () => {
    try {
      container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
      const res  = await fetch('/api/v1/campaigns');
      const data = await res.json();
      allCampaigns = data.data || data || [];
      renderCampaigns('all');
    } catch (_) {
      container.innerHTML = '<p class="text-danger">Failed to load campaigns.</p>';
    }
  };

  const renderCampaigns = (filter) => {
    const now = Date.now();
    let list  = allCampaigns;
    if (filter === 'active')   list = allCampaigns.filter((c) => new Date(c.start_date) <= now && new Date(c.end_date) >= now);
    if (filter === 'upcoming') list = allCampaigns.filter((c) => new Date(c.start_date) > now);
    if (filter === 'ended')    list = allCampaigns.filter((c) => new Date(c.end_date) < now);

    container.innerHTML = list.length
      ? `<div class="row g-4">` + list.map((c) => {
          const now2    = Date.now();
          const started = new Date(c.start_date) <= now2;
          const ended   = new Date(c.end_date) < now2;
          const status  = ended ? 'ended' : (started ? 'active' : 'upcoming');
          return `
            <div class="col-md-6 col-lg-4">
              <div class="card campaign-card h-100 border-${status === 'active' ? 'primary' : status === 'upcoming' ? 'warning' : 'secondary'}">
                <img src="${c.banner || '/assets/images/campaign-placeholder.png'}" class="card-img-top" alt="${c.title}" style="height:180px;object-fit:cover">
                <div class="card-body">
                  <span class="badge bg-${status === 'active' ? 'primary' : status === 'upcoming' ? 'warning' : 'secondary'} mb-2">${status.toUpperCase()}</span>
                  <h5 class="card-title">${c.title}</h5>
                  <p class="card-text text-muted small">${c.description || ''}</p>
                  ${status === 'active' ? `
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <small>Ends in:</small>
                      <div class="flash-countdown" data-flash-end="${c.end_date}">
                        <span class="badge bg-dark"><span class="h">--</span>h <span class="m">--</span>m <span class="s">--</span>s</span>
                      </div>
                    </div>` : ''}
                  <small class="text-muted d-block">${new Date(c.start_date).toLocaleDateString()} – ${new Date(c.end_date).toLocaleDateString()}</small>
                </div>
                <div class="card-footer">
                  <a href="/pages/campaigns/index.html?id=${c.id}" class="btn btn-sm btn-primary w-100">
                    ${status === 'active' ? 'Shop Now' : status === 'upcoming' ? 'View Details' : 'View Campaign'}
                  </a>
                </div>
              </div>
            </div>`;
        }).join('') + `</div>`
      : '<p class="text-muted text-center py-5">No campaigns found.</p>';

    // Re-init flash countdowns for newly rendered cards
    initFlashSaleCountdowns();
  };

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderCampaigns(btn.dataset.campaignFilter);
    });
  });

  await load();
}

/* ─────────────────────────────────────────────
   PROMOTIONS / DISCOUNT SECTION
───────────────────────────────────────────── */
async function initPromotionsList() {
  const container = document.querySelector('.promotions-list, [data-promotions-list]');
  if (!container) return;

  try {
    const res  = await fetch('/api/v1/promotions');
    const data = await res.json();
    const promos = data.data || data || [];

    container.innerHTML = promos.length
      ? promos.map((p) => `
        <div class="promo-item card mb-3">
          <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <span class="badge bg-danger fs-6 me-2">${p.discount_type === 'percent' ? p.discount + '% OFF' : '$' + p.discount + ' OFF'}</span>
              <strong>${p.title}</strong>
              <p class="mb-0 small text-muted">${p.description || ''}</p>
              <small class="text-muted">Code: <code class="fw-bold">${p.code}</code></small>
            </div>
            <button class="btn btn-outline-primary" data-copy-code="${p.code}">Copy Code</button>
          </div>
        </div>`).join('')
      : '<p class="text-muted">No active promotions.</p>';

    container.querySelectorAll('[data-copy-code]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(btn.dataset.copyCode).then(() => {
          if (typeof showToast === 'function') showToast(`Code "${btn.dataset.copyCode}" copied!`, 'success');
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000);
        });
      });
    });
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load promotions.</p>';
  }
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initFlashSaleCountdowns();
  initCampaignBannerCountdown();
  initCampaignAddToCart();
  initCouponCode();
  initCampaignListing();
  initPromotionsList();
});
