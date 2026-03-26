/**
 * Globex Sky — barcode-scanner.js
 *
 * Camera-based barcode and QR code scanner.
 * Primary: BarcodeDetector API (native browser)
 * Fallback: ZXing-js (browser build via CDN)
 *
 * Exposes: window.GlobexSky.BarcodeScanner
 * API:
 *   init(containerId, options) → instance
 *   start()
 *   stop()
 *   destroy()
 *   onScan(callback)
 */

(function (global) {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────────── */
  const SUPPORTED_FORMATS = [
    'ean_13', 'ean_8', 'upc_a', 'upc_e',
    'code_128', 'code_39', 'qr_code',
  ];

  // BarcodeDetector format names differ from display names
  const DETECTOR_FORMATS = [
    'ean_13', 'ean_8', 'upc_a', 'upc_e',
    'code_128', 'code_39', 'qr_code',
  ];

  const ZXING_CDN = 'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js';
  const RECENT_SCANS_KEY = 'globexsky_recent_scans';
  const MAX_RECENT_SCANS = 20;

  /* ── Helpers ────────────────────────────────────────────────────── */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(s);
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Recent Scans ───────────────────────────────────────────────── */

  const RecentScans = {
    get() {
      try { return JSON.parse(localStorage.getItem(RECENT_SCANS_KEY) || '[]'); }
      catch (_) { return []; }
    },
    add(code) {
      const scans = this.get().filter(s => s.code !== code);
      scans.unshift({ code, time: Date.now() });
      try { localStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(scans.slice(0, MAX_RECENT_SCANS))); }
      catch (_) {}
    },
    clear() {
      try { localStorage.removeItem(RECENT_SCANS_KEY); } catch (_) {}
    },
  };

  /* ── BarcodeScanner Factory ─────────────────────────────────────── */

  function createScanner(containerId, options) {
    const opts = Object.assign({
      onScanCallback: null,
      autoRedirect: true,
      searchBasePath: '/pages/search/index.html',
      vibrate: true,
      beep: true,
    }, options || {});

    let container = null;
    let videoEl = null;
    let canvasEl = null;
    let stream = null;
    let facingMode = 'environment';
    let torchOn = false;
    let scanning = false;
    let rafId = null;
    let detector = null;
    let zxingReader = null;
    let scanCallbacks = opts.onScanCallback ? [opts.onScanCallback] : [];
    let audioCtx = null;

    /* ─── DOM Build ───────────────────────────────────────────────── */

    function buildUI() {
      container = typeof containerId === 'string'
        ? document.getElementById(containerId)
        : containerId;
      if (!container) throw new Error(`BarcodeScanner: container "${containerId}" not found`);

      container.innerHTML = '';
      container.classList.add('gs-barcode-scanner');

      container.innerHTML = `
        <div class="gs-scanner-viewport">
          <video class="gs-scanner-video" playsinline autoplay muted></video>
          <canvas class="gs-scanner-canvas" aria-hidden="true"></canvas>
          <div class="gs-scanner-overlay">
            <div class="gs-scanner-frame">
              <div class="gs-scanner-line"></div>
              <span class="gs-scanner-corner gs-corner-tl"></span>
              <span class="gs-scanner-corner gs-corner-tr"></span>
              <span class="gs-scanner-corner gs-corner-bl"></span>
              <span class="gs-scanner-corner gs-corner-br"></span>
            </div>
          </div>
          <div class="gs-scanner-controls">
            <button class="gs-scanner-btn gs-btn-torch" title="Toggle torch" aria-label="Toggle torch" aria-pressed="false">
              <i class="fas fa-bolt"></i>
            </button>
            <button class="gs-scanner-btn gs-btn-switch" title="Switch camera" aria-label="Switch camera">
              <i class="fas fa-sync-alt"></i>
            </button>
            <button class="gs-scanner-btn gs-btn-gallery" title="Upload image" aria-label="Upload barcode image">
              <i class="fas fa-image"></i>
            </button>
          </div>
          <input type="file" class="gs-gallery-input" accept="image/*" aria-hidden="true" tabindex="-1"/>
          <div class="gs-scanner-status" role="status" aria-live="polite">Initializing camera…</div>
        </div>
        <div class="gs-scanner-result" hidden>
          <span class="gs-result-icon"><i class="fas fa-check-circle"></i></span>
          <span class="gs-result-code"></span>
          <button class="gs-result-dismiss" aria-label="Dismiss">✕</button>
        </div>
        <div class="gs-scanner-manual">
          <label for="gs-manual-input" class="gs-manual-label">Enter code manually</label>
          <div class="gs-manual-row">
            <input id="gs-manual-input" type="text" class="gs-manual-input"
              placeholder="EAN / UPC / SKU…" autocomplete="off" inputmode="text"/>
            <button class="gs-manual-submit"><i class="fas fa-search"></i></button>
          </div>
        </div>
      `;

      videoEl = container.querySelector('.gs-scanner-video');
      canvasEl = container.querySelector('.gs-scanner-canvas');

      // Controls
      container.querySelector('.gs-btn-torch').addEventListener('click', toggleTorch);
      container.querySelector('.gs-btn-switch').addEventListener('click', switchCamera);
      container.querySelector('.gs-btn-gallery').addEventListener('click', () => container.querySelector('.gs-gallery-input').click());
      container.querySelector('.gs-gallery-input').addEventListener('change', handleGalleryFile);
      container.querySelector('.gs-result-dismiss').addEventListener('click', () => container.querySelector('.gs-scanner-result').hidden = true);

      const manualInput = container.querySelector('.gs-manual-input');
      const manualSubmit = container.querySelector('.gs-manual-submit');
      manualSubmit.addEventListener('click', () => {
        const v = manualInput.value.trim();
        if (v) handleScan(v);
      });
      manualInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { const v = manualInput.value.trim(); if (v) handleScan(v); }
      });
    }

    /* ─── Camera ──────────────────────────────────────────────────── */

    async function openCamera() {
      setStatus('Requesting camera access…');
      try {
        if (stream) { stream.getTracks().forEach(t => t.stop()); }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        videoEl.srcObject = stream;
        await new Promise(resolve => { videoEl.onloadedmetadata = resolve; });
        await videoEl.play();
        setStatus('Point camera at a barcode…');
        return true;
      } catch (err) {
        const msg = err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera permission and try again.'
          : `Camera error: ${err.message}. Use manual entry below.`;
        setStatus(msg);
        return false;
      }
    }

    function closeCamera() {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      if (videoEl) { videoEl.srcObject = null; }
    }

    async function toggleTorch() {
      const btn = container.querySelector('.gs-btn-torch');
      if (!stream) return;
      const [track] = stream.getVideoTracks();
      if (!track || typeof track.applyConstraints !== 'function') {
        setStatus('Torch not supported on this device.');
        return;
      }
      try {
        torchOn = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: torchOn }] });
        btn.setAttribute('aria-pressed', String(torchOn));
        btn.classList.toggle('gs-btn-active', torchOn);
      } catch (_) {
        setStatus('Torch not available.');
        torchOn = false;
      }
    }

    async function switchCamera() {
      facingMode = facingMode === 'environment' ? 'user' : 'environment';
      stopScanning();
      await openCamera();
      startScanning();
    }

    /* ─── Detection Engine ────────────────────────────────────────── */

    async function initDetector() {
      // Prefer native BarcodeDetector
      if ('BarcodeDetector' in global) {
        try {
          const supported = await global.BarcodeDetector.getSupportedFormats();
          const formats = DETECTOR_FORMATS.filter(f => supported.includes(f));
          detector = new global.BarcodeDetector({ formats: formats.length ? formats : DETECTOR_FORMATS });
          return 'native';
        } catch (_) {}
      }

      // Fallback: ZXing
      try {
        await loadScript(ZXING_CDN);
        if (global.ZXing) {
          const hints = new global.ZXing.Map();
          hints.set(global.ZXing.DecodeHintType.POSSIBLE_FORMATS, [
            global.ZXing.BarcodeFormat.EAN_13,
            global.ZXing.BarcodeFormat.EAN_8,
            global.ZXing.BarcodeFormat.UPC_A,
            global.ZXing.BarcodeFormat.UPC_E,
            global.ZXing.BarcodeFormat.CODE_128,
            global.ZXing.BarcodeFormat.CODE_39,
            global.ZXing.BarcodeFormat.QR_CODE,
          ]);
          zxingReader = new global.ZXing.BrowserMultiFormatReader(hints);
          return 'zxing';
        }
      } catch (_) {}

      return null;
    }

    function startScanning() {
      if (scanning) return;
      scanning = true;
      rafId = requestAnimationFrame(scanLoop);
    }

    function stopScanning() {
      scanning = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    async function scanLoop() {
      if (!scanning || !videoEl || videoEl.readyState < 2) {
        if (scanning) rafId = requestAnimationFrame(scanLoop);
        return;
      }

      const w = videoEl.videoWidth;
      const h = videoEl.videoHeight;
      if (!w || !h) { if (scanning) rafId = requestAnimationFrame(scanLoop); return; }

      canvasEl.width = w;
      canvasEl.height = h;
      const ctx = canvasEl.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, w, h);

      try {
        let code = null;

        if (detector) {
          const results = await detector.detect(canvasEl);
          if (results && results.length > 0) code = results[0].rawValue;
        } else if (zxingReader) {
          const imgData = canvasEl.toDataURL('image/jpeg', 0.8);
          const result = await zxingReader.decodeFromImage(undefined, imgData).catch(() => null);
          if (result) code = result.getText();
        }

        if (code) {
          stopScanning();
          handleScan(code);
          return;
        }
      } catch (_) {}

      if (scanning) rafId = requestAnimationFrame(scanLoop);
    }

    /* ─── Gallery / File Upload ───────────────────────────────────── */

    async function handleGalleryFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });

      setStatus('Scanning image…');

      try {
        let code = null;

        if (detector) {
          const bitmap = await createImageBitmap(img);
          const results = await detector.detect(bitmap);
          if (results && results.length > 0) code = results[0].rawValue;
        } else if (zxingReader) {
          const imgUrl = img.src;
          const result = await zxingReader.decodeFromImage(undefined, imgUrl).catch(() => null);
          if (result) code = result.getText();
        }

        if (code) {
          handleScan(code);
        } else {
          setStatus('No barcode found in image. Try another image or manual entry.');
        }
      } catch (_) {
        setStatus('Could not decode image. Try manual entry below.');
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    /* ─── Scan Result ─────────────────────────────────────────────── */

    function handleScan(code) {
      // Feedback
      if (opts.vibrate && navigator.vibrate) navigator.vibrate(200);
      if (opts.beep) playBeep();

      // Store in recent
      RecentScans.add(code);

      // Show result overlay
      const resultEl = container.querySelector('.gs-scanner-result');
      const codeEl = container.querySelector('.gs-result-code');
      if (resultEl && codeEl) {
        codeEl.textContent = code;
        resultEl.hidden = false;
      }

      setStatus(`Scanned: ${escHtml(code)}`);

      // Fire callbacks
      scanCallbacks.forEach(cb => { try { cb(code); } catch (_) {} });

      // Auto-redirect
      if (opts.autoRedirect) {
        const url = `${opts.searchBasePath}?q=${encodeURIComponent(code)}&source=barcode`;
        setTimeout(() => { global.location.href = url; }, 600);
      }
    }

    /* ─── Beep ────────────────────────────────────────────────────── */

    function playBeep() {
      try {
        if (!audioCtx) audioCtx = new (global.AudioContext || global.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.value = 1800;
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
      } catch (_) {}
    }

    /* ─── Status ──────────────────────────────────────────────────── */

    function setStatus(msg) {
      const el = container && container.querySelector('.gs-scanner-status');
      if (el) el.textContent = msg;
    }

    /* ─── Public API ──────────────────────────────────────────────── */

    async function start() {
      const cameraOk = await openCamera();
      if (!cameraOk) return;

      const engine = await initDetector();
      if (!engine) {
        setStatus('Barcode detection not available. Please use manual entry below.');
        return;
      }

      startScanning();
    }

    function stop() {
      stopScanning();
      closeCamera();
    }

    function destroy() {
      stop();
      if (zxingReader) { try { zxingReader.reset(); } catch (_) {} zxingReader = null; }
      detector = null;
      scanCallbacks = [];
      if (container) { container.innerHTML = ''; container.classList.remove('gs-barcode-scanner'); }
    }

    function onScan(callback) {
      if (typeof callback === 'function') scanCallbacks.push(callback);
    }

    /* ─── Init ────────────────────────────────────────────────────── */

    buildUI();

    return { start, stop, destroy, onScan };
  }

  /* ── Namespace ──────────────────────────────────────────────────── */

  global.GlobexSky = global.GlobexSky || {};
  global.GlobexSky.BarcodeScanner = {
    /**
     * Create and initialise a scanner instance inside a given container element.
     *
     * @param {string|HTMLElement} containerId  ID string or DOM element.
     * @param {object}             [options]
     * @param {Function}           [options.onScanCallback]   Called with scanned code string.
     * @param {boolean}            [options.autoRedirect]     Navigate to search on scan (default true).
     * @param {string}             [options.searchBasePath]   Base path for search redirect.
     * @param {boolean}            [options.vibrate]          Vibrate on scan (default true).
     * @param {boolean}            [options.beep]             Beep on scan (default true).
     * @returns {{ start, stop, destroy, onScan }}
     */
    init: createScanner,

    /** Convenience: access recent scan history. */
    recentScans: RecentScans,

    /** Supported barcode format names. */
    supportedFormats: SUPPORTED_FORMATS,
  };

}(window));
