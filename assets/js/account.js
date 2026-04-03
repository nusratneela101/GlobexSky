/**
 * Globex Sky - account.js
 * Account section: profile editing, order management, addresses, wishlist,
 * messages, notifications, reviews, disputes, payment methods, settings.
 */

const AccountAPI = {
  get BASE_URL() {
    return window.GLOBEX_CONFIG?.API_BASE_URL || '/api/v1';
  },

  getToken() {
    // Check globexSession object first (set by auth-flow.js)
    try {
      const session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      if (session?.token) return session.token;
    } catch (_) {}
    // Direct token keys
    const direct = localStorage.getItem('globexToken') || localStorage.getItem('auth_token') || localStorage.getItem('token') || sessionStorage.getItem('token');
    if (direct) return direct;
    // Supabase session keys
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const sess = JSON.parse(localStorage.getItem(key) || 'null');
          if (sess?.access_token) return sess.access_token;
        }
      }
    } catch (_) {}
    return null;
  },

  getHeaders(json = true) {
    const token = this.getToken();
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },

  async get(path) {
    const res = await fetch(`${this.BASE_URL}${path}`, { headers: this.getHeaders(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(`${this.BASE_URL}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async put(path, body) {
    const res = await fetch(`${this.BASE_URL}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async patch(path, body) {
    const res = await fetch(`${this.BASE_URL}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async del(path) {
    const res = await fetch(`${this.BASE_URL}${path}`, { method: 'DELETE', headers: this.getHeaders(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   AUTH GUARD
───────────────────────────────────────────── */
function requireAuth() {
  const token = AccountAPI.getToken();
  if (!token) {
    window.location.href = `/pages/auth/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return false;
  }
  return true;
}

/* ─────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────── */
async function initSidebar() {
  const avatarEl = document.querySelector('.account-sidebar-avatar');
  const nameEl   = document.querySelector('.account-sidebar-name');
  const emailEl  = document.querySelector('.account-sidebar-email');
  if (!avatarEl && !nameEl && !emailEl) return;

  // Quick fill from localStorage first
  try {
    const user = JSON.parse(localStorage.getItem('globexUser') || 'null');
    if (user) {
      if (nameEl && user.full_name) nameEl.textContent = user.full_name;
      if (emailEl && user.email)    emailEl.textContent = user.email;
      if (avatarEl && user.full_name) {
        avatarEl.textContent = user.full_name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
      }
    }
  } catch (_) {}

  // Then update from API
  try {
    const data    = await AccountAPI.get('/users/profile');
    const profile = data.data || data;
    if (nameEl && profile.full_name)  nameEl.textContent  = profile.full_name;
    if (emailEl && profile.email)     emailEl.textContent = profile.email;
    if (avatarEl) {
      const initials = (profile.full_name || 'U').split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
      if (profile.avatar_url) {
        avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="${initials}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        avatarEl.textContent = initials;
      }
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────── */
async function initAccountDashboard() {
  const section = document.querySelector('.account-dashboard, [data-account-dashboard]');
  if (!section) return;

  try {
    const data = await AccountAPI.get('/users/profile');
    const d = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-stat="orders"]',    d.totalOrders    ?? '—');
    set('[data-stat="wishlist"]',  d.wishlistCount  ?? '—');
    set('[data-stat="reviews"]',   d.reviewCount    ?? '—');
    set('[data-stat="points"]',    d.loyaltyPoints  ?? '—');

    // Recent orders mini-table
    const tbody = section.querySelector('.recent-orders-table tbody');
    if (tbody && Array.isArray(d.recentOrders)) {
      tbody.innerHTML = d.recentOrders.slice(0, 5).map((o) => `
        <tr>
          <td><a href="/pages/account/order-detail.html?id=${o.id}">#${o.id}</a></td>
          <td>${new Date(o.date).toLocaleDateString()}</td>
          <td>${o.total}</td>
          <td><span class="badge bg-${statusColor(o.status)}">${o.status}</span></td>
        </tr>`).join('');
    }
  } catch (err) {
    console.warn('Dashboard load error:', err.message);
  }
}

function statusColor(status) {
  const map = { pending: 'warning', processing: 'info', shipped: 'primary', delivered: 'success', cancelled: 'danger', refunded: 'secondary' };
  return map[(status || '').toLowerCase()] || 'secondary';
}

/* ─────────────────────────────────────────────
   PROFILE EDIT
───────────────────────────────────────────── */
async function initProfilePage() {
  const form = document.querySelector('#profileForm, [data-profile-form], #personal-form');
  if (!form) return;

  // Load profile from API and populate fields
  try {
    const data    = await AccountAPI.get('/users/profile');
    const profile = data.data || data;

    // Helper: set value if field exists and profile has the key
    const fillField = (selector, val) => {
      const el = form.querySelector(selector);
      if (el && val !== undefined && val !== null) el.value = val;
    };

    // Handle full_name → split into first_name / last_name when separate fields exist
    if (profile.full_name) {
      const firstEl = form.querySelector('[name="first_name"]');
      const lastEl  = form.querySelector('[name="last_name"]');
      const fullEl  = form.querySelector('[name="full_name"]');
      if (firstEl || lastEl) {
        const parts = profile.full_name.trim().split(/\s+/);
        if (firstEl) firstEl.value = parts[0] || '';
        if (lastEl)  lastEl.value  = parts.slice(1).join(' ') || '';
      } else if (fullEl) {
        fullEl.value = profile.full_name;
      }
    }

    fillField('[name="email"]',        profile.email);
    fillField('[name="phone"]',        profile.phone);
    fillField('[name="company_name"]', profile.company_name);
    fillField('[name="language"]',     profile.language);
    fillField('[name="currency"]',     profile.currency);
    fillField('[name="timezone"]',     profile.timezone);

    // Update avatar
    const avatarLarge = document.querySelector('.profile-avatar-large, .account-avatar-large');
    if (avatarLarge) {
      const initials = (profile.full_name || 'U').split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
      if (profile.avatar_url) {
        avatarLarge.innerHTML = `<img src="${profile.avatar_url}" alt="${initials}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        avatarLarge.textContent = initials;
      }
    }
  } catch (_) {
    // Fallback to localStorage
    try {
      const user = JSON.parse(localStorage.getItem('globexUser') || 'null');
      if (user) {
        Object.entries(user).forEach(([key, val]) => {
          const field = form.querySelector(`[name="${key}"]`);
          if (field) field.value = val;
        });
      }
    } catch (_2) {}
  }

  // Avatar upload preview
  const avatarInput   = form.querySelector('[name="avatar"], #avatarInput');
  const avatarPreview = document.querySelector('.avatar-preview, #avatarPreview');
  if (avatarInput && avatarPreview) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { avatarPreview.src = e.target.result; };
        reader.readAsDataURL(file);
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      // Build payload from named fields; combine first_name + last_name into full_name
      const firstEl = form.querySelector('[name="first_name"]');
      const lastEl  = form.querySelector('[name="last_name"]');
      const payload = {};
      if (firstEl || lastEl) {
        payload.full_name = [firstEl?.value?.trim(), lastEl?.value?.trim()].filter(Boolean).join(' ');
      }
      // Skip 'full_name' below since it may already be constructed from first/last name above
      ['phone', 'company_name', 'language', 'currency', 'timezone', 'full_name'].forEach((k) => {
        const el = form.querySelector(`[name="${k}"]`);
        if (el && el.value !== undefined && !payload[k]) payload[k] = el.value;
      });

      const json = await AccountAPI.put('/users/profile', payload);
      if (json.success) {
        const updated = json.data || {};
        const stored  = JSON.parse(localStorage.getItem('globexUser') || '{}');
        localStorage.setItem('globexUser', JSON.stringify({ ...stored, ...updated }));
        if (typeof showToast === 'function') showToast('Profile updated successfully!', 'success');
      } else {
        throw new Error(json.message || 'Update failed');
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

function validateProfileForm(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    field.classList.remove('is-invalid');
    if (!field.value.trim()) { field.classList.add('is-invalid'); valid = false; }
  });
  const emailField = form.querySelector('[name="email"]');
  if (emailField && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
    emailField.classList.add('is-invalid'); valid = false;
  }
  return valid;
}

/* ─────────────────────────────────────────────
   CHANGE PASSWORD
───────────────────────────────────────────── */
function initChangePassword() {
  const form = document.querySelector('#changePasswordForm, [data-change-password], #password-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Support both name="..." and id="current-pass" / id="new-pass" patterns
    const current = (form.querySelector('[name="current_password"]') || form.querySelector('#current-pass'))?.value;
    const newPw   = (form.querySelector('[name="new_password"]')     || form.querySelector('#new-pass'))?.value;
    const confirm = (form.querySelector('[name="confirm_password"]') || form.querySelector('#confirm-pass') || form.querySelectorAll('[type="password"]')[2])?.value;

    if (!current || !newPw || !confirm) {
      if (typeof showToast === 'function') showToast('All fields are required.', 'error'); return;
    }
    if (newPw !== confirm) {
      if (typeof showToast === 'function') showToast('Passwords do not match.', 'error'); return;
    }
    if (newPw.length < 8) {
      if (typeof showToast === 'function') showToast('Password must be at least 8 characters.', 'error'); return;
    }

    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      await AccountAPI.put('/users/change-password', { current_password: current, new_password: newPw });
      if (typeof showToast === 'function') showToast('Password changed successfully!', 'success');
      form.reset();
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Failed to change password.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   ORDERS LIST
───────────────────────────────────────────── */
async function initOrdersList() {
  const container = document.querySelector('.orders-list, [data-orders-list]');
  if (!container) return;

  const statusFilter = document.querySelector('#orderStatusFilter, [data-order-status-filter]');
  const searchInput  = document.querySelector('#orderSearch, [data-order-search]');

  let orders = [];

  const render = (list) => {
    if (!list.length) {
      container.innerHTML = '<p class="text-center text-muted py-4">No orders found.</p>';
      return;
    }
    container.innerHTML = list.map((o) => `
      <div class="order-card card mb-3">
        <div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Order #${o.id}</strong>
            <span class="text-muted ms-2">${new Date(o.created_at || o.date).toLocaleDateString()}</span>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="badge bg-${statusColor(o.status)}">${o.status}</span>
            <strong>${o.currency || '$'}${parseFloat(o.total || 0).toFixed(2)}</strong>
            <a href="/pages/account/order-detail.html?id=${o.id}" class="btn btn-sm btn-outline-primary">View</a>
            ${o.status === 'pending' ? `<button class="btn btn-sm btn-outline-danger" data-cancel-order="${o.id}">Cancel</button>` : ''}
          </div>
        </div>
      </div>`).join('');

    // Cancel buttons
    container.querySelectorAll('[data-cancel-order]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to cancel this order?')) return;
        try {
          await AccountAPI.post(`/orders/${btn.dataset.cancelOrder}/cancel`, {});
          if (typeof showToast === 'function') showToast('Order cancelled.', 'success');
          loadOrders();
        } catch (err) {
          if (typeof showToast === 'function') showToast(err.message || 'Failed to cancel order.', 'error');
        }
      });
    });
  };

  const applyFilters = () => {
    let list = [...orders];
    const status = statusFilter?.value;
    const query  = searchInput?.value.trim().toLowerCase();
    if (status && status !== 'all') list = list.filter((o) => o.status === status);
    if (query) list = list.filter((o) => String(o.id).includes(query) || (o.product_name || '').toLowerCase().includes(query));
    render(list);
  };

  const loadOrders = async () => {
    try {
      container.innerHTML = '<p class="text-center text-muted py-4">Loading orders…</p>';
      const data = await AccountAPI.get('/orders');
      orders = data.data || data.orders || data || [];
    } catch (_) {
      orders = [];
    }
    applyFilters();
  };

  statusFilter?.addEventListener('change', applyFilters);
  searchInput?.addEventListener('input', applyFilters);
  await loadOrders();
}

/* ─────────────────────────────────────────────
   ORDER DETAIL
───────────────────────────────────────────── */
async function initOrderDetail() {
  const section = document.querySelector('.order-detail, [data-order-detail]');
  if (!section) return;

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('id');
  if (!orderId) return;

  try {
    const data  = await AccountAPI.get(`/orders/${orderId}`);
    const order = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-order-id]',     `#${order.id}`);
    set('[data-order-status]', order.status);
    set('[data-order-date]',   new Date(order.created_at || order.date).toLocaleString());
    set('[data-order-total]',  `${order.currency || '$'}${parseFloat(order.total || 0).toFixed(2)}`);

    const itemsContainer = section.querySelector('.order-items');
    if (itemsContainer && Array.isArray(order.items)) {
      itemsContainer.innerHTML = order.items.map((item) => `
        <div class="d-flex align-items-center gap-3 mb-3 border-bottom pb-3">
          <img src="${item.image || '/assets/images/placeholder.png'}" alt="${item.name}" width="64" height="64" style="object-fit:cover;border-radius:4px">
          <div class="flex-grow-1">
            <div class="fw-bold">${item.name}</div>
            <div class="text-muted small">Qty: ${item.quantity} × ${order.currency || '$'}${parseFloat(item.price || 0).toFixed(2)}</div>
          </div>
          <div class="fw-bold">${order.currency || '$'}${(item.quantity * item.price).toFixed(2)}</div>
        </div>`).join('');
    }
  } catch (err) {
    section.innerHTML = `<div class="alert alert-danger">Failed to load order: ${err.message}</div>`;
  }
}

/* ─────────────────────────────────────────────
   ADDRESSES
───────────────────────────────────────────── */
async function initAddresses() {
  const container = document.querySelector('.addresses-list, [data-addresses-list]');
  const addForm   = document.querySelector('#addAddressForm, [data-add-address-form]');
  if (!container) return;

  const loadAddresses = async () => {
    try {
      const data = await AccountAPI.get('/addresses');
      const addresses = data.data || data || [];
      container.innerHTML = addresses.length
        ? addresses.map((a) => `
          <div class="col-md-6">
            <div class="card address-card mb-3 ${a.is_default ? 'border-primary' : ''}">
              <div class="card-body">
                <div class="d-flex justify-content-between">
                  <h6 class="card-title">${a.label || (a.is_default ? 'Default Address' : 'Address')}</h6>
                  ${a.is_default ? '<span class="badge bg-primary">Default</span>' : ''}
                </div>
                <p class="card-text small text-muted">${[a.line1, a.line2, a.city, a.state, a.country, a.postal_code].filter(Boolean).join(', ')}</p>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-secondary" data-edit-address="${a.id}">Edit</button>
                  <button class="btn btn-sm btn-outline-danger" data-delete-address="${a.id}">Delete</button>
                  ${!a.is_default ? `<button class="btn btn-sm btn-outline-primary" data-default-address="${a.id}">Set Default</button>` : ''}
                </div>
              </div>
            </div>
          </div>`).join('')
        : '<p class="text-muted">No saved addresses.</p>';
    } catch (_) {
      container.innerHTML = '<p class="text-danger">Failed to load addresses.</p>';
    }
  };

  container.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-delete-address]');
    if (delBtn && confirm('Delete this address?')) {
      try {
        await AccountAPI.del(`/addresses/${delBtn.dataset.deleteAddress}`);
        if (typeof showToast === 'function') showToast('Address deleted.', 'success');
        loadAddresses();
      } catch (_) {
        if (typeof showToast === 'function') showToast('Failed to delete address.', 'error');
      }
    }
    const defBtn = e.target.closest('[data-default-address]');
    if (defBtn) {
      try {
        await AccountAPI.put(`/addresses/${defBtn.dataset.defaultAddress}/default`, {});
        if (typeof showToast === 'function') showToast('Default address updated.', 'success');
        loadAddresses();
      } catch (_) {
        if (typeof showToast === 'function') showToast('Failed to update default address.', 'error');
      }
    }
  });

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(addForm));
      try {
        await AccountAPI.post('/addresses', data);
        if (typeof showToast === 'function') showToast('Address added!', 'success');
        addForm.reset();
        // Close modal if present
        const modal = addForm.closest('.modal');
        if (modal && typeof bootstrap !== 'undefined') bootstrap.Modal.getInstance(modal)?.hide();
        loadAddresses();
      } catch (_) {
        if (typeof showToast === 'function') showToast('Failed to add address.', 'error');
      }
    });
  }

  await loadAddresses();
}

/* ─────────────────────────────────────────────
   WISHLIST
───────────────────────────────────────────── */
async function initWishlistPage() {
  const container = document.querySelector('.wishlist-container, [data-wishlist-page]');
  if (!container) return;

  const loadWishlist = async () => {
    try {
      const data = await AccountAPI.get('/wishlist');
      const items = data.data || data || [];
      container.innerHTML = items.length
        ? `<div class="row g-3">` + items.map((item) => `
          <div class="col-sm-6 col-md-4 col-lg-3">
            <div class="card product-card h-100">
              <img src="${item.image || '/assets/images/placeholder.png'}" class="card-img-top" alt="${item.name}" style="height:180px;object-fit:cover">
              <div class="card-body d-flex flex-column">
                <h6 class="card-title">${item.name}</h6>
                <p class="fw-bold text-primary">${item.currency || '$'}${parseFloat(item.price || 0).toFixed(2)}</p>
                <div class="mt-auto d-flex gap-2">
                  <button class="btn btn-sm btn-primary flex-grow-1" data-add-to-cart="${item.id}"
                    data-product-id="${item.id}" data-product-name="${item.name}"
                    data-product-price="${item.price}" data-product-image="${item.image || ''}">
                    Add to Cart
                  </button>
                  <button class="btn btn-sm btn-outline-danger" data-remove-wishlist="${item.id}">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>`).join('') + `</div>`
        : '<p class="text-center text-muted py-5">Your wishlist is empty.</p>';
    } catch (_) {
      container.innerHTML = '<p class="text-danger">Failed to load wishlist.</p>';
    }
  };

  container.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-remove-wishlist]');
    if (removeBtn) {
      try {
        await AccountAPI.del(`/wishlist/${removeBtn.dataset.removeWishlist}`);
        if (typeof showToast === 'function') showToast('Removed from wishlist.', 'info');
        loadWishlist();
      } catch (_) {
        if (typeof showToast === 'function') showToast('Failed to remove item.', 'error');
      }
    }

    const cartBtn = e.target.closest('[data-add-to-cart]');
    if (cartBtn) {
      const p = cartBtn.dataset;
      if (typeof addToCart === 'function') {
        addToCart({ id: p.productId, name: p.productName, price: parseFloat(p.productPrice), image: p.productImage, quantity: 1 });
        if (typeof showToast === 'function') showToast(`${p.productName} added to cart!`, 'success');
      }
    }
  });

  await loadWishlist();
}

/* ─────────────────────────────────────────────
   MESSAGES
───────────────────────────────────────────── */
async function initMessages() {
  const inbox     = document.querySelector('.messages-inbox, [data-messages-inbox]');
  const composeForm = document.querySelector('#composeForm, [data-compose-form]');
  if (!inbox && !composeForm) return;

  if (inbox) {
    try {
      const data     = await AccountAPI.get('/messages');
      const messages = data.data || data || [];
      inbox.innerHTML = messages.length
        ? messages.map((m) => `
          <div class="message-item d-flex gap-3 p-3 border-bottom ${m.read ? '' : 'fw-bold bg-light'}" style="cursor:pointer" data-message-id="${m.id}">
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between">
                <span>${m.from || m.sender || 'Unknown'}</span>
                <small class="text-muted">${new Date(m.created_at || m.date).toLocaleDateString()}</small>
              </div>
              <div class="text-truncate small">${m.subject || '(No subject)'}</div>
            </div>
          </div>`).join('')
        : '<p class="text-center text-muted py-4">No messages.</p>';

      inbox.querySelectorAll('[data-message-id]').forEach((item) => {
        item.addEventListener('click', async () => {
          const id = item.dataset.messageId;
          item.classList.remove('fw-bold', 'bg-light');
          try { await AccountAPI.put(`/messages/${id}/read`, {}); } catch (_) {}
          window.location.href = `/pages/account/messages.html?id=${id}`;
        });
      });
    } catch (_) {
      inbox.innerHTML = '<p class="text-danger">Failed to load messages.</p>';
    }
  }

  if (composeForm) {
    composeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(composeForm));
      try {
        await AccountAPI.post('/messages', data);
        if (typeof showToast === 'function') showToast('Message sent!', 'success');
        composeForm.reset();
      } catch (_) {
        if (typeof showToast === 'function') showToast('Failed to send message.', 'error');
      }
    });
  }
}

/* ─────────────────────────────────────────────
   NOTIFICATIONS
───────────────────────────────────────────── */
async function initNotificationsPage() {
  const container = document.querySelector('.notifications-list, [data-notifications-list]');
  if (!container) return;

  const loadNotifications = async () => {
    try {
      const data = await AccountAPI.get('/notifications');
      const items = data.data || data || [];
      container.innerHTML = items.length
        ? items.map((n) => `
          <div class="notification-item d-flex gap-3 p-3 border-bottom ${n.read ? '' : 'bg-light'}" data-notification-id="${n.id}">
            <i class="fas fa-${notificationIcon(n.type)} text-primary mt-1"></i>
            <div class="flex-grow-1">
              <div>${n.message || n.title}</div>
              <small class="text-muted">${new Date(n.created_at || n.date).toLocaleString()}</small>
            </div>
            ${!n.read ? `<button class="btn btn-sm btn-link text-muted" data-mark-read="${n.id}">Mark read</button>` : ''}
          </div>`).join('')
        : '<p class="text-center text-muted py-4">No notifications.</p>';

      container.querySelectorAll('[data-mark-read]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await AccountAPI.patch(`/notifications/${btn.dataset.markRead}/read`, {});
            loadNotifications();
          } catch (_) {}
        });
      });
    } catch (_) {
      container.innerHTML = '<p class="text-danger">Failed to load notifications.</p>';
    }
  };

  // Mark all read button
  document.querySelector('[data-mark-all-read]')?.addEventListener('click', async () => {
    try {
      await AccountAPI.patch('/notifications/mark-all-read', {});
      loadNotifications();
    } catch (_) {}
  });

  await loadNotifications();
}

function notificationIcon(type) {
  const map = { order: 'box', message: 'envelope', payment: 'credit-card', promo: 'tag', system: 'bell' };
  return map[type] || 'bell';
}

/* ─────────────────────────────────────────────
   ACCOUNT SETTINGS
───────────────────────────────────────────── */
function initAccountSettings() {
  const form = document.querySelector('#accountSettingsForm, [data-account-settings]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    // Checkboxes not included in FormData when unchecked - set explicitly
    form.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      data[cb.name] = cb.checked;
    });

    const btn = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      await AccountAPI.put('/users/settings', data);
      if (typeof showToast === 'function') showToast('Settings saved!', 'success');
    } catch (_) {
      if (typeof showToast === 'function') showToast('Failed to save settings.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });

  // Delete account
  document.querySelector('[data-delete-account]')?.addEventListener('click', () => {
    if (!confirm('Are you sure? This action is irreversible and will permanently delete your account.')) return;
    const confirmText = prompt('Type "DELETE" to confirm:');
    if (confirmText !== 'DELETE') { if (typeof showToast === 'function') showToast('Account deletion cancelled.', 'info'); return; }
    AccountAPI.del('/account').then(() => {
      localStorage.clear();
      window.location.href = '/';
    }).catch(() => {
      if (typeof showToast === 'function') showToast('Failed to delete account.', 'error');
    });
  });
}

/* ─────────────────────────────────────────────
   PAYMENT METHODS
───────────────────────────────────────────── */
async function initPaymentMethods() {
  const container = document.querySelector('.payment-methods-list, [data-payment-methods]');
  const addForm   = document.querySelector('#addPaymentForm, [data-add-payment-form]');
  if (!container) return;

  const load = async () => {
    try {
      const data    = await AccountAPI.get('/payment-methods');
      const methods = data.data || data || [];
      container.innerHTML = methods.length
        ? methods.map((m) => `
          <div class="card mb-3">
            <div class="card-body d-flex justify-content-between align-items-center">
              <div>
                <i class="fab fa-${cardIcon(m.brand)} me-2 fs-4"></i>
                <span>•••• ${m.last4 || '****'}</span>
                <span class="text-muted ms-2">Expires ${m.exp_month}/${m.exp_year}</span>
                ${m.is_default ? '<span class="badge bg-primary ms-2">Default</span>' : ''}
              </div>
              <div class="d-flex gap-2">
                ${!m.is_default ? `<button class="btn btn-sm btn-outline-primary" data-default-card="${m.id}">Set Default</button>` : ''}
                <button class="btn btn-sm btn-outline-danger" data-remove-card="${m.id}">Remove</button>
              </div>
            </div>
          </div>`).join('')
        : '<p class="text-muted">No payment methods saved.</p>';
    } catch (_) {}
  };

  container.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-remove-card]');
    if (removeBtn && confirm('Remove this payment method?')) {
      try {
        await AccountAPI.del(`/payment-methods/${removeBtn.dataset.removeCard}`);
        load();
      } catch (_) { if (typeof showToast === 'function') showToast('Failed to remove card.', 'error'); }
    }
  });

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await AccountAPI.post('/payment-methods', Object.fromEntries(new FormData(addForm)));
        if (typeof showToast === 'function') showToast('Payment method added!', 'success');
        addForm.reset();
        load();
      } catch (_) { if (typeof showToast === 'function') showToast('Failed to add payment method.', 'error'); }
    });
  }

  await load();
}

function cardIcon(brand) {
  const map = { visa: 'cc-visa', mastercard: 'cc-mastercard', amex: 'cc-amex', discover: 'cc-discover' };
  return map[(brand || '').toLowerCase()] || 'credit-card';
}

/* ─────────────────────────────────────────────
   RECENTLY VIEWED
───────────────────────────────────────────── */
function initRecentlyViewed() {
  const container = document.querySelector('.recently-viewed-grid, [data-recently-viewed]');
  if (!container) return;

  const items = JSON.parse(localStorage.getItem('globexRecentlyViewed') || '[]');
  if (!items.length) {
    container.innerHTML = '<p class="text-muted text-center py-4">No recently viewed products.</p>';
    return;
  }

  container.innerHTML = `<div class="row g-3">` + items.slice(0, 20).map((p) => `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="card h-100">
        <img src="${p.image || '/assets/images/placeholder.png'}" class="card-img-top" alt="${p.name}" style="height:150px;object-fit:cover">
        <div class="card-body">
          <h6 class="card-title text-truncate">${p.name}</h6>
          <a href="${p.url || '#'}" class="btn btn-sm btn-outline-primary w-100 mt-auto">View Product</a>
        </div>
      </div>
    </div>`).join('') + `</div>`;
}

/** Call this on product detail pages to record a view. */
function recordProductView(product) {
  const key  = 'globexRecentlyViewed';
  let items  = JSON.parse(localStorage.getItem(key) || '[]');
  items      = items.filter((p) => String(p.id) !== String(product.id));
  items.unshift(product);
  if (items.length > 50) items = items.slice(0, 50);
  localStorage.setItem(key, JSON.stringify(items));
}

window.recordProductView = recordProductView;

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  initSidebar();
  initAccountDashboard();
  initProfilePage();
  initChangePassword();
  initOrdersList();
  initOrderDetail();
  initAddresses();
  initWishlistPage();
  initMessages();
  initNotificationsPage();
  initAccountSettings();
  initPaymentMethods();
  initRecentlyViewed();
});
