/**
 * GlobexSky - cart.js
 * Shopping cart management: localStorage persistence, DOM rendering,
 * badge updates, and quantity/remove event delegation.
 *
 * Cart item shape:
 * {
 *   id        : string | number   — unique product identifier
 *   name      : string
 *   image     : string            — image URL
 *   price     : number            — unit price
 *   quantity  : number
 *   supplier  : string
 *   minOrder  : number            — minimum order quantity
 * }
 */

const CART_KEY = 'globexCart';

/* ─────────────────────────────────────────────
   STORAGE HELPERS
───────────────────────────────────────────── */

/** Return the current cart array from localStorage. */
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (_) {
    return [];
  }
}

/** Persist the cart array to localStorage. */
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/* ─────────────────────────────────────────────
   CART OPERATIONS
───────────────────────────────────────────── */

/**
 * Add a product to the cart or increase its quantity if already present.
 * @param {{ id, name, image, price, quantity, supplier, minOrder }} product
 */
function addToCart(product) {
  const cart = getCart();
  const existing = cart.find((item) => String(item.id) === String(product.id));

  if (existing) {
    existing.quantity += product.quantity || 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name || 'Unknown Product',
      image: product.image || '',
      price: Number(product.price) || 0,
      quantity: Number(product.quantity) || 1,
      supplier: product.supplier || '',
      minOrder: Number(product.minOrder) || 1,
    });
  }

  saveCart(cart);
  updateCartBadge();

  if (window.GlobexSky?.showToast) {
    window.GlobexSky.showToast(`"${product.name || 'Item'}" added to cart`, 'success');
  }
}

/**
 * Remove an item from the cart by its id.
 * @param {string|number} id
 */
function removeFromCart(id) {
  const cart = getCart().filter((item) => String(item.id) !== String(id));
  saveCart(cart);
  updateCartBadge();
  renderCart();
}

/**
 * Update the quantity of a cart item.
 * If quantity ≤ 0, the item is removed.
 * @param {string|number} id
 * @param {number} quantity
 */
function updateQuantity(id, quantity) {
  const qty = parseInt(quantity, 10);

  if (isNaN(qty) || qty <= 0) {
    removeFromCart(id);
    return;
  }

  const cart = getCart();
  const item = cart.find((i) => String(i.id) === String(id));

  if (item) {
    // Enforce minimum order quantity
    item.quantity = Math.max(qty, item.minOrder || 1);
    saveCart(cart);
    updateCartBadge();
    renderCart();
  }
}

/** Return the sum of (price × quantity) for all cart items. */
function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** Return the total number of items (sum of all quantities) in the cart. */
function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

/** Empty the cart. */
function clearCart() {
  saveCart([]);
  updateCartBadge();
  renderCart();
}

/* ─────────────────────────────────────────────
   BADGE
───────────────────────────────────────────── */

/** Update all cart badge / counter elements in the nav. */
function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('.cart-badge, .cart-count, [data-cart-badge]').forEach((el) => {
    el.textContent = count > 99 ? '99+' : String(count);
    el.classList.toggle('badge-hidden', count === 0);
    el.setAttribute('aria-label', `${count} item${count !== 1 ? 's' : ''} in cart`);
  });
}

/* ─────────────────────────────────────────────
   RENDER CART PAGE
───────────────────────────────────────────── */

/**
 * Render all cart items into the `.cart-items-list` container,
 * and update the order summary totals.
 * Called automatically after any cart mutation.
 */
function renderCart() {
  const list = document.querySelector('.cart-items-list, #cart-items, [data-cart-list]');
  if (!list) return; // Not on the cart page

  const cart = getCart();
  const currency = localStorage.getItem('globexCurrency') || 'USD';
  const symbol = (window.GlobexSky?.CURRENCY_SYMBOLS?.[currency]) || '$';

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p class="cart-empty-text">Your cart is empty.</p>
        <a href="/pages/sourcing/marketplace.html" class="btn btn-primary">
          Continue Shopping
        </a>
      </div>`;
    updateSummary(0, symbol);
    return;
  }

  list.innerHTML = cart
    .map(
      (item) => `
    <div class="cart-item" data-item-id="${item.id}">
      <div class="cart-item-image">
        <img src="${item.image || '/assets/images/placeholder.png'}"
             alt="${escapeHtml(item.name)}"
             loading="lazy"
             onerror="this.src='/assets/images/placeholder.png'">
      </div>
      <div class="cart-item-details">
        <h3 class="cart-item-name">${escapeHtml(item.name)}</h3>
        ${item.supplier ? `<p class="cart-item-supplier">By ${escapeHtml(item.supplier)}</p>` : ''}
        ${item.minOrder > 1 ? `<p class="cart-item-moq">Min. order: ${item.minOrder}</p>` : ''}
        <p class="cart-item-price">${symbol}${item.price.toFixed(2)} / unit</p>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn qty-minus"
                data-id="${item.id}"
                aria-label="Decrease quantity"
                ${item.quantity <= (item.minOrder || 1) ? 'disabled' : ''}>−</button>
        <input  class="qty-input"
                type="number"
                value="${item.quantity}"
                min="${item.minOrder || 1}"
                data-id="${item.id}"
                aria-label="Quantity">
        <button class="qty-btn qty-plus"
                data-id="${item.id}"
                aria-label="Increase quantity">+</button>
      </div>
      <div class="cart-item-subtotal">
        ${symbol}${(item.price * item.quantity).toFixed(2)}
      </div>
      <button class="cart-item-remove"
              data-id="${item.id}"
              aria-label="Remove ${escapeHtml(item.name)} from cart">
        &times;
      </button>
    </div>`
    )
    .join('');

  updateSummary(getCartTotal(), symbol);
}

/** Update order summary section with subtotal and grand total. */
function updateSummary(subtotal, symbol = '$') {
  const subtotalEl = document.querySelector('.cart-subtotal, [data-cart-subtotal]');
  const totalEl = document.querySelector('.cart-total, [data-cart-total]');

  if (subtotalEl) subtotalEl.textContent = `${symbol}${subtotal.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `${symbol}${subtotal.toFixed(2)}`;
}

/* ─────────────────────────────────────────────
   EVENT DELEGATION
───────────────────────────────────────────── */
function initCartEvents() {
  // Quantity and remove button delegation on the cart list
  document.addEventListener('click', (e) => {
    const minusBtn = e.target.closest('.qty-minus');
    const plusBtn = e.target.closest('.qty-plus');
    const removeBtn = e.target.closest('.cart-item-remove');

    if (minusBtn) {
      const id = minusBtn.dataset.id;
      const item = getCart().find((i) => String(i.id) === String(id));
      if (item) updateQuantity(id, item.quantity - 1);
      return;
    }

    if (plusBtn) {
      const id = plusBtn.dataset.id;
      const item = getCart().find((i) => String(i.id) === String(id));
      if (item) updateQuantity(id, item.quantity + 1);
      return;
    }

    if (removeBtn) {
      const id = removeBtn.dataset.id;
      removeFromCart(id);
      return;
    }

    // Clear cart button
    if (e.target.closest('[data-action="clear-cart"]')) {
      if (confirm('Remove all items from your cart?')) clearCart();
    }
  });

  // Direct quantity input
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('qty-input')) {
      const id = e.target.dataset.id;
      updateQuantity(id, e.target.value);
    }
  });

  // "Add to Cart" buttons anywhere on the page
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-action="add-to-cart"]');
    if (!addBtn) return;

    const product = {
      id: addBtn.dataset.productId || Date.now(),
      name: addBtn.dataset.productName || addBtn.closest('.product-card')?.querySelector('.product-name, h3')?.textContent?.trim() || 'Product',
      image: addBtn.dataset.productImage || addBtn.closest('.product-card')?.querySelector('img')?.src || '',
      price: parseFloat(addBtn.dataset.productPrice || '0'),
      quantity: parseInt(addBtn.dataset.productQty || '1', 10),
      supplier: addBtn.dataset.productSupplier || '',
      minOrder: parseInt(addBtn.dataset.productMoq || '1', 10),
    };

    addToCart(product);
  });
}

/* ─────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Load & display badge on every page
  updateCartBadge();

  // Render cart items if we're on the cart page
  renderCart();

  // Wire up event delegation
  initCartEvents();
});

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};
Object.assign(window.GlobexSky, {
  addToCart,
  removeFromCart,
  updateQuantity,
  getCart,
  getCartTotal,
  getCartCount,
  clearCart,
  renderCart,
  updateCartBadge,
});
