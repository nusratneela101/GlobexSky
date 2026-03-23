/**
 * Globex Sky - vr.js
 * VR/AR product viewer, factory tour 360°, and showroom navigation placeholders.
 * Uses A-Frame when available, with graceful fallback UI.
 */

/* ─────────────────────────────────────────────
   VR PRODUCT VIEWER
───────────────────────────────────────────── */
function initVRProductViewer() {
  const container = document.querySelector('.vr-product-viewer, [data-vr-product]');
  if (!container) return;

  const productId = new URLSearchParams(window.location.search).get('id')
    || container.dataset.productId;

  if (typeof AFRAME !== 'undefined') {
    // Fetch product 3D model URL if available
    fetchProduct3DModel(productId).then((modelUrl) => {
      container.innerHTML = `
        <a-scene embedded style="height:500px;width:100%">
          ${modelUrl
            ? `<a-entity gltf-model="${modelUrl}" position="0 0 -3" rotation="0 45 0" scale="1 1 1" animation="property:rotation;to:0 405 0;dur:8000;loop:true;easing:linear"></a-entity>`
            : `<a-box position="0 0 -4" rotation="0 45 0" color="#0d6efd" animation="property:rotation;to:0 405 0;dur:4000;loop:true;easing:linear" shadow></a-box>`
          }
          <a-sky color="#f0f4ff"></a-sky>
          <a-light type="ambient" color="#fff" intensity="0.5"></a-light>
          <a-light type="directional" color="#fff" intensity="0.8" position="-1 2 2"></a-light>
          <a-camera><a-cursor></a-cursor></a-camera>
        </a-scene>
        <div class="vr-controls d-flex gap-2 justify-content-center mt-3">
          <button class="btn btn-outline-primary btn-sm" id="vrRotateLeft"><i class="fas fa-undo"></i> Rotate Left</button>
          <button class="btn btn-outline-primary btn-sm" id="vrReset"><i class="fas fa-redo"></i> Reset</button>
          <button class="btn btn-outline-primary btn-sm" id="vrRotateRight">Rotate Right <i class="fas fa-redo"></i></button>
          <button class="btn btn-primary btn-sm" id="vrFullscreen"><i class="fas fa-expand me-1"></i>Fullscreen</button>
        </div>`;

      document.getElementById('vrFullscreen')?.addEventListener('click', () => {
        const scene = container.querySelector('a-scene');
        if (scene?.requestFullscreen) scene.requestFullscreen();
      });
    });
  } else {
    showVRFallback(container, 'product', productId);
  }
}

async function fetchProduct3DModel(productId) {
  if (!productId) return null;
  try {
    const res  = await fetch(`/api/v1/products/${productId}/3d-model`);
    const data = await res.json();
    return data.model_url || null;
  } catch (_) { return null; }
}

/* ─────────────────────────────────────────────
   FACTORY TOUR (360°)
───────────────────────────────────────────── */
function initFactoryTour() {
  const container = document.querySelector('.factory-tour-container, [data-factory-tour]');
  if (!container) return;

  const tourId = new URLSearchParams(window.location.search).get('id') || container.dataset.tourId;
  const scenes  = JSON.parse(container.dataset.scenes || '[]');
  let current   = 0;

  if (typeof AFRAME !== 'undefined') {
    const buildScene = (scene) => `
      <a-scene embedded style="height:500px;width:100%">
        <a-sky src="${scene.image || '/assets/images/factory-360.jpg'}" rotation="0 -130 0"></a-sky>
        ${(scene.hotspots || []).map((h, i) => `
          <a-sphere position="${h.position || '0 1 -3'}" radius="0.2" color="#0d6efd"
            class="clickable" data-hotspot-index="${i}"
            animation="property:scale;to:1.3 1.3 1.3;dur:500;loop:true;dir:alternate">
          </a-sphere>
          <a-text value="${h.label || ''}" position="${h.position || '0 1.5 -3'}" align="center" color="#000" width="3"></a-text>`
        ).join('')}
        <a-camera><a-cursor></a-cursor></a-camera>
      </a-scene>`;

    container.innerHTML = scenes.length
      ? buildScene(scenes[0]) + renderTourNav(scenes, 0)
      : `<a-scene embedded style="height:500px;width:100%">
           <a-sky src="/assets/images/factory-360.jpg" rotation="0 -130 0"></a-sky>
           <a-text value="GlobexSky Factory Tour" position="0 2 -4" color="#0d6efd" align="center" width="6"></a-text>
           <a-camera><a-cursor></a-cursor></a-camera>
         </a-scene>` + `<p class="text-muted text-center mt-2">Use mouse/touch to look around</p>`;

    // Navigation between scenes
    if (scenes.length > 1) {
      container.querySelector('[data-tour-prev]')?.addEventListener('click', () => {
        if (current > 0) { current--; updateScene(); }
      });
      container.querySelector('[data-tour-next]')?.addEventListener('click', () => {
        if (current < scenes.length - 1) { current++; updateScene(); }
      });

      function updateScene() {
        const sceneEl = container.querySelector('a-scene');
        if (sceneEl) sceneEl.querySelector('a-sky').setAttribute('src', scenes[current].image || '');
        container.querySelectorAll('.tour-dot').forEach((d, i) => d.classList.toggle('active', i === current));
      }
    }
  } else {
    showVRFallback(container, 'factory', tourId);
  }
}

function renderTourNav(scenes, current) {
  if (scenes.length <= 1) return '';
  return `
    <div class="tour-nav d-flex justify-content-center align-items-center gap-3 mt-3">
      <button class="btn btn-outline-primary btn-sm" data-tour-prev><i class="fas fa-chevron-left"></i></button>
      <div class="d-flex gap-2">
        ${scenes.map((_, i) => `<span class="tour-dot rounded-circle" style="width:10px;height:10px;background:${i === current ? '#0d6efd' : '#dee2e6'};cursor:pointer" data-scene-index="${i}"></span>`).join('')}
      </div>
      <button class="btn btn-outline-primary btn-sm" data-tour-next><i class="fas fa-chevron-right"></i></button>
    </div>`;
}

/* ─────────────────────────────────────────────
   VR SHOWROOM
───────────────────────────────────────────── */
function initVRShowroom() {
  const container = document.querySelector('.vr-showroom, [data-vr-showroom]');
  if (!container) return;

  const showroomId = new URLSearchParams(window.location.search).get('id') || container.dataset.showroomId;

  if (typeof AFRAME !== 'undefined') {
    container.innerHTML = `
      <a-scene embedded style="height:600px;width:100%">
        <a-sky color="#e8f0fe"></a-sky>
        <a-plane rotation="-90 0 0" width="20" height="20" color="#f8f9fa" shadow></a-plane>
        <!-- Sample products on display -->
        <a-box position="-3 0.5 -4" color="#0d6efd" shadow class="clickable" data-product="1"
          animation__hover="property:scale;to:1.1 1.1 1.1;startEvents:mouseenter;dur:200"
          animation__leave="property:scale;to:1 1 1;startEvents:mouseleave;dur:200">
        </a-box>
        <a-text value="Product A" position="-3 1.3 -4" align="center" color="#333" width="3"></a-text>
        <a-sphere position="0 0.75 -4" radius="0.75" color="#EF2D5E" shadow class="clickable" data-product="2"></a-sphere>
        <a-text value="Product B" position="0 1.7 -4" align="center" color="#333" width="3"></a-text>
        <a-cylinder position="3 0.75 -4" radius="0.5" height="1.5" color="#FFC65D" shadow class="clickable" data-product="3"></a-cylinder>
        <a-text value="Product C" position="3 1.7 -4" align="center" color="#333" width="3"></a-text>
        <a-light type="ambient" intensity="0.5"></a-light>
        <a-light type="directional" position="0 4 2" intensity="0.8"></a-light>
        <a-camera position="0 1.6 0"><a-cursor></a-cursor></a-camera>
      </a-scene>
      <p class="text-muted text-center mt-2 small">
        <i class="fas fa-info-circle me-1"></i>Click on products to view details. Use WASD keys to navigate.
      </p>`;

    // Handle product clicks in VR
    container.querySelectorAll('[data-product]').forEach((el) => {
      el.addEventListener('click', () => {
        const pid = el.getAttribute('data-product');
        window.location.href = `/pages/sourcing/product-detail.html?id=${pid}`;
      });
    });
  } else {
    showVRFallback(container, 'showroom', showroomId);
  }
}

/* ─────────────────────────────────────────────
   FALLBACK UI (when A-Frame not loaded)
───────────────────────────────────────────── */
function showVRFallback(container, type, id) {
  const titles  = { product: 'VR Product Viewer', factory: '360° Factory Tour', showroom: 'VR Showroom' };
  const icons   = { product: 'cube', factory: 'industry', showroom: 'store' };
  const links   = { product: `https://sketchfab.com/search?q=product`, factory: 'https://my.matterport.com', showroom: 'https://my.matterport.com' };

  container.innerHTML = `
    <div class="text-center py-5 px-4">
      <i class="fas fa-${icons[type] || 'vr-cardboard'} text-primary mb-3" style="font-size:4rem"></i>
      <h4>${titles[type] || 'VR Experience'}</h4>
      ${id ? `<p class="text-muted">ID: <code>${id}</code></p>` : ''}
      <p class="text-muted">This experience requires the <strong>A-Frame</strong> VR library.</p>
      <div class="d-flex gap-2 justify-content-center flex-wrap">
        <a href="${links[type] || '#'}" target="_blank" rel="noopener" class="btn btn-outline-primary">
          <i class="fas fa-external-link-alt me-1"></i>Open External Viewer
        </a>
        <button class="btn btn-primary" onclick="loadAFrame()">
          <i class="fas fa-vr-cardboard me-1"></i>Load VR Library
        </button>
      </div>
    </div>`;
}

function loadAFrame() {
  const existing = document.querySelector('script[src*="aframe"]');
  if (existing) return;
  const s = document.createElement('script');
  s.src = 'https://aframe.io/releases/1.5.0/aframe.min.js';
  s.onload = () => {
    if (typeof showToast === 'function') showToast('VR library loaded! Please reload the page.', 'success');
    setTimeout(() => window.location.reload(), 1500);
  };
  document.head.appendChild(s);
}

window.loadAFrame = loadAFrame;

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initVRProductViewer();
  initFactoryTour();
  initVRShowroom();
});
