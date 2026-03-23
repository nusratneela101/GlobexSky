/**
 * Globex Sky — websocket-client.js
 * Frontend WebSocket client with auto-reconnect, event system,
 * and handlers for all real-time message types.
 *
 * Exports: window.GlobexSky.ws
 */

(function (global) {
  'use strict';

  if (!global.GlobexSky) global.GlobexSky = {};

  const WS_MAX_RETRIES = 5;
  const WS_RETRY_BASE_MS = 1000;

  function _getWsUrl() {
    if (global.GlobexSky.config && global.GlobexSky.config.wsUrl) {
      return global.GlobexSky.config.wsUrl;
    }
    const h = global.location.hostname;
    const isLocal = h === 'localhost' || h === '127.0.0.1';
    return isLocal ? 'ws://localhost:5000' : 'wss://globexsky-backend.up.railway.app';
  }

  const _handlers = {};
  let _ws = null;
  let _retries = 0;
  let _retryTimer = null;
  let _intentionalClose = false;

  // ─── Event System ─────────────────────────────────────────────────────────

  function on(event, handler) {
    if (!_handlers[event]) _handlers[event] = [];
    _handlers[event].push(handler);
  }

  function off(event, handler) {
    if (!_handlers[event]) return;
    _handlers[event] = _handlers[event].filter((h) => h !== handler);
  }

  function emit(event, data) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: event, data }));
    } else {
      console.warn('[GlobexSky.ws] Cannot emit — WebSocket not connected.');
    }
  }

  function _trigger(event, payload) {
    const list = _handlers[event] || [];
    list.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error('[GlobexSky.ws] handler error', e); }
    });
  }

  // ─── Message Handlers ─────────────────────────────────────────────────────

  function _handleMessage(msg) {
    const { type, data } = msg;
    _trigger(type, data);

    switch (type) {
      case 'notification':
        _showToast(data);
        break;
      case 'cart_update':
        _updateCartBadge(data);
        break;
      case 'order_update':
        _trigger('order_update', data);
        break;
      case 'price_update':
        _trigger('price_update', data);
        break;
      case 'livestream':
        _trigger('livestream', data);
        break;
      case 'presence':
        _trigger('presence', data);
        break;
      case 'chat':
        _trigger('chat', data);
        break;
      default:
        break;
    }
  }

  function _showToast(data) {
    const title = (data && data.title) ? data.title : 'New notification';
    const message = (data && data.message) ? data.message : '';
    if (global.GlobexSky && typeof global.GlobexSky.showToast === 'function') {
      global.GlobexSky.showToast(title + (message ? ': ' + message : ''), 'info');
      return;
    }
    // Fallback: create a simple toast if showToast is not available
    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed;bottom:20px;right:20px;z-index:9999',
      'background:#1e40af;color:#fff;padding:12px 20px',
      'border-radius:8px;font-size:.9rem;max-width:320px',
      'box-shadow:0 4px 12px rgba(0,0,0,.25);opacity:1',
      'transition:opacity .4s ease',
    ].join(';');
    toast.textContent = title;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  function _updateCartBadge(data) {
    const count = data && data.count !== undefined ? data.count : null;
    if (count === null) return;
    const badges = document.querySelectorAll('[data-cart-badge], .cart-count, .cart-badge');
    badges.forEach((el) => { el.textContent = count > 99 ? '99+' : count; });
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  function connect() {
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = _getWsUrl();
    try {
      _ws = new WebSocket(url);
    } catch (e) {
      console.error('[GlobexSky.ws] Failed to create WebSocket:', e);
      _scheduleReconnect();
      return;
    }

    _ws.addEventListener('open', () => {
      _retries = 0;
      _trigger('connected', {});
      // Send auth token if available
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (token) {
        _ws.send(JSON.stringify({ type: 'auth', data: { token } }));
      }
    });

    _ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        _handleMessage(msg);
      } catch (e) {
        console.warn('[GlobexSky.ws] Invalid message format:', event.data);
      }
    });

    _ws.addEventListener('close', (event) => {
      _trigger('disconnected', { code: event.code, reason: event.reason });
      if (!_intentionalClose) _scheduleReconnect();
    });

    _ws.addEventListener('error', (event) => {
      _trigger('error', event);
    });
  }

  function disconnect() {
    _intentionalClose = true;
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    if (_ws) { _ws.close(); _ws = null; }
  }

  function _scheduleReconnect() {
    if (_retries >= WS_MAX_RETRIES) {
      console.warn('[GlobexSky.ws] Max reconnect retries reached.');
      _trigger('reconnect_failed', {});
      return;
    }
    const delay = WS_RETRY_BASE_MS * Math.pow(2, _retries);
    _retries++;
    _retryTimer = setTimeout(() => {
      _intentionalClose = false;
      connect();
    }, delay);
  }

  function isConnected() {
    return _ws && _ws.readyState === WebSocket.OPEN;
  }

  // ─── Auto-connect on DOMContentLoaded ─────────────────────────────────────

  function init() {
    connect();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  global.GlobexSky.ws = {
    connect,
    disconnect,
    isConnected,
    on,
    off,
    emit,
    init,
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(window));
