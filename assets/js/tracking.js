/**
 * Globex Sky — tracking.js
 * Order and shipment tracking: status timeline rendering,
 * real-time updates via Realtime module, map view, delivery confirmation.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     STATUS DEFINITIONS
  ───────────────────────────────────────────── */
  const STATUS_ORDER = [
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'returned',
  ];

  const STATUS_LABELS = {
    pending:          'Order Placed',
    confirmed:        'Order Confirmed',
    processing:       'Processing',
    shipped:          'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered:        'Delivered',
    cancelled:        'Cancelled',
    returned:         'Returned',
  };

  const STATUS_ICONS = {
    pending:          '🕐',
    confirmed:        '✅',
    processing:       '⚙️',
    shipped:          '📦',
    out_for_delivery: '🚚',
    delivered:        '🏠',
    cancelled:        '❌',
    returned:         '↩️',
  };

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    const orderId = _getOrderId();
    if (!orderId) return;

    _loadTracking(orderId);

    // Subscribe to real-time updates
    if (window.Realtime) {
      const unsub = window.Realtime.on('order:status', (data) => {
        if (String(data.orderId) === String(orderId)) {
          _updateTimeline(data.status, data.events || []);
          if (window.GlobexSky?.showToast) {
            window.GlobexSky.showToast(`Order status: ${STATUS_LABELS[data.status] || data.status}`, 'info');
          }
        }
      });
      window.addEventListener('beforeunload', unsub);
    }

    // Manual refresh button
    const refreshBtn = document.querySelector('[data-tracking-refresh]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => _loadTracking(orderId));
    }

    // Delivery confirmation button
    const confirmBtn = document.querySelector('[data-confirm-delivery]');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => _confirmDelivery(orderId));
    }
  });

  /* ─────────────────────────────────────────────
     LOAD TRACKING DATA
  ───────────────────────────────────────────── */
  function _getOrderId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('order_id') || params.get('id');
  }

  async function _loadTracking(orderId) {
    const loadingEl  = document.querySelector('[data-tracking-loading]');
    const errorEl    = document.querySelector('[data-tracking-error]');
    if (loadingEl) loadingEl.hidden = false;
    if (errorEl)   errorEl.hidden   = true;

    try {
      const api = window.ApiClient || window.API;
      let data;

      if (api) {
        const res = await api.orders.track(orderId);
        data = res.data || res;
      } else {
        const token = localStorage.getItem('globexToken') || '';
        const res = await fetch(`/api/v1/orders/${orderId}/tracking`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        data = json.data || json;
      }

      _renderOrderSummary(data);
      _updateTimeline(data.status, data.events || data.timeline || []);
      _renderShipmentDetails(data.shipment || {});
      if (data.shipment?.coordinates) {
        _initMap(data.shipment.coordinates);
      }
    } catch (err) {
      console.error('[Tracking] Failed to load tracking data:', err);
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = 'Could not load tracking information. Please try again.';
      }
    } finally {
      if (loadingEl) loadingEl.hidden = true;
    }
  }

  /* ─────────────────────────────────────────────
     ORDER SUMMARY
  ───────────────────────────────────────────── */
  function _renderOrderSummary(data) {
    _setText('[data-order-id]', data.order_id || data.id);
    _setText('[data-order-date]', _formatDate(data.created_at || data.order_date));
    _setText('[data-order-total]',
      window.Currency
        ? window.Currency.formatFromUSD(data.total || 0)
        : `$${(data.total || 0).toFixed(2)}`);
    _setText('[data-order-items-count]', data.items?.length || 0);

    const statusEl = document.querySelector('[data-order-status]');
    if (statusEl) {
      const status = data.status || 'pending';
      statusEl.textContent = STATUS_LABELS[status] || status;
      statusEl.dataset.status = status;
    }

    // Estimated delivery
    if (data.estimated_delivery) {
      _setText('[data-estimated-delivery]', `Estimated: ${_formatDate(data.estimated_delivery)}`);
    }
  }

  /* ─────────────────────────────────────────────
     TIMELINE
  ───────────────────────────────────────────── */
  function _updateTimeline(currentStatus, events) {
    const timeline = document.querySelector('[data-tracking-timeline]');
    if (!timeline) return;

    // Build ordered steps, stopping at cancelled/returned if applicable
    const isCancelled = currentStatus === 'cancelled' || currentStatus === 'returned';
    const steps = isCancelled
      ? [...STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(currentStatus) + 1)]
      : STATUS_ORDER.filter((s) => s !== 'cancelled' && s !== 'returned');

    const currentIdx = steps.indexOf(currentStatus);

    // Map events by status for timestamps
    const eventMap = {};
    events.forEach((e) => { eventMap[e.status] = e; });

    timeline.innerHTML = steps.map((status, idx) => {
      const isDone    = idx < currentIdx || status === currentStatus;
      const isActive  = status === currentStatus;
      const event     = eventMap[status];

      return `
        <div class="timeline-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}"
             data-step-status="${status}">
          <div class="timeline-icon" aria-label="${STATUS_LABELS[status]}">
            ${STATUS_ICONS[status] || '○'}
          </div>
          <div class="timeline-content">
            <strong>${STATUS_LABELS[status] || status}</strong>
            ${event ? `<time datetime="${event.timestamp}">${_formatDateTime(event.timestamp)}</time>` : ''}
            ${event?.note ? `<p class="timeline-note">${_escapeHTML(event.note)}</p>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────────
     SHIPMENT DETAILS
  ───────────────────────────────────────────── */
  function _renderShipmentDetails(shipment) {
    _setText('[data-tracking-number]', shipment.tracking_number);
    _setText('[data-carrier-name]',    shipment.carrier_name);
    _setText('[data-carrier-service]', shipment.service_name);
    _setText('[data-shipment-origin]', shipment.origin);
    _setText('[data-shipment-destination]', shipment.destination);

    // External carrier tracking link
    const extLink = document.querySelector('[data-carrier-track-link]');
    if (extLink && shipment.carrier_tracking_url) {
      extLink.href = shipment.carrier_tracking_url;
      extLink.hidden = false;
    }
  }

  /* ─────────────────────────────────────────────
     MAP VIEW
  ───────────────────────────────────────────── */
  function _initMap(coords) {
    const mapEl = document.querySelector('[data-tracking-map]');
    if (!mapEl) return;

    // Leaflet.js integration (optional dependency)
    if (window.L) {
      const map = L.map(mapEl).setView([coords.lat, coords.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      L.marker([coords.lat, coords.lng])
        .addTo(map)
        .bindPopup('Package location')
        .openPopup();
      return;
    }

    // Fallback: static map image via OpenStreetMap
    const { lat, lng } = coords;
    mapEl.innerHTML = `
      <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}"
         target="_blank" rel="noopener noreferrer">
        <img src="https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=600x200&markers=${lat},${lng},lightblue1"
             alt="Package location map" style="width:100%;border-radius:8px">
      </a>`;
  }

  /* ─────────────────────────────────────────────
     DELIVERY CONFIRMATION
  ───────────────────────────────────────────── */
  async function _confirmDelivery(orderId) {
    const btn = document.querySelector('[data-confirm-delivery]');
    if (btn) { btn.disabled = true; btn.textContent = 'Confirming…'; }

    try {
      const api = window.ApiClient || window.API;
      if (api) {
        await api.post(`/orders/${orderId}/confirm-delivery`);
      } else {
        const token = localStorage.getItem('globexToken') || '';
        await fetch(`/api/v1/orders/${orderId}/confirm-delivery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }

      if (window.GlobexSky?.showToast) {
        window.GlobexSky.showToast('Delivery confirmed! Thank you.', 'success');
      }
      if (btn) btn.hidden = true;

      _updateTimeline('delivered', []);
    } catch (err) {
      if (window.GlobexSky?.showToast) {
        window.GlobexSky.showToast('Could not confirm delivery. Please try again.', 'error');
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm Delivery'; }
    }
  }

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function _setText(selector, text) {
    if (text == null || text === '') return;
    document.querySelectorAll(selector).forEach((el) => { el.textContent = text; });
  }

  function _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) { return String(iso || ''); }
  }

  function _formatDateTime(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (_) { return String(iso || ''); }
  }

  /* expose for external use */
  window.Tracking = { reload: () => _loadTracking(_getOrderId()) };
})();
