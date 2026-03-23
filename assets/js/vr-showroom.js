/**
 * VR Showroom – GlobexSky
 * Handles VR scene rendering, navigation controls, product interaction,
 * and multi-user session management using CSS 3D transforms as a
 * progressive-enhancement fallback when WebXR is unavailable.
 */

(function () {
  'use strict';

  /* ── Constants ── */
  const VR_SUPPORTED = 'xr' in navigator;
  const AUTO_ROTATE_SPEED = 0.3; // degrees per frame

  /* ── State ── */
  const state = {
    isVRMode: false,
    rotY: 0,
    rotX: 0,
    zoom: 1,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    autoRotate: true,
    activeProduct: null,
    users: [],
    animFrame: null,
  };

  /* ── Sample product data ── */
  const vrProducts = [
    { id: 1, name: 'Industrial Motor',  icon: '⚙️',  price: '$420', moq: '50 units', category: 'Machinery' },
    { id: 2, name: 'LED Panel 60W',     icon: '💡',  price: '$18',  moq: '200 units', category: 'Lighting' },
    { id: 3, name: 'Safety Helmet',     icon: '⛑️',  price: '$8',   moq: '500 units', category: 'Safety' },
    { id: 4, name: 'Circuit Board',     icon: '🔌',  price: '$55',  moq: '100 units', category: 'Electronics' },
    { id: 5, name: 'Hydraulic Pump',    icon: '🔧',  price: '$280', moq: '20 units',  category: 'Hydraulics' },
  ];

  /* ── Sample visitor data ── */
  const mockUsers = [
    { name: 'Alex T.', color: '#0052CC', role: 'Buyer' },
    { name: 'Sam K.', color: '#7c3aed', role: 'Supplier' },
    { name: 'Jun L.', color: '#10b981', role: 'Buyer' },
  ];

  /* ── DOM helpers ── */
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  /* ── Toast helper ── */
  function showToast(msg, icon) {
    const toast = qs('#vr-toast');
    if (!toast) return;
    qs('#vr-toast-text', toast).textContent = msg;
    if (icon) qs('#vr-toast-icon', toast).className = `fas fa-${icon}`;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  /* ── Scene rotation (CSS 3D) ── */
  function applyTransform() {
    const scene = qs('#vr-scene-inner');
    if (!scene) return;
    scene.style.transform = `rotateX(${state.rotX}deg) rotateY(${state.rotY}deg)`;
  }

  function startAutoRotate() {
    state.autoRotate = true;
    (function tick() {
      if (!state.autoRotate || state.isDragging) { state.animFrame = requestAnimationFrame(tick); return; }
      state.rotY = (state.rotY + AUTO_ROTATE_SPEED) % 360;
      applyTransform();
      state.animFrame = requestAnimationFrame(tick);
    })();
  }

  function stopAutoRotate() {
    state.autoRotate = false;
  }

  /* ── Drag / touch controls ── */
  function onPointerDown(e) {
    state.isDragging = true;
    state.lastX = e.clientX ?? e.touches[0].clientX;
    state.lastY = e.clientY ?? e.touches[0].clientY;
  }

  function onPointerMove(e) {
    if (!state.isDragging) return;
    const x = e.clientX ?? e.touches[0].clientX;
    const y = e.clientY ?? e.touches[0].clientY;
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    state.rotY += dx * 0.4;
    state.rotX = Math.max(-30, Math.min(30, state.rotX - dy * 0.3));
    state.lastX = x;
    state.lastY = y;
    applyTransform();
  }

  function onPointerUp() {
    state.isDragging = false;
  }

  /* ── Bind drag events ── */
  function bindDrag(el) {
    if (!el) return;
    el.addEventListener('mousedown', onPointerDown);
    el.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
  }

  /* ── Navigation controls ── */
  function moveForward() { showToast('Moving forward…', 'walking'); }
  function moveBack()    { showToast('Moving back…',    'undo');    }
  function turnLeft()    { state.rotY -= 45; applyTransform(); }
  function turnRight()   { state.rotY += 45; applyTransform(); }
  function teleport(location) { showToast(`Teleporting to: ${location}`, 'location-dot'); }

  /* ── Product interaction ── */
  function selectProduct(id) {
    const product = vrProducts.find(p => p.id === id);
    if (!product) return;
    state.activeProduct = product;

    const panel = qs('#vr-product-panel');
    if (panel) {
      qs('#vr-prod-name',     panel).textContent = product.name;
      qs('#vr-prod-category', panel).textContent = product.category;
      qs('#vr-prod-price',    panel).textContent = product.price;
      qs('#vr-prod-moq',      panel).textContent = product.moq;
      panel.classList.add('open');
    }
    showToast(`Inspecting: ${product.name}`, 'cube');
  }

  function closeProductPanel() {
    const panel = qs('#vr-product-panel');
    if (panel) panel.classList.remove('open');
    state.activeProduct = null;
  }

  function addToCartFromVR() {
    if (!state.activeProduct) return;
    showToast(`${state.activeProduct.name} added to cart!`, 'cart-shopping');
    closeProductPanel();
  }

  /* ── Multi-user session ── */
  function renderUsers() {
    const container = qs('#vr-users-list');
    if (!container) return;
    container.innerHTML = mockUsers.map(u => `
      <div class="vr-user-item">
        <div class="vr-avatar" style="background:${u.color}">${u.name.charAt(0)}</div>
        <div>
          <div style="font-size:.82rem;font-weight:600;color:#0a0e27">${u.name}</div>
          <div style="font-size:.72rem;color:#64748b">${u.role}</div>
        </div>
        <div class="vr-mode-dot" style="margin-left:auto"></div>
      </div>
    `).join('');
    state.users = mockUsers;
  }

  /* ── WebXR entry ── */
  async function enterWebXR() {
    if (!VR_SUPPORTED) {
      showToast('WebXR not supported on this device. Using simulated VR.', 'exclamation-triangle');
      return enableSimulatedVR();
    }
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-vr');
      if (!supported) {
        showToast('Immersive VR not available. Using simulated VR.', 'exclamation-triangle');
        return enableSimulatedVR();
      }
      const session = await navigator.xr.requestSession('immersive-vr');
      session.addEventListener('end', () => { state.isVRMode = false; updateVRToggle(); });
      state.isVRMode = true;
      updateVRToggle();
      showToast('VR session started! Put on your headset.', 'vr-cardboard');
    } catch (err) {
      showToast('Could not start VR: ' + err.message, 'exclamation-circle');
      enableSimulatedVR();
    }
  }

  function enableSimulatedVR() {
    state.isVRMode = true;
    updateVRToggle();
    const wrap = qs('#vr-showroom-wrap');
    if (wrap) wrap.classList.add('simulated-vr');
    showToast('Simulated VR mode active. Drag to look around.', 'vr-cardboard');
  }

  function exitVR() {
    state.isVRMode = false;
    updateVRToggle();
    const wrap = qs('#vr-showroom-wrap');
    if (wrap) wrap.classList.remove('simulated-vr');
    showToast('Exited VR mode.', 'sign-out-alt');
  }

  function updateVRToggle() {
    const btn = qs('#btn-toggle-vr');
    if (!btn) return;
    btn.innerHTML = state.isVRMode
      ? '<i class="fas fa-times"></i> Exit VR'
      : '<i class="fas fa-vr-cardboard"></i> Enter VR';
    btn.classList.toggle('btn-vr-accent',   !state.isVRMode);
    btn.classList.toggle('btn-vr-outline',   state.isVRMode);
  }

  /* ── Request meeting in VR ── */
  function scheduleMeeting() {
    const modal = qs('#vr-meeting-modal');
    if (modal) modal.classList.add('open');
  }

  function closeModal(id) {
    const modal = qs(id);
    if (modal) modal.classList.remove('open');
  }

  function submitMeeting(e) {
    e.preventDefault();
    closeModal('#vr-meeting-modal');
    showToast('Meeting request sent! Supplier will confirm shortly.', 'check-circle');
  }

  /* ── Bind global buttons ── */
  function bindButtons() {
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-vr-action]');
      if (!btn) return;
      const action = btn.dataset.vrAction;
      switch (action) {
        case 'enter-vr':       enterWebXR(); break;
        case 'exit-vr':        exitVR(); break;
        case 'toggle-vr':      state.isVRMode ? exitVR() : enterWebXR(); break;
        case 'move-forward':   moveForward(); break;
        case 'move-back':      moveBack(); break;
        case 'turn-left':      turnLeft(); break;
        case 'turn-right':     turnRight(); break;
        case 'select-product': selectProduct(Number(btn.dataset.id)); break;
        case 'close-product':  closeProductPanel(); break;
        case 'add-to-cart':    addToCartFromVR(); break;
        case 'schedule-meeting': scheduleMeeting(); break;
        case 'teleport':       teleport(btn.dataset.location || 'main hall'); break;
        case 'close-modal':    closeModal(btn.dataset.target); break;
        case 'toggle-rotate':
          state.autoRotate ? stopAutoRotate() : startAutoRotate();
          btn.classList.toggle('active');
          break;
      }
    });
  }

  /* ── Init ── */
  function init() {
    bindDrag(qs('#vr-showroom-wrap'));
    bindButtons();
    renderUsers();
    startAutoRotate();

    // Show device capability banner
    const banner = qs('#vr-capability-banner');
    if (banner) {
      banner.textContent = VR_SUPPORTED
        ? '✅ WebXR is supported on this device – full VR experience available.'
        : '⚠️ WebXR not detected – using simulated 3D showroom view.';
      banner.className = VR_SUPPORTED ? 'ar-support-badge supported' : 'ar-support-badge unsupported';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ── */
  window.VRShowroom = { enterWebXR, exitVR, selectProduct, teleport, scheduleMeeting };
})();
