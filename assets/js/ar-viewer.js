/**
 * AR Viewer – GlobexSky
 * Implements WebXR-based Augmented Reality product placement with:
 * - Device capability detection
 * - Camera-based AR overlay (WebXR hit-test)
 * - Fallback to 2D image preview when AR is unavailable
 * - AR measurement tools for product size comparison
 */

(function () {
  'use strict';

  /* ── AR capability flags ── */
  const CAPS = {
    webXR:    'xr' in navigator,
    camera:   'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    gyro:     'DeviceOrientationEvent' in window,
    touch:    'ontouchstart' in window,
  };

  /* ── State ── */
  const state = {
    arSession:   null,
    arSupported: false,
    cameraStream: null,
    isARActive:  false,
    measureStart: null,
    measurements: [],
    currentProduct: null,
    placedCount: 0,
  };

  /* ── Sample product catalog ── */
  const productCatalog = [
    { id: 1, name: 'Industrial Motor X200',   dimensions: '45 × 38 × 30 cm', weight: '12 kg', icon: '⚙️',  color: '#3b82f6' },
    { id: 2, name: 'LED Panel Pro 60W',        dimensions: '60 × 60 × 5 cm',  weight: '2.1 kg', icon: '💡', color: '#f59e0b' },
    { id: 3, name: 'Safety Helmet Pro',        dimensions: '28 × 26 × 22 cm', weight: '0.4 kg', icon: '⛑️',  color: '#10b981' },
    { id: 4, name: 'Circuit Board Alpha',      dimensions: '20 × 15 × 3 cm',  weight: '0.15 kg', icon: '🔌', color: '#8b5cf6' },
    { id: 5, name: 'Hydraulic Pump HX-40',    dimensions: '50 × 40 × 35 cm', weight: '18 kg', icon: '🔧',  color: '#ef4444' },
  ];

  /* ── DOM helpers ── */
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

  /* ── Toast ── */
  function showToast(msg, icon) {
    const toast = qs('#ar-toast');
    if (!toast) return;
    qs('#ar-toast-text', toast).textContent = msg;
    if (icon) qs('#ar-toast-icon', toast).className = `fas fa-${icon}`;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 4000);
  }

  /* ── Capability detection ── */
  async function detectARSupport() {
    const badge = qs('#ar-capability-badge');
    if (!badge) return;

    badge.className = 'ar-support-badge checking';
    badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking AR support…';

    if (!CAPS.webXR) {
      state.arSupported = false;
      badge.className = 'ar-support-badge unsupported';
      badge.innerHTML = '<i class="fas fa-times-circle"></i> AR not supported – using 2D preview';
      showFallbackBanner();
      return;
    }

    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      state.arSupported = supported;
      if (supported) {
        badge.className = 'ar-support-badge supported';
        badge.innerHTML = '<i class="fas fa-check-circle"></i> AR ready – tap "View in Your Space"';
      } else {
        badge.className = 'ar-support-badge unsupported';
        badge.innerHTML = '<i class="fas fa-exclamation-circle"></i> AR not available – showing 2D preview';
        showFallbackBanner();
      }
    } catch {
      state.arSupported = false;
      badge.className = 'ar-support-badge unsupported';
      badge.innerHTML = '<i class="fas fa-exclamation-circle"></i> AR check failed – using 2D preview';
      showFallbackBanner();
    }
  }

  function showFallbackBanner() {
    const banner = qs('#ar-fallback-banner');
    if (banner) banner.style.display = 'flex';
  }

  /* ── Launch AR ── */
  async function launchAR() {
    if (!state.currentProduct) {
      showToast('Please select a product first.', 'exclamation-triangle');
      return;
    }

    if (!state.arSupported) {
      // Fall back to camera overlay simulation
      return launchCameraPreview();
    }

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'light-estimation'],
        domOverlay: { root: document.body },
      });

      state.arSession = session;
      state.isARActive = true;
      updateARButton();

      session.addEventListener('end', () => {
        state.arSession = null;
        state.isARActive = false;
        updateARButton();
        showToast('AR session ended.', 'sign-out-alt');
      });

      showToast(`Placing ${state.currentProduct.name} in your space…`, 'cube');
      renderAROverlay();

    } catch (err) {
      showToast('AR session failed: ' + err.message, 'exclamation-circle');
      launchCameraPreview();
    }
  }

  /* ── Camera-based preview fallback ── */
  async function launchCameraPreview() {
    if (!CAPS.camera) {
      showToast('Camera not available. Showing static preview.', 'camera');
      showStaticPreview();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      state.cameraStream = stream;
      const video = qs('#ar-camera-feed');
      if (video) { video.srcObject = stream; video.play(); }
      const overlay = qs('#ar-camera-overlay');
      if (overlay) { overlay.style.display = 'flex'; }
      state.isARActive = true;
      updateARButton();
      placeProductOverlay();
      showToast('Camera AR preview active. Aim at a flat surface.', 'camera');
    } catch {
      showToast('Camera permission denied. Showing static preview.', 'camera-slash');
      showStaticPreview();
    }
  }

  function stopCameraPreview() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(t => t.stop());
      state.cameraStream = null;
    }
    const overlay = qs('#ar-camera-overlay');
    if (overlay) overlay.style.display = 'none';
    state.isARActive = false;
    updateARButton();
    showToast('AR preview closed.', 'sign-out-alt');
  }

  /* ── Static 2D fallback preview ── */
  function showStaticPreview() {
    if (!state.currentProduct) return;
    const preview = qs('#ar-static-preview');
    if (!preview) return;
    preview.innerHTML = `
      <div style="text-align:center;padding:32px">
        <div style="font-size:4rem;margin-bottom:12px">${state.currentProduct.icon}</div>
        <div style="font-family:'Poppins',sans-serif;font-weight:700;font-size:1rem;color:#0a0e27;margin-bottom:6px">${state.currentProduct.name}</div>
        <div style="font-size:.82rem;color:#64748b">Dimensions: ${state.currentProduct.dimensions}</div>
        <div style="font-size:.82rem;color:#64748b">Weight: ${state.currentProduct.weight}</div>
        <div style="margin-top:16px;font-size:.78rem;color:#94a3b8">
          <i class="fas fa-info-circle"></i> 3D AR preview not available on this device
        </div>
      </div>`;
    preview.style.display = 'block';
  }

  /* ── Place product overlay on camera feed ── */
  function placeProductOverlay() {
    if (!state.currentProduct) return;
    const el = qs('#ar-product-ghost');
    if (!el) return;
    el.innerHTML = `
      <div style="font-size:3rem;text-align:center;margin-bottom:4px">${state.currentProduct.icon}</div>
      <div style="font-size:.72rem;font-weight:700;color:#fff;text-align:center;background:rgba(0,0,0,.5);padding:3px 8px;border-radius:4px">
        ${state.currentProduct.name}
      </div>`;
    el.style.display = 'flex';
    state.placedCount++;
    enableDraggableGhost(el);
  }

  /* ── Make placed product draggable within overlay ── */
  function enableDraggableGhost(el) {
    let ox = 0, oy = 0, lx = 0, ly = 0;

    el.style.position = 'absolute';
    el.style.left = '40%';
    el.style.top = '45%';
    el.style.cursor = 'move';

    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', startT, { passive: true });

    function start(e) {
      e.preventDefault();
      lx = e.clientX; ly = e.clientY;
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', stop);
    }
    function startT(e) {
      lx = e.touches[0].clientX; ly = e.touches[0].clientY;
      document.addEventListener('touchmove', moveT, { passive: true });
      document.addEventListener('touchend', stop);
    }
    function move(e) {
      ox += e.clientX - lx; oy += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      el.style.transform = `translate(${ox}px,${oy}px)`;
    }
    function moveT(e) {
      ox += e.touches[0].clientX - lx; oy += e.touches[0].clientY - ly;
      lx = e.touches[0].clientX; ly = e.touches[0].clientY;
      el.style.transform = `translate(${ox}px,${oy}px)`;
    }
    function stop() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', stop);
      document.removeEventListener('touchmove', moveT);
      document.removeEventListener('touchend', stop);
    }
  }

  /* ── AR Overlay DOM rendering ── */
  function renderAROverlay() {
    const panel = qs('#ar-active-panel');
    if (!panel || !state.currentProduct) return;
    panel.innerHTML = `
      <div class="vr-card" style="background:rgba(0,0,0,.8);color:#fff;border:1px solid rgba(255,255,255,.15)">
        <div style="font-size:1.5rem;text-align:center;margin-bottom:6px">${state.currentProduct.icon}</div>
        <div style="font-weight:700;text-align:center;margin-bottom:4px">${state.currentProduct.name}</div>
        <div style="font-size:.78rem;opacity:.75;text-align:center;margin-bottom:12px">${state.currentProduct.dimensions}</div>
        <button class="btn-vr btn-vr-white" style="width:100%;justify-content:center" onclick="ARViewer.stopAR()">
          <i class="fas fa-times"></i> Exit AR
        </button>
      </div>`;
    panel.style.display = 'block';
  }

  /* ── Measurement tool ── */
  function startMeasurement() {
    state.measureStart = null;
    state.measurements = [];
    showToast('Tap two points on a surface to measure distance.', 'ruler');
    const canvas = qs('#ar-measure-canvas');
    if (canvas) {
      canvas.style.display = 'block';
      canvas.addEventListener('click', onMeasureClick, { once: false });
    }
  }

  function onMeasureClick(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!state.measureStart) {
      state.measureStart = { x, y };
      drawMeasurePoint(e.target, x, y, 'A');
      showToast('Point A set. Now tap point B.', 'map-pin');
    } else {
      const dx = x - state.measureStart.x;
      const dy = y - state.measureStart.y;
      const pixDist = Math.sqrt(dx * dx + dy * dy);
      // Approximate 1 cm = 3.78 px at standard screen DPI
      const cmDist = (pixDist / 3.78).toFixed(1);
      drawMeasureLine(e.target, state.measureStart.x, state.measureStart.y, x, y, cmDist);
      showToast(`Measured: ~${cmDist} cm`, 'ruler');
      state.measurements.push({ start: state.measureStart, end: { x, y }, cm: cmDist });
      state.measureStart = null;
    }
  }

  function drawMeasurePoint(canvas, x, y, label) {
    const dot = document.createElement('div');
    dot.style.cssText = `position:absolute;left:${x - 8}px;top:${y - 8}px;width:16px;height:16px;border-radius:50%;background:#ef4444;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#fff;font-weight:700`;
    dot.textContent = label;
    canvas.appendChild(dot);
  }

  function drawMeasureLine(canvas, x1, y1, x2, y2, label) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#ef4444'); line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '6 4');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', (x1 + x2) / 2); text.setAttribute('y', (y1 + y2) / 2 - 6);
    text.setAttribute('fill', '#fff'); text.setAttribute('font-size', '11'); text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-weight', 'bold');
    text.textContent = `~${label} cm`;
    svg.appendChild(line); svg.appendChild(text);
    canvas.appendChild(svg);
    drawMeasurePoint(canvas, x2, y2, 'B');
  }

  /* ── Product selection ── */
  function selectProduct(id) {
    const product = productCatalog.find(p => p.id === id);
    if (!product) return;
    state.currentProduct = product;

    // Update info panel
    const info = qs('#ar-product-info');
    if (info) {
      qs('#ar-prod-name',   info).textContent = product.name;
      qs('#ar-prod-dims',   info).textContent = product.dimensions;
      qs('#ar-prod-weight', info).textContent = product.weight;
    }

    qsa('.ar-product-tile').forEach(t => t.classList.remove('selected'));
    const tile = qs(`[data-ar-id="${id}"]`);
    if (tile) tile.classList.add('selected');

    showToast(`Selected: ${product.name}`, 'check');
  }

  /* ── Button state ── */
  function updateARButton() {
    const btn = qs('#btn-launch-ar');
    if (!btn) return;
    btn.innerHTML = state.isARActive
      ? '<i class="fas fa-times"></i> Exit AR'
      : '<i class="fas fa-camera"></i> View in Your Space';
    btn.onclick = state.isARActive ? stopAR : launchAR;
  }

  function stopAR() {
    if (state.arSession) { state.arSession.end(); }
    stopCameraPreview();
    const panel = qs('#ar-active-panel');
    if (panel) panel.style.display = 'none';
    state.isARActive = false;
    updateARButton();
  }

  /* ── Bind events ── */
  function bindButtons() {
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-ar-action]');
      if (!btn) return;
      const action = btn.dataset.arAction;
      switch (action) {
        case 'launch-ar':    launchAR(); break;
        case 'stop-ar':      stopAR(); break;
        case 'measure':      startMeasurement(); break;
        case 'select-prod':  selectProduct(Number(btn.dataset.arId)); break;
      }
    });
  }

  /* ── Init ── */
  function init() {
    detectARSupport();
    bindButtons();

    // Default to first product
    if (productCatalog.length) selectProduct(productCatalog[0].id);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ── */
  window.ARViewer = { launchAR, stopAR, selectProduct, startMeasurement };
})();

/* ============================================================================
   GlobexSky.ARViewer namespace
   Exposes: init(containerId, modelUrl, options), isSupported(), launch(), close()
   Uses the native WebXR API where available and <model-viewer> as fallback.
   Desktop users receive a QR-code popup; unsupported browsers get a graceful
   fallback message.
============================================================================ */
(function (global) {
  'use strict';

  global.GlobexSky = global.GlobexSky || {};

  /* ── Feature detection ── */
  function _isMobile() {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function _supportsAR() {
    return ('xr' in navigator) || ('customElements' in window);
  }

  /* ── QR code image URL via public API ── */
  function _qrUrl(text) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(text);
  }

  /* ── Defaults ── */
  var DEFAULTS = {
    buttonLabel:       'View in Your Space',
    productName:       'Product',
    mobileUrl:         null,
    posterUrl:         null,
    injectModelViewer: true,
    modelScale:        null,
  };

  /* ────────────────────────────────────────────────────────────────────────
     ARInstance class
  ──────────────────────────────────────────────────────────────────────── */
  function ARInstance(containerId, modelUrl, options) {
    this._opts      = Object.assign({}, DEFAULTS, options || {});
    this._modelUrl  = modelUrl || '';
    this._open      = false;
    this._overlay   = null;

    var root = document.getElementById(containerId);
    if (!root) throw new Error('[GlobexSky.ARViewer] Container #' + containerId + ' not found');
    this._root = root;

    /* Inject <model-viewer> script once */
    if (this._opts.injectModelViewer && !customElements.get('model-viewer')) {
      _injectModelViewerScript();
    }

    this._buildLaunchButton();
  }

  function _injectModelViewerScript() {
    if (document.querySelector('script[data-gs-ar-mv]')) return;
    var s    = document.createElement('script');
    s.type   = 'module';
    s.src    = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    s.setAttribute('data-gs-ar-mv', '1');
    document.head.appendChild(s);
  }

  ARInstance.prototype._buildLaunchButton = function () {
    var self = this;
    var btn  = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'ar-launch-btn';
    btn.setAttribute('aria-label', this._opts.buttonLabel);
    btn.title     = this._opts.buttonLabel;
    btn.innerHTML = '<i class="fas fa-vr-cardboard" aria-hidden="true"></i> ' +
                    '<span>' + _esc(this._opts.buttonLabel) + '</span>';
    btn.addEventListener('click', function () { self.launch(); });
    this._root.appendChild(btn);
    this._launchBtn = btn;
  };

  ARInstance.prototype._buildOverlay = function () {
    var self    = this;
    var overlay = document.createElement('div');
    overlay.className   = 'ar-overlay';
    overlay.setAttribute('role',       'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'AR — View in Your Space');
    overlay.setAttribute('tabindex',   '-1');

    var closeBtn = document.createElement('button');
    closeBtn.type      = 'button';
    closeBtn.className = 'ar-overlay__close';
    closeBtn.setAttribute('aria-label', 'Close AR viewer');
    closeBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    closeBtn.addEventListener('click', function () { self.close(); });

    var content = document.createElement('div');
    content.className = 'ar-overlay__content';

    overlay.appendChild(closeBtn);
    overlay.appendChild(content);
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') self.close();
    });

    this._overlay        = overlay;
    this._overlayContent = content;
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.focus(); });
  };

  ARInstance.prototype._renderMobileAR = function () {
    var mv = document.createElement('model-viewer');
    mv.setAttribute('src',             this._modelUrl);
    mv.setAttribute('ar',              '');
    mv.setAttribute('ar-modes',        'webxr scene-viewer quick-look');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('touch-action',    'pan-y');
    mv.setAttribute('auto-rotate',     '');
    mv.setAttribute('alt',             this._opts.productName + ' — 3D model');
    if (this._opts.posterUrl)  mv.setAttribute('poster', this._opts.posterUrl);
    if (this._opts.modelScale) mv.setAttribute('scale',  this._opts.modelScale);
    mv.className = 'ar-model-viewer';

    var arBtn = document.createElement('button');
    arBtn.slot      = 'ar-button';
    arBtn.className = 'ar-model-viewer__ar-btn';
    arBtn.textContent = '📱 View in Your Space';
    mv.appendChild(arBtn);

    var self = this;
    mv.addEventListener('ar-status', function (e) {
      if (e.detail && e.detail.status === 'failed') {
        self._renderFallback('AR failed to launch. Please try on a supported device.');
      }
    });

    this._overlayContent.appendChild(mv);
  };

  ARInstance.prototype._renderDesktopQR = function () {
    var url     = this._opts.mobileUrl || window.location.href;
    var wrapper = document.createElement('div');
    wrapper.className = 'ar-qr-wrapper';
    wrapper.innerHTML =
      '<div class="ar-qr-heading">' +
        '<i class="fas fa-vr-cardboard" aria-hidden="true"></i>' +
        '<h3>View in Your Space</h3>' +
        '<p>Scan with your mobile device to experience this product in AR</p>' +
      '</div>' +
      '<div class="ar-qr-code">' +
        '<img src="' + _qrUrl(url) + '" alt="QR code to open AR experience on mobile" width="200" height="200" />' +
      '</div>' +
      '<p class="ar-qr-hint">Point your phone camera at the QR code</p>' +
      '<div class="ar-qr-badges">' +
        '<span class="ar-badge"><i class="fab fa-android" aria-hidden="true"></i> Android</span>' +
        '<span class="ar-badge"><i class="fab fa-apple" aria-hidden="true"></i> iOS</span>' +
      '</div>';
    this._overlayContent.appendChild(wrapper);
  };

  ARInstance.prototype._renderFallback = function (msg) {
    this._overlayContent.innerHTML =
      '<div class="ar-fallback">' +
        '<i class="fas fa-exclamation-circle ar-fallback__icon" aria-hidden="true"></i>' +
        '<h3 class="ar-fallback__title">AR Not Supported</h3>' +
        '<p class="ar-fallback__message">' + _esc(msg ||
          'Your browser does not support AR. Try Chrome or Safari on a mobile device.') + '</p>' +
        '<a href="' + _esc(this._modelUrl) + '" download class="ar-fallback__download">' +
          '<i class="fas fa-download" aria-hidden="true"></i> Download 3D Model' +
        '</a>' +
      '</div>';
  };

  /** @returns {boolean} */
  ARInstance.prototype.isSupported = function () { return _supportsAR(); };

  /** Open the AR experience. */
  ARInstance.prototype.launch = function () {
    if (this._open) return;
    this._open = true;
    this._buildOverlay();

    if (_isMobile() && _supportsAR()) {
      this._renderMobileAR();
    } else if (!_isMobile()) {
      this._renderDesktopQR();
    } else {
      this._renderFallback();
    }

    var overlay = this._overlay;
    requestAnimationFrame(function () { overlay.classList.add('ar-overlay--visible'); });
    document.body.style.overflow = 'hidden';
  };

  /** Close and clean up the AR overlay. */
  ARInstance.prototype.close = function () {
    if (!this._open || !this._overlay) return;
    this._open = false;

    this._overlay.classList.remove('ar-overlay--visible');
    var overlay = this._overlay;
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);

    this._overlay        = null;
    this._overlayContent = null;
    document.body.style.overflow = '';
    if (this._launchBtn) this._launchBtn.focus();
  };

  /* ── XSS-safe text helper ── */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Namespace export ── */
  global.GlobexSky.ARViewer = {
    _instances: {},

    /**
     * Initialise an AR viewer.
     * @param {string} containerId
     * @param {string} modelUrl — .glb or .gltf URL
     * @param {object} [options]
     * @returns {ARInstance}
     */
    init: function (containerId, modelUrl, options) {
      if (this._instances[containerId]) this._instances[containerId].close();
      var v = new ARInstance(containerId, modelUrl, options);
      this._instances[containerId] = v;
      return v;
    },

    /** @returns {boolean} */
    isSupported: function () { return _supportsAR(); },

    launch: function (containerId) {
      if (this._instances[containerId]) this._instances[containerId].launch();
    },

    close: function (containerId) {
      if (this._instances[containerId]) this._instances[containerId].close();
    },
  };

}(window));
