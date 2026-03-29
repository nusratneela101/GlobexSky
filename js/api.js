/**
 * js/api.js — Shared API helper for all GlobexSky pages.
 *
 * This file provides the canonical API_BASE constant and helper functions
 * (apiGet, apiPost, apiPut, apiDelete) used by all frontend pages.
 *
 * The full API client is located at assets/js/api.js (the `API` object).
 * Include assets/js/api.js in your HTML to use API.get(), API.post(), etc.
 * This file provides the simpler named-function interface described in the
 * project requirements.
 */

const API_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL)
  ? window.GlobexConfig.API_BASE_URL
  : (window.API_BASE_URL || window.location.origin + '/api/v1');

/**
 * Get the stored auth token.
 * @returns {string|null}
 */
function getToken() {
  try {
    const session = JSON.parse(localStorage.getItem('globexSession') || 'null');
    return session?.token || localStorage.getItem('token') || null;
  } catch {
    return null;
  }
}

/**
 * Build common request headers.
 * @returns {object}
 */
function buildHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Perform a GET request.
 * @param {string} endpoint - Path relative to /api/v1, e.g. '/products'
 * @returns {Promise<object>}
 */
async function apiGet(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

/**
 * Perform a POST request.
 * @param {string} endpoint
 * @param {object} data
 * @returns {Promise<object>}
 */
async function apiPost(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

/**
 * Perform a PUT request.
 * @param {string} endpoint
 * @param {object} data
 * @returns {Promise<object>}
 */
async function apiPut(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

/**
 * Perform a PATCH request.
 * @param {string} endpoint
 * @param {object} data
 * @returns {Promise<object>}
 */
async function apiPatch(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

/**
 * Perform a DELETE request.
 * @param {string} endpoint
 * @returns {Promise<object>}
 */
async function apiDelete(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// Export for use as a module (if bundled) or as globals (if loaded via <script>)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_BASE, apiGet, apiPost, apiPut, apiPatch, apiDelete };
}
