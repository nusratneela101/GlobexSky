/**
 * Globex Sky - checkout.js
 * Multi-step checkout flow: address, shipping, payment, review, place order.
 */

const API_BASE = '/api/v1';
const STEPS = ['address', 'shipping', 'payment', 'review'];

let checkoutState = {
  currentStep: 0,
  shippingAddress: null,
  billingAddress: null,
  billingSameAsShipping: true,
  shippingMethod: null,
  shippingCost: 0,
  paymentMethod: null,
  couponCode: null,
  couponDiscount: 0,
  cart: null,
};

/* ──────────────────────────────────────────────
   INIT
────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadCart();
  await loadAddresses();
  renderStep();
  initEvents();
});

/* ──────────────────────────────────────────────
   DATA LOADING
────────────────────────────────────────────── */
async function loadCart() {
  try {
    const token = localStorage.getItem('globexToken');
    if (!token) {
      window.location.href = '/pages/auth/login.html?redirect=/pages/sourcing/checkout.html';
      return;
    }
    const res = await fetch(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) {
      checkoutState.cart = json.data;
      renderCartSummary();
    }
  } catch (err) {
    console.error('Failed to load cart:', err);
  }
}

async function loadAddresses() {
  try {
    const token = localStorage.getItem('globexToken');
    const res = await fetch(`${API_BASE}/addresses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) {
      renderAddressList(json.data);
    }
  } catch (err) {
    console.error('Failed to load addresses:', err);
  }
}

async function loadShippingRates() {
  if (!checkoutState.shippingAddress) return;
  try {
    const token = localStorage.getItem('globexToken');
    const subtotal = getSubtotal();
    const res = await fetch(`${API_BASE}/checkout/shipping-rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        country: checkoutState.shippingAddress.country,
        state: checkoutState.shippingAddress.state,
        postal_code: checkoutState.shippingAddress.postal_code,
        subtotal,
      }),
    });
    const json = await res.json();
    if (json.success) renderShippingRates(json.data);
  } catch (err) {
    console.error('Failed to load shipping rates:', err);
  }
}

/* ──────────────────────────────────────────────
   STEP NAVIGATION
────────────────────────────────────────────── */
function renderStep() {
  document.querySelectorAll('.checkout-step').forEach((el, idx) => {
    el.classList.toggle('active', idx === checkoutState.currentStep);
    el.classList.toggle('completed', idx < checkoutState.currentStep);
  });

  document.querySelectorAll('.step-panel').forEach((el, idx) => {
    el.style.display = idx === checkoutState.currentStep ? 'block' : 'none';
  });

  updateStepIndicators();

  if (checkoutState.currentStep === 1) loadShippingRates();
  if (checkoutState.currentStep === 3) renderOrderReview();
}

function updateStepIndicators() {
  document.querySelectorAll('.step-indicator').forEach((el, idx) => {
    el.classList.remove('active', 'completed');
    if (idx === checkoutState.currentStep) el.classList.add('active');
    else if (idx < checkoutState.currentStep) el.classList.add('completed');
  });
}

function nextStep() {
  if (!validateCurrentStep()) return;
  if (checkoutState.currentStep < STEPS.length - 1) {
    checkoutState.currentStep++;
    renderStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function prevStep() {
  if (checkoutState.currentStep > 0) {
    checkoutState.currentStep--;
    renderStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function validateCurrentStep() {
  switch (checkoutState.currentStep) {
    case 0:
      if (!checkoutState.shippingAddress) {
        showError('Please select or add a shipping address.');
        return false;
      }
      return true;
    case 1:
      if (!checkoutState.shippingMethod) {
        showError('Please select a shipping method.');
        return false;
      }
      return true;
    case 2:
      if (!checkoutState.paymentMethod) {
        showError('Please select a payment method.');
        return false;
      }
      return true;
    default:
      return true;
  }
}

/* ──────────────────────────────────────────────
   RENDERING
────────────────────────────────────────────── */
function renderAddressList(addresses) {
  const container = document.getElementById('address-list');
  if (!container) return;

  if (!addresses || addresses.length === 0) {
    container.innerHTML = '<p class="text-muted">No saved addresses. Add one below.</p>';
    return;
  }

  container.innerHTML = addresses.map((addr) => `
    <label class="address-option ${checkoutState.shippingAddress?.id === addr.id ? 'selected' : ''}">
      <input type="radio" name="shipping_address" value="${addr.id}"
             ${checkoutState.shippingAddress?.id === addr.id ? 'checked' : ''}>
      <div class="address-option-content">
        <div class="address-label-badge">${escapeHtml(addr.label)}</div>
        <strong>${escapeHtml(addr.full_name)}</strong>
        <div>${escapeHtml(addr.address_line1)}${addr.address_line2 ? ', ' + escapeHtml(addr.address_line2) : ''}</div>
        <div>${escapeHtml(addr.city)}, ${addr.state ? escapeHtml(addr.state) + ', ' : ''}${escapeHtml(addr.postal_code)}</div>
        <div>${escapeHtml(addr.country)}</div>
        ${addr.phone ? `<div>${escapeHtml(addr.phone)}</div>` : ''}
        ${addr.is_default_shipping ? '<span class="default-badge">Default</span>' : ''}
      </div>
    </label>
  `).join('');

  // Pre-select default shipping address
  if (!checkoutState.shippingAddress) {
    const defaultAddr = addresses.find((a) => a.is_default_shipping) || addresses[0];
    if (defaultAddr) selectShippingAddress(defaultAddr);
  }
}

function selectShippingAddress(addr) {
  checkoutState.shippingAddress = addr;
  if (checkoutState.billingSameAsShipping) {
    checkoutState.billingAddress = addr;
  }
  document.querySelectorAll('.address-option').forEach((el) => {
    const radio = el.querySelector('input[type="radio"]');
    el.classList.toggle('selected', radio?.value === addr.id);
  });
}

function renderShippingRates(rates) {
  const container = document.getElementById('shipping-rates');
  if (!container) return;

  container.innerHTML = rates.map((rate) => `
    <label class="shipping-option ${checkoutState.shippingMethod?.id === rate.id ? 'selected' : ''}">
      <input type="radio" name="shipping_method" value="${rate.id}"
             ${checkoutState.shippingMethod?.id === rate.id ? 'checked' : ''}>
      <div class="shipping-option-content">
        <div class="shipping-option-header">
          <span class="shipping-name">${escapeHtml(rate.name)}</span>
          <span class="shipping-price">${rate.price === 0 ? '<span class="free-badge">FREE</span>' : '$' + rate.price.toFixed(2)}</span>
        </div>
        <div class="shipping-carrier">${escapeHtml(rate.carrier)} · ${escapeHtml(rate.estimated_days)}</div>
        <div class="shipping-description">${escapeHtml(rate.description)}</div>
      </div>
    </label>
  `).join('');
}

function renderCartSummary() {
  const cart = checkoutState.cart;
  if (!cart) return;

  const summaryEl = document.getElementById('order-summary-items');
  if (summaryEl) {
    summaryEl.innerHTML = (cart.items || []).map((item) => {
      const name = item.product?.title || 'Product';
      const price = (item.unit_price * item.quantity).toFixed(2);
      return `<div class="summary-item">
        <span class="summary-item-name">${escapeHtml(name)} × ${item.quantity}</span>
        <span class="summary-item-price">$${price}</span>
      </div>`;
    }).join('');
  }

  updateOrderTotals();
}

function renderOrderReview() {
  const shippingEl = document.getElementById('review-shipping-address');
  const paymentEl = document.getElementById('review-payment');
  const methodEl = document.getElementById('review-shipping-method');

  if (shippingEl && checkoutState.shippingAddress) {
    const a = checkoutState.shippingAddress;
    shippingEl.innerHTML = `
      <strong>${escapeHtml(a.full_name)}</strong><br>
      ${escapeHtml(a.address_line1)}${a.address_line2 ? '<br>' + escapeHtml(a.address_line2) : ''}<br>
      ${escapeHtml(a.city)}, ${a.state ? escapeHtml(a.state) + ', ' : ''}${escapeHtml(a.postal_code)}<br>
      ${escapeHtml(a.country)}
    `;
  }

  if (paymentEl && checkoutState.paymentMethod) {
    const methods = {
      credit_card:  '💳 Credit/Debit Card',
      paypal:       '🅿️ PayPal',
      bkash:        '📱 bKash (Mobile Banking)',
      nagad:        '📱 Nagad (Mobile Banking)',
      bank_transfer: '🏦 Bank Transfer',
      escrow:       '🛡️ Escrow / Trade Assurance',
      cod:          '💵 Cash on Delivery',
    };
    paymentEl.textContent = methods[checkoutState.paymentMethod] || checkoutState.paymentMethod;
  }

  if (methodEl && checkoutState.shippingMethod) {
    methodEl.textContent = checkoutState.shippingMethod.name || checkoutState.shippingMethod.id;
  }

  updateOrderTotals();
}

function updateOrderTotals() {
  const subtotal = getSubtotal();
  const tax = subtotal * 0.08;
  const total = subtotal + checkoutState.shippingCost + tax - checkoutState.couponDiscount;

  setElText('#summary-subtotal', `$${subtotal.toFixed(2)}`);
  setElText('#summary-shipping', checkoutState.shippingCost === 0 ? 'FREE' : `$${checkoutState.shippingCost.toFixed(2)}`);
  setElText('#summary-tax', `$${tax.toFixed(2)}`);
  setElText('#summary-discount', checkoutState.couponDiscount > 0 ? `-$${checkoutState.couponDiscount.toFixed(2)}` : '-');
  setElText('#summary-total', `$${total.toFixed(2)}`);
}

/* ──────────────────────────────────────────────
   ORDER PLACEMENT
────────────────────────────────────────────── */
async function placeOrder() {
  const btn = document.getElementById('place-order-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

  try {
    const token = localStorage.getItem('globexToken');
    const res = await fetch(`${API_BASE}/checkout/place-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shipping_address_id: checkoutState.shippingAddress?.id,
        billing_address_id: checkoutState.billingAddress?.id,
        shipping_method: checkoutState.shippingMethod?.id,
        shipping_cost: checkoutState.shippingCost,
        payment_method: checkoutState.paymentMethod,
        coupon_code: checkoutState.couponCode,
      }),
    });
    const json = await res.json();
    if (json.success) {
      window.location.href = `/pages/sourcing/order-confirmation.html?order=${json.data.id}`;
    } else {
      showError(json.error || 'Failed to place order. Please try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }
    }
  } catch (err) {
    console.error(err);
    showError('Network error. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }
  }
}

/* ──────────────────────────────────────────────
   COUPON
────────────────────────────────────────────── */
async function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const code = input?.value?.trim();
  if (!code) return;

  try {
    const token = localStorage.getItem('globexToken');
    const res = await fetch(`${API_BASE}/cart/apply-coupon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, subtotal: getSubtotal() }),
    });
    const json = await res.json();
    if (json.success) {
      checkoutState.couponCode = json.data.code;
      checkoutState.couponDiscount = json.data.discount_amount;
      showCouponSuccess(`Coupon applied! You save $${json.data.discount_amount.toFixed(2)}`);
      updateOrderTotals();
    } else {
      showCouponError(json.error || 'Invalid coupon code.');
    }
  } catch (err) {
    showCouponError('Failed to apply coupon.');
  }
}

/* ──────────────────────────────────────────────
   ADDRESS FORM
────────────────────────────────────────────── */
async function saveNewAddress(formData) {
  try {
    const token = localStorage.getItem('globexToken');
    const res = await fetch(`${API_BASE}/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });
    const json = await res.json();
    if (json.success) {
      await loadAddresses();
      selectShippingAddress(json.data);
      closeAddressModal();
    } else {
      showError(json.error || 'Failed to save address.');
    }
  } catch (err) {
    showError('Failed to save address.');
  }
}

/* ──────────────────────────────────────────────
   EVENTS
────────────────────────────────────────────── */
function initEvents() {
  // Step navigation buttons
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="next-step"]')) nextStep();
    if (e.target.closest('[data-action="prev-step"]')) prevStep();
    if (e.target.closest('[data-action="place-order"]')) placeOrder();
    if (e.target.closest('[data-action="apply-coupon"]')) applyCoupon();

    // Address selection
    const addrOption = e.target.closest('.address-option');
    if (addrOption) {
      const radio = addrOption.querySelector('input[type="radio"]');
      if (radio) {
        const addrId = radio.value;
        fetch(`${API_BASE}/addresses/${addrId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('globexToken')}` },
        })
          .then((r) => r.json())
          .then((json) => { if (json.success) selectShippingAddress(json.data); })
          .catch((err) => {
            console.error('Failed to load address:', err);
            showError('Failed to load address details. Please try again.');
          });
      }
    }

    // Shipping method selection
    const shippingOption = e.target.closest('.shipping-option');
    if (shippingOption) {
      const radio = shippingOption.querySelector('input[type="radio"]');
      if (radio) {
        const rates = document.querySelectorAll('.shipping-option');
        rates.forEach((el) => el.classList.remove('selected'));
        shippingOption.classList.add('selected');

        const priceEl = shippingOption.querySelector('.shipping-price');
        const nameEl = shippingOption.querySelector('.shipping-name');
        const priceText = priceEl?.textContent || '0';
        const price = priceText.includes('FREE') ? 0 : parseFloat(priceText.replace('$', '')) || 0;
        checkoutState.shippingMethod = { id: radio.value, name: nameEl?.textContent || radio.value };
        checkoutState.shippingCost = price;
        updateOrderTotals();
      }
    }

    // Payment method selection
    const paymentOption = e.target.closest('.payment-option');
    if (paymentOption) {
      document.querySelectorAll('.payment-option').forEach((el) => el.classList.remove('selected'));
      paymentOption.classList.add('selected');
      checkoutState.paymentMethod = paymentOption.dataset.method;
    }
  });

  // Billing same as shipping toggle
  const billingSameChk = document.getElementById('billing-same');
  if (billingSameChk) {
    billingSameChk.addEventListener('change', () => {
      checkoutState.billingSameAsShipping = billingSameChk.checked;
      const billingSection = document.getElementById('billing-address-section');
      if (billingSection) billingSection.style.display = billingSameChk.checked ? 'none' : 'block';
      if (billingSameChk.checked) checkoutState.billingAddress = checkoutState.shippingAddress;
    });
  }

  // Add address form submission
  const addrForm = document.getElementById('new-address-form');
  if (addrForm) {
    addrForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addrForm);
      const data = Object.fromEntries(fd.entries());
      saveNewAddress(data);
    });
  }

  // Coupon enter key
  const couponInput = document.getElementById('coupon-input');
  if (couponInput) {
    couponInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyCoupon();
    });
  }
}

/* ──────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────── */
function getSubtotal() {
  const items = checkoutState.cart?.items || [];
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
}

function setElText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showError(msg) {
  const el = document.getElementById('checkout-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  else alert(msg);
}

function showCouponSuccess(msg) {
  const el = document.getElementById('coupon-message');
  if (el) { el.textContent = msg; el.className = 'coupon-message success'; el.style.display = 'block'; }
}

function showCouponError(msg) {
  const el = document.getElementById('coupon-message');
  if (el) { el.textContent = msg; el.className = 'coupon-message error'; el.style.display = 'block'; }
}

function closeAddressModal() {
  const modal = document.getElementById('address-modal');
  if (modal) modal.style.display = 'none';
}

/* ──────────────────────────────────────────────
   EXPORTS
────────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};
Object.assign(window.GlobexSky, { nextStep, prevStep, placeOrder, applyCoupon });
