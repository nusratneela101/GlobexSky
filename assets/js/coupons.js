/**
 * coupons.js — Coupon & Voucher System Frontend
 *
 * Features:
 *  - Display available coupons to buyers
 *  - Copy coupon code to clipboard
 *  - Apply coupon at checkout (validate + show discount)
 *  - My usage history
 *
 * localStorage keys (demo / fallback):
 *  gsky_coupons_available — cached available coupons
 *  gsky_coupons_applied   — coupon applied in current session
 */

'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────

const API_BASE  = '/api/v1/coupons';
const LS_AVAIL  = 'gsky_coupons_available';
const LS_APPLIED = 'gsky_coupons_applied';

// ─── Demo Seed Data (used when API is unavailable) ───────────────────────────

const DEMO_COUPONS = [
  {
    id: 'demo-1',
    code: 'WELCOME10',
    type: 'percentage',
    value: 10,
    min_order_amount: 50,
    max_discount_amount: 30,
    currency: 'USD',
    valid_until: null,
    usage_limit: null,
    used_count: 0,
    per_user_limit: 1,
    applies_to: 'all',
  },
  {
    id: 'demo-2',
    code: 'SAVE20',
    type: 'fixed',
    value: 20,
    min_order_amount: 100,
    max_discount_amount: null,
    currency: 'USD',
    valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
    usage_limit: 500,
    used_count: 120,
    per_user_limit: 1,
    applies_to: 'all',
  },
  {
    id: 'demo-3',
    code: 'FREESHIP',
    type: 'free_shipping',
    value: 0,
    min_order_amount: 200,
    max_discount_amount: null,
    currency: 'USD',
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
    usage_limit: null,
    used_count: 0,
    per_user_limit: 3,
    applies_to: 'all',
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDiscount(coupon) {
  switch (coupon.type) {
    case 'percentage':  return `${coupon.value}% OFF`;
    case 'fixed':       return `-${coupon.currency} ${parseFloat(coupon.value).toFixed(2)}`;
    case 'free_shipping': return 'Free Shipping';
    default:            return String(coupon.value);
  }
}

function formatExpiry(coupon) {
  if (!coupon.valid_until) return 'No expiry';
  const d  = new Date(coupon.valid_until);
  const ms = d - Date.now();
  if (ms < 0)              return 'Expired';
  if (ms < 86400000 * 3)   return `Expires in ${Math.ceil(ms / 86400000)} day(s)`;
  return `Valid until ${d.toLocaleDateString()}`;
}

function headerClass(coupon) {
  switch (coupon.type) {
    case 'percentage':    return '';
    case 'fixed':         return 'orange';
    case 'free_shipping': return 'green';
    default: return '';
  }
}

function typeLabel(coupon) {
  switch (coupon.type) {
    case 'percentage':    return 'Percentage Discount';
    case 'fixed':         return 'Fixed Discount';
    case 'free_shipping': return 'Free Shipping';
    default: return coupon.type;
  }
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return res.json();
}

function showToast(msg) {
  let toast = document.getElementById('coupon-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'coupon-toast';
    toast.className = 'coupon-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 2400);
}

// ─── Copy to Clipboard ────────────────────────────────────────────────────────

function copyCode(code, btn) {
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.classList.add('copied');
    showToast(`Code "${code}" copied!`);
    setTimeout(() => {
      btn.innerHTML = '<i class="far fa-copy"></i>';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    showToast('Could not copy — try manually.');
  });
}

// ─── Render Coupon Card ───────────────────────────────────────────────────────

function renderCouponCard(coupon) {
  const expiry     = formatExpiry(coupon);
  const expiring   = expiry.startsWith('Expires in');
  const hClass     = headerClass(coupon);
  const minOrder   = parseFloat(coupon.min_order_amount) > 0
    ? `Min. order ${coupon.currency} ${parseFloat(coupon.min_order_amount).toFixed(2)}`
    : 'No minimum order';
  const maxDisc    = coupon.max_discount_amount
    ? `Up to ${coupon.currency} ${parseFloat(coupon.max_discount_amount).toFixed(2)} off`
    : '';
  const usageInfo  = coupon.usage_limit
    ? `${coupon.usage_limit - coupon.used_count} uses remaining`
    : 'Unlimited uses';

  return `
    <div class="coupon-card" data-id="${coupon.id}" data-code="${coupon.code}">
      <div class="coupon-card-header ${hClass}">
        <div class="coupon-type-badge">${typeLabel(coupon)}</div>
        <div class="coupon-value">${formatDiscount(coupon)}</div>
      </div>
      <div class="coupon-tear"></div>
      <div class="coupon-card-body">
        <div class="coupon-code-row" title="Click to copy code" onclick="window._coupons.copyRow(event, '${coupon.code}')">
          <span class="coupon-code-text">${coupon.code}</span>
          <button class="copy-btn" aria-label="Copy code"><i class="far fa-copy"></i></button>
        </div>
        <div class="coupon-detail"><i class="fas fa-shopping-cart"></i> ${minOrder}</div>
        ${maxDisc ? `<div class="coupon-detail"><i class="fas fa-tag"></i> ${maxDisc}</div>` : ''}
        <div class="coupon-detail"><i class="fas fa-redo"></i> ${usageInfo}</div>
        <div class="coupon-expiry ${expiring ? 'expiring-soon' : ''}">
          <i class="far fa-clock"></i> ${expiry}
        </div>
        <button class="coupon-apply-btn" onclick="window._coupons.applyFromCard('${coupon.code}')">
          <i class="fas fa-check-circle"></i> Apply Coupon
        </button>
      </div>
    </div>
  `;
}

// ─── Load Available Coupons ───────────────────────────────────────────────────

async function loadAvailable(gridEl, spinnerEl) {
  if (spinnerEl) spinnerEl.style.display = 'block';
  try {
    const res = await fetchJSON(`${API_BASE}/available`);
    const coupons = res.success ? res.data : null;
    if (coupons && coupons.length) {
      localStorage.setItem(LS_AVAIL, JSON.stringify(coupons));
      renderGrid(gridEl, coupons);
    } else {
      throw new Error('empty');
    }
  } catch {
    // Fallback to demo data
    const cached = JSON.parse(localStorage.getItem(LS_AVAIL) || 'null');
    const list   = cached || DEMO_COUPONS;
    renderGrid(gridEl, list);
  } finally {
    if (spinnerEl) spinnerEl.style.display = 'none';
  }
}

function renderGrid(gridEl, coupons) {
  if (!gridEl) return;
  if (!coupons || coupons.length === 0) {
    gridEl.innerHTML = `
      <div class="coupon-empty">
        <i class="fas fa-ticket-alt"></i>
        <p>No coupons available at the moment.</p>
      </div>`;
    return;
  }
  gridEl.innerHTML = coupons.map(renderCouponCard).join('');
}

// ─── Coupon Input Widget (Checkout / Cart) ────────────────────────────────────

/**
 * Initialise a coupon input widget.
 * @param {object} opts
 * @param {string} opts.inputId    — ID of the <input> element
 * @param {string} opts.btnId      — ID of the apply button
 * @param {string} opts.feedbackId — ID of the feedback <div>
 * @param {string} opts.discountId — ID of the discount row <div>
 * @param {Function} [opts.onApplied] — callback(discountAmount, couponData)
 */
function initCouponInput({ inputId, btnId, feedbackId, discountId, onApplied } = {}) {
  const input    = document.getElementById(inputId);
  const btn      = document.getElementById(btnId);
  const feedback = document.getElementById(feedbackId);
  const discRow  = document.getElementById(discountId);

  if (!input || !btn) return;

  function getCartTotal() {
    // Try to read from a data-cart-total attribute on the body or a DOM element
    const el = document.querySelector('[data-cart-total]');
    return el ? parseFloat(el.dataset.cartTotal) || 0 : 0;
  }

  function setFeedback(msg, type) {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.className   = `coupon-feedback show ${type}`;
  }

  async function doApply() {
    const code = input.value.trim().toUpperCase();
    if (!code) { setFeedback('Please enter a coupon code.', 'error'); return; }

    btn.disabled   = true;
    btn.textContent = 'Applying…';

    const cartTotal = getCartTotal();

    try {
      const res = await fetchJSON(`${API_BASE}/validate`, {
        method: 'POST',
        body: JSON.stringify({ code, cart_total: cartTotal || 1 }),
      });

      if (res.success) {
        const d = res.data;
        const msg = d.is_free_shipping
          ? '🎉 Free shipping applied!'
          : `🎉 Coupon applied! You save ${d.currency} ${d.discount_amount.toFixed(2)}`;
        setFeedback(msg, 'success');

        if (discRow) {
          discRow.innerHTML = `
            <span><i class="fas fa-tag"></i> Discount (${code})</span>
            <span>- ${d.currency} ${d.discount_amount.toFixed(2)}</span>`;
          discRow.style.display = 'flex';
        }

        localStorage.setItem(LS_APPLIED, JSON.stringify(d));
        if (typeof onApplied === 'function') onApplied(d.discount_amount, d);
      } else {
        setFeedback(res.error || 'Invalid coupon.', 'error');
        if (discRow) discRow.style.display = 'none';
      }
    } catch {
      setFeedback('Could not validate coupon. Please try again.', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Apply';
    }
  }

  btn.addEventListener('click', doApply);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doApply(); });

  // Restore previously applied coupon in session
  const prev = JSON.parse(localStorage.getItem(LS_APPLIED) || 'null');
  if (prev) {
    input.value = prev.code || '';
    const msg = prev.is_free_shipping
      ? `Free shipping applied (${prev.code})`
      : `Discount applied: -${prev.currency} ${prev.discount_amount?.toFixed(2)}`;
    setFeedback(msg, 'success');
    if (discRow) {
      discRow.innerHTML = `
        <span><i class="fas fa-tag"></i> Discount (${prev.code})</span>
        <span>- ${prev.currency} ${(prev.discount_amount || 0).toFixed(2)}</span>`;
      discRow.style.display = 'flex';
    }
  }
}

// ─── Apply from Card (coupon listing page) ────────────────────────────────────

function applyFromCard(code) {
  // Scroll to / focus the coupon input if one exists on the page
  const input = document.querySelector('.coupon-input-field');
  if (input) {
    input.value = code;
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`Code "${code}" pasted into the input!`);
  } else {
    // Copy to clipboard and inform user
    navigator.clipboard.writeText(code).then(() => {
      showToast(`Code "${code}" copied! Paste it at checkout.`);
    });
  }
}

function copyRow(event, code) {
  const btn = event.currentTarget.querySelector('.copy-btn');
  copyCode(code, btn);
}

// ─── Public API ───────────────────────────────────────────────────────────────

window._coupons = {
  loadAvailable,
  renderGrid,
  initCouponInput,
  applyFromCard,
  copyRow,
  copyCode,
  showToast,
  DEMO_COUPONS,
};

// ─── Auto-init on DOM ready ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Coupon listing page
  const grid    = document.getElementById('coupon-grid');
  const spinner = document.getElementById('coupon-spinner');
  if (grid) loadAvailable(grid, spinner);

  // Coupon input widget (checkout / cart)
  if (document.getElementById('coupon-code-input')) {
    initCouponInput({
      inputId:    'coupon-code-input',
      btnId:      'coupon-apply-btn',
      feedbackId: 'coupon-feedback',
      discountId: 'coupon-discount-row',
    });
  }
});
