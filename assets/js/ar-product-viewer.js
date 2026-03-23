/**
 * AR Product Viewer – GlobexSky
 * WebXR AR session with hit-test surface detection and product placement.
 *
 * Gracefully falls back to a camera overlay preview when WebXR AR
 * is not available on the device.
 *
 * Usage:
 *   const viewer = new ARProductViewer('ar-canvas');
 *   await viewer.loadProduct(productData);
 *   await viewer.startAR();
 */

class ARProductViewer {
  /**
   * @param {string} canvasId  Canvas element ID for the AR scene
   */
  constructor(canvasId = 'ar-canvas') {
    this._canvasId    = canvasId;
    this._session     = null;
    this._refSpace    = null;
    this._hitTestSrc  = null;
    this._reticle     = null;
    this._gl          = null;
    this._product     = null;
    this._placed      = false;
    this._placedCount = 0;
    this._pinchStart  = null;
    this._rotateAngle = 0;
    this._scaleValue  = 1;
    this._animFrame   = null;
    this._fallbackStream = null;

    this.CAPS = {
      webXR:   'xr' in navigator,
      webGL:   !!document.createElement('canvas').getContext('webgl2'),
      camera:  'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      touch:   'ontouchstart' in window,
    };
  }

  /* ─────────────────────────────────────────────────────────────────────
     Public API
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Load product data into the viewer.
   * @param {{id:string, name:string, images:string[], price:number, dimensions:string}} product
   */
  loadProduct(product) {
    this._product = product;
    this._renderProductInfo(product);
  }

  /**
   * Check if immersive-ar is supported and start an AR session.
   * Falls back to camera overlay if WebXR AR is unavailable.
   */
  async startAR() {
    if (this.CAPS.webXR) {
      const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
      if (supported) {
        return this._startWebXRAR();
      }
    }
    // Fallback: camera overlay
    this._startCameraFallback();
  }

  /** Stop the AR session and clean up. */
  async stopAR() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    if (this._session) {
      await this._session.end().catch(() => {});
      this._session = null;
    }
    if (this._fallbackStream) {
      this._fallbackStream.getTracks().forEach(t => t.stop());
      this._fallbackStream = null;
    }
    this._updateARButton(false);
  }

  /**
   * Take a screenshot of the current AR view and return a data URL.
   * @returns {string|null}
   */
  takeScreenshot() {
    const canvas = document.getElementById(this._canvasId);
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch (_) {
      // Tainted canvas (cross-origin video)
      return null;
    }
  }

  /**
   * Share screenshot to social media via the Web Share API.
   */
  async shareScreenshot() {
    const dataUrl = this.takeScreenshot();
    if (!dataUrl) {
      this._showToast('Screenshot not available on this device.', 'exclamation-triangle');
      return;
    }

    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'globexsky-ar.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Check out ${this._product?.name || 'this product'} in AR – GlobexSky`,
        text: `I'm viewing ${this._product?.name || 'a product'} in Augmented Reality on GlobexSky!`,
        files: [file],
      });
    } else {
      // Download fallback
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'globexsky-ar.png';
      a.click();
      this._showToast('Screenshot saved!', 'download');
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     WebXR AR session
  ───────────────────────────────────────────────────────────────────── */

  async _startWebXRAR() {
    const canvas = document.getElementById(this._canvasId);
    if (!canvas) return;

    this._gl = canvas.getContext('webgl2', { xrCompatible: true });
    if (!this._gl) {
      return this._startCameraFallback();
    }

    const sessionInit = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'light-estimation'],
      domOverlay: { root: document.getElementById('ar-overlay') || document.body },
    };

    try {
      this._session = await navigator.xr.requestSession('immersive-ar', sessionInit);
    } catch (err) {
      this._log('WebXR AR session failed: ' + err.message);
      return this._startCameraFallback();
    }

    this._session.addEventListener('end', () => {
      this._session = null;
      this._hitTestSrc = null;
      this._updateARButton(false);
      this._showToast('AR session ended.', 'sign-out-alt');
    });

    const layer = new XRWebGLLayer(this._session, this._gl);
    await this._session.updateRenderState({ baseLayer: layer });

    this._refSpace = await this._session.requestReferenceSpace('local');
    const viewerSpace = await this._session.requestReferenceSpace('viewer');
    this._hitTestSrc = await this._session.requestHitTestSource({ space: viewerSpace });

    this._reticle = this._createReticle();
    this._updateARButton(true);
    this._bindARGestures();

    this._session.requestAnimationFrame((time, frame) => this._onXRFrame(time, frame));
    this._showToast('Point your camera at a flat surface, then tap to place the product.', 'circle-info');
  }

  _onXRFrame(time, frame) {
    if (!this._session) return;
    this._session.requestAnimationFrame((t, f) => this._onXRFrame(t, f));

    const pose = frame.getViewerPose(this._refSpace);
    if (!pose) return;

    const layer = this._session.renderState.baseLayer;
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, layer.framebuffer);
    this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);

    // Hit-test for reticle placement
    if (this._hitTestSrc) {
      const hits = frame.getHitTestResults(this._hitTestSrc);
      if (hits.length > 0) {
        const hitPose = hits[0].getPose(this._refSpace);
        this._updateReticle(hitPose.transform.matrix, true);
      } else {
        this._updateReticle(null, false);
      }
    }
  }

  _createReticle() {
    const el = document.createElement('div');
    el.id = 'ar-reticle';
    el.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      width:60px;height:60px;border:3px solid #fff;border-radius:50%;
      box-shadow:0 0 0 2px rgba(255,255,255,.3);pointer-events:none;
      display:none;z-index:1000;transition:opacity .2s`;
    el.innerHTML = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      width:8px;height:8px;background:#fff;border-radius:50%"></div>`;
    document.body.appendChild(el);
    return el;
  }

  _updateReticle(matrix, visible) {
    if (!this._reticle) return;
    this._reticle.style.display = visible ? 'block' : 'none';
  }

  /* ─────────────────────────────────────────────────────────────────────
     Camera fallback (non-WebXR devices)
  ───────────────────────────────────────────────────────────────────── */

  async _startCameraFallback() {
    this._showToast('WebXR AR not available – using camera overlay preview.', 'exclamation-triangle');

    const canvas = document.getElementById(this._canvasId);
    if (!canvas) return;

    // Show product overlay on camera feed
    if (!this.CAPS.camera) {
      canvas.style.background = '#1a1a2e';
      this._renderFallbackOverlay(canvas);
      return;
    }

    try {
      this._fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const video = document.createElement('video');
      video.srcObject = this._fallbackStream;
      video.autoplay  = true;
      video.playsInline = true;
      video.muted = true;

      const ctx = canvas.getContext('2d');
      const product = this._product;

      const drawFrame = () => {
        if (!this._fallbackStream) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        this._drawProductOverlay(ctx, canvas, product);
        this._animFrame = requestAnimationFrame(drawFrame);
      };
      video.addEventListener('loadedmetadata', () => {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        drawFrame();
      });
    } catch (err) {
      this._log('Camera access denied: ' + err.message);
      this._renderFallbackOverlay(canvas);
    }

    this._updateARButton(true);
    this._bindARGestures();
  }

  _drawProductOverlay(ctx, canvas, product) {
    const w = canvas.width;
    const h = canvas.height;
    const boxW = Math.min(200 * this._scaleValue, w * 0.4);
    const boxH = boxW;
    const x = (w - boxW) / 2;
    const y = (h - boxH) / 2;

    ctx.save();
    ctx.translate(x + boxW / 2, y + boxH / 2);
    ctx.rotate((this._rotateAngle * Math.PI) / 180);

    ctx.fillStyle = 'rgba(0, 82, 204, 0.15)';
    ctx.strokeStyle = 'rgba(0, 82, 204, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    if (product) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(product.name || 'Product', 0, 0);
    }

    ctx.restore();

    // Placement instructions
    if (!this._placed) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 140, h - 60, 280, 36, 18);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Tap to place • Pinch to resize • Drag to rotate', w / 2, h - 42);
    }
  }

  _renderFallbackOverlay(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width  = canvas.offsetWidth  || 640;
    canvas.height = canvas.offsetHeight || 360;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#8b949e';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Camera not available. AR preview requires camera access.', canvas.width / 2, canvas.height / 2);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Gesture handling (pinch to resize, drag to rotate, tap to place)
  ───────────────────────────────────────────────────────────────────── */

  _bindARGestures() {
    const canvas = document.getElementById(this._canvasId);
    if (!canvas) return;

    // Tap / click to place
    canvas.addEventListener('click', () => {
      if (!this._placed) {
        this._placed = true;
        this._placedCount++;
        this._showToast('Product placed! Pinch to resize, drag to rotate.', 'check-circle');
        this._updatePlacedCount();
      }
    });

    // Touch gestures
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this._pinchStart = Math.hypot(dx, dy);
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this._pinchStart) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        this._scaleValue = Math.max(0.3, Math.min(3, this._scaleValue * (dist / this._pinchStart)));
        this._pinchStart = dist;
      } else if (e.touches.length === 1 && this._placed) {
        this._rotateAngle = (this._rotateAngle + 1) % 360;
      }
    }, { passive: true });

    canvas.addEventListener('touchend', () => { this._pinchStart = null; }, { passive: true });
  }

  _updatePlacedCount() {
    const el = document.getElementById('ar-placed-count');
    if (el) el.textContent = this._placedCount;
  }

  /* ─────────────────────────────────────────────────────────────────────
     UI helpers
  ───────────────────────────────────────────────────────────────────── */

  _renderProductInfo(product) {
    const nameEl  = document.getElementById('ar-product-name');
    const priceEl = document.getElementById('ar-product-price');
    const dimEl   = document.getElementById('ar-product-dimensions');
    if (nameEl)  nameEl.textContent  = product.name  || '';
    if (priceEl) priceEl.textContent = product.price ? `$${parseFloat(product.price).toFixed(2)}` : '';
    if (dimEl)   dimEl.textContent   = product.dimensions || '';
  }

  _updateARButton(isActive) {
    const btn = document.getElementById('btn-start-ar');
    if (!btn) return;
    btn.innerHTML = isActive
      ? '<i class="fas fa-xmark"></i> Exit AR'
      : '<i class="fas fa-camera"></i> View in AR';
    btn.dataset.arActive = isActive ? '1' : '0';
  }

  _showToast(msg, icon = 'check') {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,.85);color:#fff;padding:10px 24px;border-radius:20px;
      font-size:.85rem;font-weight:600;z-index:9999;max-width:90vw;text-align:center`;
    t.innerHTML = `<i class="fas fa-${icon}" style="margin-right:8px;color:#0052CC"></i>${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  _log(msg) {
    console.info('[ARProductViewer]', msg);
  }
}

window.ARProductViewer = ARProductViewer;
