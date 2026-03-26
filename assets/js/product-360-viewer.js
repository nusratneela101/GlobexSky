/**
 * GlobexSky — product-360-viewer.js
 * 360° product image viewer with drag/swipe rotation, auto-rotate,
 * zoom, fullscreen and lazy-loading image sequences.
 *
 * Exposes: window.GlobexSky.ProductViewer
 *   .init(containerId, imageUrls, options) → instance
 *   .rotateTo(angle)
 *   .startAutoRotate()
 *   .stopAutoRotate()
 *   .destroy()
 */

(function (global) {
  'use strict';

  /* ── Namespace ────────────────────────────────────────────────────────── */
  global.GlobexSky = global.GlobexSky || {};

  /* ── Defaults ─────────────────────────────────────────────────────────── */
  const DEFAULTS = {
    autoRotate:        false,
    autoRotateSpeed:   30,   // degrees per second
    dragSensitivity:   0.5,  // pixels per degree
    zoomMin:           1,
    zoomMax:           3,
    zoomStep:          0.1,
    startAngle:        0,
    lazyLoad:          true,
    lazyBatchSize:     6,
    fallbackCanvasWidth: 300,
  };

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  function angleToBucket(angle, total) {
    const deg = ((angle % 360) + 360) % 360;
    return Math.round((deg / 360) * total) % total;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     Viewer class
  ═══════════════════════════════════════════════════════════════════════ */
  function Viewer(containerId, imageUrls, options) {
    /* ── Config ── */
    this._opts       = Object.assign({}, DEFAULTS, options || {});
    this._urls       = imageUrls || [];
    this._total      = this._urls.length;
    this._angle      = this._opts.startAngle;
    this._frame      = angleToBucket(this._angle, this._total || 1);
    this._zoom       = 1;
    this._autoTimer  = null;
    this._lastTs     = null;
    this._dragging   = false;
    this._dragStartX = 0;
    this._dragStartFrame = 0;
    this._loaded     = new Array(this._total).fill(false);
    this._images     = new Array(this._total).fill(null);
    this._destroyed  = false;

    /* ── Root container ── */
    const root = document.getElementById(containerId);
    if (!root) throw new Error('[360Viewer] Container #' + containerId + ' not found');
    this._root = root;
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', '360° product view — drag to rotate');
    root.classList.add('pv360-container');

    /* ── Build DOM ── */
    this._buildDOM();
    this._bindEvents();

    /* ── Load images ── */
    if (this._total > 0) {
      this._loadBatch(0, this._opts.lazyBatchSize);
    }

    /* ── Auto-rotate ── */
    if (this._opts.autoRotate) this.startAutoRotate();
  }

  /* ── DOM construction ─────────────────────────────────────────────────── */
  Viewer.prototype._buildDOM = function () {
    const o = this._opts;

    /* Canvas layer (image display) */
    this._canvas = document.createElement('div');
    this._canvas.className = 'pv360-canvas';
    this._canvas.setAttribute('aria-hidden', 'true');

    /* Fallback <img> for no-JS / screen readers */
    this._imgEl = document.createElement('img');
    this._imgEl.className = 'pv360-img';
    this._imgEl.alt = '360° product image';
    this._imgEl.draggable = false;
    this._canvas.appendChild(this._imgEl);

    /* Progress overlay */
    this._overlay = document.createElement('div');
    this._overlay.className = 'pv360-overlay';
    this._overlay.setAttribute('role', 'progressbar');
    this._overlay.setAttribute('aria-valuenow', '0');
    this._overlay.setAttribute('aria-valuemax', '100');
    this._overlay.setAttribute('aria-label', 'Loading 360° images');

    this._progressBar = document.createElement('div');
    this._progressBar.className = 'pv360-progress-bar';

    this._progressText = document.createElement('div');
    this._progressText.className = 'pv360-progress-text';
    this._progressText.textContent = 'Loading…';

    this._overlay.appendChild(this._progressBar);
    this._overlay.appendChild(this._progressText);

    /* Controls toolbar */
    this._controls = document.createElement('div');
    this._controls.className = 'pv360-controls';
    this._controls.setAttribute('role', 'toolbar');
    this._controls.setAttribute('aria-label', '360° viewer controls');

    this._btnAutoRotate = this._makeBtn('pv360-btn-autorotate', 'fas fa-play', 'Auto-rotate', this._onToggleAutoRotate.bind(this));
    this._btnZoomIn     = this._makeBtn('pv360-btn-zoomin',     'fas fa-search-plus',  'Zoom in',    this._onZoomIn.bind(this));
    this._btnZoomOut    = this._makeBtn('pv360-btn-zoomout',    'fas fa-search-minus', 'Zoom out',   this._onZoomOut.bind(this));
    this._btnFullscreen = this._makeBtn('pv360-btn-fullscreen', 'fas fa-expand',       'Fullscreen', this._onFullscreen.bind(this));
    this._btnAR         = this._makeBtn('pv360-btn-ar',         'fas fa-vr-cardboard', 'View in AR', this._onAR.bind(this));

    [this._btnAutoRotate, this._btnZoomIn, this._btnZoomOut, this._btnFullscreen, this._btnAR].forEach(
      (btn) => this._controls.appendChild(btn)
    );

    /* Hint label */
    this._hint = document.createElement('div');
    this._hint.className = 'pv360-hint';
    this._hint.setAttribute('aria-hidden', 'true');
    this._hint.innerHTML = '<i class="fas fa-arrows-alt-h" aria-hidden="true"></i> Drag to rotate';

    /* Assemble */
    this._root.appendChild(this._canvas);
    this._root.appendChild(this._overlay);
    this._root.appendChild(this._controls);
    this._root.appendChild(this._hint);
  };

  Viewer.prototype._makeBtn = function (cls, iconCls, label, handler) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pv360-btn ' + cls;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    const icon = document.createElement('i');
    icon.className = iconCls;
    icon.setAttribute('aria-hidden', 'true');
    btn.appendChild(icon);
    btn.addEventListener('click', handler);
    return btn;
  };

  /* ── Image loading ────────────────────────────────────────────────────── */
  Viewer.prototype._loadBatch = function (start, size) {
    if (this._destroyed || this._total === 0) return;
    const end   = Math.min(start + size, this._total);
    let pending  = end - start;
    if (pending <= 0) { this._checkAllLoaded(); return; }

    for (let i = start; i < end; i++) {
      (function (idx) {
        const img = new Image();
        img.src = this._urls[idx];
        img.onload = img.onerror = () => {
          this._images[idx] = img;
          this._loaded[idx] = true;
          this._updateProgress();
          // show first frame as soon as it loads
          if (idx === this._frame && !this._imgEl.src) this._showFrame(idx);
          pending--;
          if (pending <= 0) {
            // load next batch lazily
            if (end < this._total) {
              this._loadBatch(end, this._opts.lazyBatchSize);
            } else {
              this._checkAllLoaded();
            }
          }
        };
      }).call(this, i);
    }
  };

  Viewer.prototype._updateProgress = function () {
    const n       = this._loaded.filter(Boolean).length;
    const pct     = this._total > 0 ? Math.round((n / this._total) * 100) : 100;
    this._progressBar.style.width = pct + '%';
    this._progressText.textContent = pct + '%';
    this._overlay.setAttribute('aria-valuenow', String(pct));
    if (n >= 1 && !this._imgEl.src) this._showFrame(this._frame);
  };

  Viewer.prototype._checkAllLoaded = function () {
    const allLoaded = this._loaded.every(Boolean);
    if (allLoaded) {
      this._overlay.classList.add('pv360-overlay--hidden');
      this._hint.classList.add('pv360-hint--visible');
      setTimeout(() => { this._hint.classList.remove('pv360-hint--visible'); }, 2500);
    }
  };

  /* ── Frame rendering ──────────────────────────────────────────────────── */
  Viewer.prototype._showFrame = function (idx) {
    idx = ((idx % this._total) + this._total) % this._total;
    if (this._images[idx]) {
      this._imgEl.src = this._images[idx].src;
    } else if (this._urls[idx]) {
      this._imgEl.src = this._urls[idx];
    }
    this._imgEl.style.transform = 'scale(' + this._zoom + ')';
    this._frame = idx;
  };

  Viewer.prototype._applyZoom = function () {
    this._imgEl.style.transform = 'scale(' + this._zoom + ')';
  };

  /* ── Event binding ────────────────────────────────────────────────────── */
  Viewer.prototype._bindEvents = function () {
    const canvas = this._canvas;

    /* Mouse drag */
    canvas.addEventListener('mousedown',  this._onMouseDown.bind(this));
    document.addEventListener('mousemove', this._onMouseMove.bind(this));
    document.addEventListener('mouseup',   this._onMouseUp.bind(this));

    /* Touch swipe */
    canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
    canvas.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: true });

    /* Scroll wheel zoom */
    canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });

    /* Keyboard navigation */
    this._root.setAttribute('tabindex', '0');
    this._root.addEventListener('keydown', this._onKeyDown.bind(this));

    /* Fullscreen change */
    document.addEventListener('fullscreenchange',       this._onFullscreenChange.bind(this));
    document.addEventListener('webkitfullscreenchange', this._onFullscreenChange.bind(this));
  };

  /* Mouse ── */
  Viewer.prototype._onMouseDown = function (e) {
    if (e.button !== 0) return;
    this._dragging       = true;
    this._dragStartX     = e.clientX;
    this._dragStartFrame = this._frame;
    this._canvas.style.cursor = 'grabbing';
    if (this._opts.autoRotate) this.stopAutoRotate();
  };

  Viewer.prototype._onMouseMove = function (e) {
    if (!this._dragging) return;
    this._updateDragFrame(e.clientX);
  };

  Viewer.prototype._onMouseUp = function () {
    if (!this._dragging) return;
    this._dragging = false;
    this._canvas.style.cursor = 'grab';
  };

  /* Touch ── */
  Viewer.prototype._onTouchStart = function (e) {
    if (e.touches.length === 1) {
      this._dragging       = true;
      this._dragStartX     = e.touches[0].clientX;
      this._dragStartFrame = this._frame;
      if (this._opts.autoRotate) this.stopAutoRotate();
    } else if (e.touches.length === 2) {
      /* Pinch-zoom: record initial distance */
      this._pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      this._pinchStartZoom = this._zoom;
    }
  };

  Viewer.prototype._onTouchMove = function (e) {
    if (e.touches.length === 1 && this._dragging) {
      e.preventDefault();
      this._updateDragFrame(e.touches[0].clientX);
    } else if (e.touches.length === 2 && this._pinchStartDist) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio     = dist / this._pinchStartDist;
      this._zoom      = clamp(this._pinchStartZoom * ratio, this._opts.zoomMin, this._opts.zoomMax);
      this._applyZoom();
    }
  };

  Viewer.prototype._onTouchEnd = function (e) {
    this._dragging        = false;
    this._pinchStartDist  = null;
  };

  /* Drag helper ── */
  Viewer.prototype._updateDragFrame = function (clientX) {
    const dx     = clientX - this._dragStartX;
    const delta  = dx / this._opts.dragSensitivity;
    const pxPerFrame = (this._canvas.offsetWidth || this._opts.fallbackCanvasWidth) / this._total;
    const frameDelta = Math.round(dx / (pxPerFrame * 2));
    const newFrame   = ((this._dragStartFrame - frameDelta) % this._total + this._total) % this._total;
    if (newFrame !== this._frame) this._showFrame(newFrame);
  };

  /* Zoom ── */
  Viewer.prototype._onWheel = function (e) {
    e.preventDefault();
    const dir       = e.deltaY > 0 ? -1 : 1;
    this._zoom      = clamp(this._zoom + dir * this._opts.zoomStep, this._opts.zoomMin, this._opts.zoomMax);
    this._applyZoom();
  };

  Viewer.prototype._onZoomIn = function () {
    this._zoom = clamp(this._zoom + this._opts.zoomStep * 3, this._opts.zoomMin, this._opts.zoomMax);
    this._applyZoom();
  };

  Viewer.prototype._onZoomOut = function () {
    this._zoom = clamp(this._zoom - this._opts.zoomStep * 3, this._opts.zoomMin, this._opts.zoomMax);
    this._applyZoom();
  };

  /* Keyboard ── */
  Viewer.prototype._onKeyDown = function (e) {
    const step = 1;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this._showFrame(this._frame - step);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._showFrame(this._frame + step);
        break;
      case '+': case '=':
        this._onZoomIn();
        break;
      case '-':
        this._onZoomOut();
        break;
      case 'f': case 'F':
        this._onFullscreen();
        break;
      case ' ':
        e.preventDefault();
        this._onToggleAutoRotate();
        break;
      default:
        break;
    }
  };

  /* Auto-rotate ── */
  Viewer.prototype._onToggleAutoRotate = function () {
    if (this._autoTimer) {
      this.stopAutoRotate();
    } else {
      this.startAutoRotate();
    }
  };

  /* Fullscreen ── */
  Viewer.prototype._onFullscreen = function () {
    if (!document.fullscreenElement) {
      (this._root.requestFullscreen || this._root.webkitRequestFullscreen).call(this._root);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  };

  Viewer.prototype._onFullscreenChange = function () {
    const icon = this._btnFullscreen.querySelector('i');
    if (document.fullscreenElement === this._root) {
      this._root.classList.add('pv360--fullscreen');
      if (icon) { icon.className = 'fas fa-compress'; }
      this._btnFullscreen.setAttribute('aria-label', 'Exit fullscreen');
      this._btnFullscreen.title = 'Exit fullscreen';
    } else {
      this._root.classList.remove('pv360--fullscreen');
      if (icon) { icon.className = 'fas fa-expand'; }
      this._btnFullscreen.setAttribute('aria-label', 'Fullscreen');
      this._btnFullscreen.title = 'Fullscreen';
    }
  };

  /* AR launch ── */
  Viewer.prototype._onAR = function () {
    if (global.GlobexSky.ARViewer) {
      const arContainerId = this._root.getAttribute('data-ar-container');
      const modelUrl      = this._root.getAttribute('data-ar-model');
      if (arContainerId && modelUrl) {
        const arViewer = global.GlobexSky.ARViewer.init(arContainerId, modelUrl);
        arViewer.launch();
      } else {
        /* Dispatch custom event so page can handle AR */
        this._root.dispatchEvent(new CustomEvent('pv360:ar', { bubbles: true }));
      }
    }
  };

  /* ── Public API ───────────────────────────────────────────────────────── */

  /**
   * Rotate viewer to a specific angle (0–359).
   * @param {number} angle
   */
  Viewer.prototype.rotateTo = function (angle) {
    this._angle = ((angle % 360) + 360) % 360;
    this._showFrame(angleToBucket(this._angle, this._total));
  };

  /**
   * Start continuous auto-rotation.
   */
  Viewer.prototype.startAutoRotate = function () {
    if (this._autoTimer || this._total === 0) return;
    this._lastTs = null;
    const speed  = this._opts.autoRotateSpeed; // deg/s
    const fps60  = 1000 / 60;

    const tick = (ts) => {
      if (this._destroyed || !this._autoTimer) return;
      if (this._lastTs === null) this._lastTs = ts;
      const dt       = ts - this._lastTs;
      this._lastTs   = ts;
      this._angle    = (this._angle + (speed * dt) / 1000) % 360;
      const newFrame = angleToBucket(this._angle, this._total);
      if (newFrame !== this._frame) this._showFrame(newFrame);
      this._autoTimer = requestAnimationFrame(tick);
    };
    this._autoTimer = requestAnimationFrame(tick);

    const icon = this._btnAutoRotate.querySelector('i');
    if (icon) icon.className = 'fas fa-pause';
    this._btnAutoRotate.setAttribute('aria-label', 'Pause auto-rotate');
    this._btnAutoRotate.title = 'Pause auto-rotate';
    this._btnAutoRotate.classList.add('pv360-btn--active');
  };

  /**
   * Stop continuous auto-rotation.
   */
  Viewer.prototype.stopAutoRotate = function () {
    if (this._autoTimer) {
      cancelAnimationFrame(this._autoTimer);
      this._autoTimer = null;
    }
    const icon = this._btnAutoRotate.querySelector('i');
    if (icon) icon.className = 'fas fa-play';
    this._btnAutoRotate.setAttribute('aria-label', 'Auto-rotate');
    this._btnAutoRotate.title = 'Auto-rotate';
    this._btnAutoRotate.classList.remove('pv360-btn--active');
  };

  /**
   * Tear down the viewer and remove all listeners/DOM.
   */
  Viewer.prototype.destroy = function () {
    this._destroyed = true;
    this.stopAutoRotate();
    this._root.innerHTML = '';
    this._root.classList.remove('pv360-container', 'pv360--fullscreen');
    this._root.removeAttribute('role');
    this._root.removeAttribute('aria-label');
    this._root.removeAttribute('tabindex');
  };

  /* ── Namespace export ─────────────────────────────────────────────────── */

  /**
   * GlobexSky.ProductViewer — factory / singleton registry.
   */
  global.GlobexSky.ProductViewer = {
    _instances: {},

    /**
     * Initialise a 360° viewer.
     * @param {string}   containerId  — ID of the wrapper element
     * @param {string[]} imageUrls    — ordered array of image URLs (0° → 360°)
     * @param {object}   [options]    — override DEFAULTS
     * @returns {Viewer}
     */
    init: function (containerId, imageUrls, options) {
      // Destroy any existing viewer in this container
      if (this._instances[containerId]) this._instances[containerId].destroy();
      const v = new Viewer(containerId, imageUrls, options);
      this._instances[containerId] = v;
      return v;
    },

    /** Rotate viewer in `containerId` to `angle` degrees. */
    rotateTo: function (containerId, angle) {
      if (this._instances[containerId]) this._instances[containerId].rotateTo(angle);
    },

    startAutoRotate: function (containerId) {
      if (this._instances[containerId]) this._instances[containerId].startAutoRotate();
    },

    stopAutoRotate: function (containerId) {
      if (this._instances[containerId]) this._instances[containerId].stopAutoRotate();
    },

    destroy: function (containerId) {
      if (this._instances[containerId]) {
        this._instances[containerId].destroy();
        delete this._instances[containerId];
      }
    },
  };

}(window));
