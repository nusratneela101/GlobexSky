/**
 * Globex Sky — api.js
 * Centralised API client. All backend requests go through this module.
 * Automatically attaches the auth token and handles errors consistently.
 */

const API = (() => {
  function getBaseURL() {
    return (window.GlobexConfig && window.GlobexConfig.API_BASE_URL)
      ? window.GlobexConfig.API_BASE_URL
      : 'http://localhost:5000/api/v1';
  }

  function getToken() {
    try {
      const session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      return session?.token || null;
    } catch {
      return null;
    }
  }

  async function request(method, path, body = null, options = {}) {
    const url = `${getBaseURL()}${path}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body && method !== 'GET') config.body = JSON.stringify(body);

    try {
      const res = await fetch(url, config);
      const data = await res.json();
      if (!res.ok) {
        throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
      }
      return data;
    } catch (err) {
      if (err.status === 401) {
        // Clear stale session
        localStorage.removeItem('globexSession');
        localStorage.removeItem('globexUser');
        if (window.GlobexSky?.updateNavUI) window.GlobexSky.updateNavUI();
      }
      throw err;
    }
  }

  async function upload(path, formData, options = {}) {
    const url = `${getBaseURL()}${path}`;
    const headers = { ...options.headers };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || 'Upload failed'), { status: res.status, data });
    return data;
  }

  return {
    get:    (path, options)       => request('GET',    path, null,  options),
    post:   (path, body, options) => request('POST',   path, body,  options),
    put:    (path, body, options) => request('PUT',    path, body,  options),
    patch:  (path, body, options) => request('PATCH',  path, body,  options),
    delete: (path, options)       => request('DELETE', path, null,  options),
    upload,

    // ─── Auth ──────────────────────────────────────────────────
    auth: {
      login:          (email, password)      => request('POST', '/auth/login',           { email, password }),
      register:       (params) => request('POST', '/auth/register', params),
      logout:         ()                     => request('POST', '/auth/logout'),
      forgotPassword: (email)                => request('POST', '/auth/forgot-password', { email }),
      resetPassword:  (token, password)      => request('POST', '/auth/reset-password',  { token, password }),
      me:             ()                     => request('GET',  '/auth/me'),
    },

    // ─── Products ──────────────────────────────────────────────
    products: {
      list:       (params = {})  => request('GET', `/products?${new URLSearchParams(params)}`),
      search:     (q, params={}) => request('GET', `/products/search?q=${encodeURIComponent(q)}&${new URLSearchParams(params)}`),
      get:        (id)           => request('GET', `/products/${id}`),
      featured:   ()             => request('GET', '/products/featured'),
      trending:   ()             => request('GET', '/products/trending'),
      categories: ()             => request('GET', '/products/categories'),
    },

    // ─── Orders ────────────────────────────────────────────────
    orders: {
      list:   (params = {})  => request('GET',   `/orders?${new URLSearchParams(params)}`),
      get:    (id)           => request('GET',   `/orders/${id}`),
      create: (body)         => request('POST',  '/orders', body),
      cancel: (id)           => request('POST',  `/orders/${id}/cancel`),
      track:  (id)           => request('GET',   `/orders/${id}/tracking`),
    },

    // ─── User ──────────────────────────────────────────────────
    user: {
      getProfile:      ()     => request('GET',  '/users/profile'),
      updateProfile:   (body) => request('PUT',  '/users/profile', body),
      getAddresses:    ()     => request('GET',  '/users/addresses'),
      addAddress:      (body) => request('POST', '/users/addresses', body),
      getNotifications:()     => request('GET',  '/notifications'),
      getUnreadCount:  ()     => request('GET',  '/notifications/unread-count'),
      markAllRead:     ()     => request('PATCH','/notifications/mark-all-read'),
    },

    // ─── Pricing ───────────────────────────────────────────────
    pricing: {
      shippingRates:    ()     => request('GET',  '/pricing/shipping-rates'),
      supplierPlans:    ()     => request('GET',  '/pricing/supplier-plans'),
      inspectionPricing:()     => request('GET',  '/pricing/inspection-pricing'),
      apiPlans:         ()     => request('GET',  '/pricing/api-plans'),
      calculateShipping:(body) => request('POST', '/pricing/calculate/shipping', body),
      calculateCommission:(body) => request('POST', '/pricing/calculate/commission', body),
    },

    // ─── Carry ─────────────────────────────────────────────────
    carry: {
      listRequests: (params = {}) => request('GET',  `/carry/requests?${new URLSearchParams(params)}`),
      getRequest:   (id)          => request('GET',  `/carry/requests/${id}`),
      getRates:     ()            => request('GET',  '/carry/rates'),
      book:         (id, body)    => request('POST', `/carry/requests/${id}/book`, body),
    },

    // ─── Parcels ───────────────────────────────────────────────
    parcels: {
      list:     ()     => request('GET',  '/parcels'),
      create:   (body) => request('POST', '/parcels', body),
      track:    (tn)   => request('GET',  `/parcels/track/${tn}`),
      calculate:(body) => request('POST', '/parcels/calculate', body),
    },

    // ─── CMS ───────────────────────────────────────────────────
    cms: {
      banners:   () => request('GET', '/cms/banners'),
      blog:      () => request('GET', '/cms/blog'),
      blogPost:  (slug) => request('GET', `/cms/blog/${slug}`),
      faqs:      () => request('GET', '/cms/faqs'),
    },

    // ─── Campaigns ─────────────────────────────────────────────
    campaigns: {
      active: () => request('GET', '/campaigns'),
      get:    (id) => request('GET', `/campaigns/${id}`),
    },

    // ─── Analytics ─────────────────────────────────────────────
    analytics: {
      dashboard: () => request('GET', '/analytics/dashboard'),
      sales:     (params = {}) => request('GET', `/analytics/sales?${new URLSearchParams(params)}`),
    },
  };
})();

window.API = API;
