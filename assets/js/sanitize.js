/**
 * Globex Sky — sanitize.js
 * Centralized security utilities for XSS prevention and input validation.
 *   - sanitizeHTML()  — strips dangerous tags/attributes before innerHTML use
 *   - validateId()    — ensures URL ID params are numeric or valid UUID
 *   - validateUrl()   — blocks javascript:/data:/vbscript: protocol injection
 *   - escapeHtml()    — HTML entity encoding for safe text interpolation
 */

'use strict';

/* ── HTML Sanitization ──────────────────────────────────────────────────── */

/**
 * Sanitize an HTML string by removing script tags, event handlers,
 * and javascript: URLs before injecting via innerHTML.
 * @param {string} html
 * @returns {string}
 */
function sanitizeHTML(html) {
  if (!html) return '';
  const doc = (new DOMParser()).parseFromString(String(html), 'text/html');

  // Remove dangerous elements
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base'];
  dangerousTags.forEach(function (tag) {
    doc.querySelectorAll(tag).forEach(function (el) { el.remove(); });
  });

  // Remove event handler attributes and dangerous src/href values
  doc.querySelectorAll('*').forEach(function (el) {
    Array.from(el.attributes).forEach(function (attr) {
      const name = attr.name.toLowerCase();
      const value = attr.value.toLowerCase().replace(/\s/g, '');
      if (
        name.startsWith('on') ||
        (name === 'href' && (value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('vbscript:'))) ||
        (name === 'src' && (value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('vbscript:')))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

/* ── ID Validation ──────────────────────────────────────────────────────── */

/** UUID v4 pattern */
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Positive integer pattern */
var INT_RE = /^\d{1,19}$/;

/**
 * Return the value if it is a valid numeric ID or UUID, otherwise return ''.
 * @param {string} value
 * @returns {string}
 */
function validateId(value) {
  var v = String(value || '').trim();
  if (INT_RE.test(v) || UUID_RE.test(v)) return v;
  return '';
}

/* ── URL Validation ─────────────────────────────────────────────────────── */

/**
 * Return the URL if it uses a safe protocol (http/https/relative),
 * otherwise return ''. Blocks javascript:, data:, vbscript:, and other
 * non-http(s) absolute URLs.
 * @param {string} url
 * @returns {string}
 */
function validateUrl(url) {
  var v = String(url || '').trim();
  if (!v) return '';
  // Allow relative URLs (no scheme)
  if (v.startsWith('/') || v.startsWith('./') || v.startsWith('../') || v.startsWith('?') || v.startsWith('#')) {
    return v;
  }
  // For absolute URLs, only allow http and https
  try {
    var parsed = new URL(v);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return v;
    return '';
  } catch (_) {
    // Not a valid absolute URL — could be a relative path without leading slash
    // Block if it looks like a dangerous protocol
    var lower = v.toLowerCase().replace(/\s/g, '');
    if (/^(javascript|data|vbscript|file|blob):/.test(lower)) return '';
    return v;
  }
}

/* ── HTML Escaping ──────────────────────────────────────────────────────── */

/**
 * Escape special HTML characters for safe interpolation into HTML strings.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Exports ────────────────────────────────────────────────────────────── */
window.GlobexSanitize = { sanitizeHTML: sanitizeHTML, validateId: validateId, validateUrl: validateUrl, escapeHtml: escapeHtml };
