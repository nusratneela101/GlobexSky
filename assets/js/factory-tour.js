/**
 * Factory Tour – GlobexSky
 * Implements 360° panoramic factory tour with:
 * - Interactive hotspots for equipment/processes
 * - Guided tour mode with narration simulation
 * - Tour scheduling system
 * - Mouse/touch drag navigation
 * - Keyboard arrow-key support
 */

(function () {
  'use strict';

  /* ── Tour stops data ── */
  const TOUR_STOPS = [
    {
      id: 'reception',
      name: 'Reception',
      description: 'Welcome to our state-of-the-art manufacturing facility. Established in 2005, we produce precision industrial components for global markets.',
      bg: 'linear-gradient(135deg,#1a237e 0%,#0d47a1 40%,#1565c0 100%)',
      hotspots: [
        { id: 'hs1', label: 'Information Desk',   icon: 'info-circle',   top: '45%', left: '30%', detail: 'Our team of 12 export specialists handle inquiries in 8 languages 24/7.' },
        { id: 'hs2', label: 'Certificate Display', icon: 'certificate',   top: '35%', left: '65%', detail: 'ISO 9001:2015 certified. View 24 quality & compliance certificates.' },
        { id: 'hs3', label: 'Factory Overview Map',icon: 'map',           top: '60%', left: '50%', detail: '120,000 sqm facility across 3 buildings. 2,400 employees.' },
      ],
    },
    {
      id: 'raw-materials',
      name: 'Raw Materials',
      description: 'Our raw materials warehouse maintains a 90-day supply buffer. All incoming materials undergo rigorous quality testing before production.',
      bg: 'linear-gradient(135deg,#37474f 0%,#546e7a 40%,#78909c 100%)',
      hotspots: [
        { id: 'hs4', label: 'Material Testing Lab',  icon: 'flask',          top: '40%', left: '20%', detail: 'X-ray fluorescence & spectral analysis for every batch.' },
        { id: 'hs5', label: 'Steel Storage',          icon: 'industry',       top: '55%', left: '55%', detail: '800 tons of graded steel alloys. ASTM/DIN certified.' },
        { id: 'hs6', label: 'Inventory System',       icon: 'boxes',          top: '38%', left: '75%', detail: 'Real-time ERP tracking. Zero stock-outs in 3 years.' },
      ],
    },
    {
      id: 'production',
      name: 'Production Floor',
      description: 'The heart of our operation — 48 CNC machining centres running 24/7, capable of tolerances down to ±0.01 mm.',
      bg: 'linear-gradient(135deg,#1b5e20 0%,#2e7d32 40%,#388e3c 100%)',
      hotspots: [
        { id: 'hs7', label: 'CNC Machining Centre', icon: 'cogs',           top: '42%', left: '25%', detail: '48 × 5-axis CNC machines. Cycle time: 4–12 min per part.' },
        { id: 'hs8', label: 'Assembly Line A',       icon: 'layer-group',    top: '50%', left: '50%', detail: 'Automated assembly with vision-based QC. 99.97% pass rate.' },
        { id: 'hs9', label: 'Robotic Welding Bay',   icon: 'robot',          top: '38%', left: '70%', detail: '16 robotic welding cells. AWS & EN 287 certified operators.' },
      ],
    },
    {
      id: 'quality',
      name: 'Quality Control',
      description: 'Every unit passes our 47-point inspection checklist before packaging. Third-party audits are welcome and encouraged.',
      bg: 'linear-gradient(135deg,#4a148c 0%,#6a1b9a 40%,#7b1fa2 100%)',
      hotspots: [
        { id: 'hs10', label: 'CMM Inspection Room',  icon: 'ruler-combined', top: '44%', left: '22%', detail: 'Zeiss CONTURA CMM. Accuracy ±0.001 mm. Climate-controlled.' },
        { id: 'hs11', label: 'Fatigue Testing Rig',  icon: 'tachometer-alt', top: '52%', left: '52%', detail: '10 million cycle simulation. ASTM E466 protocol.' },
        { id: 'hs12', label: 'Sample Archive',        icon: 'archive',        top: '36%', left: '72%', detail: 'Physical samples retained 5 years. Full traceability.' },
      ],
    },
    {
      id: 'packaging',
      name: 'Packaging & Dispatch',
      description: 'Automated packaging lines handle 15,000 units/day. Export-grade palletising for sea, air, and rail freight.',
      bg: 'linear-gradient(135deg,#b71c1c 0%,#c62828 40%,#d32f2f 100%)',
      hotspots: [
        { id: 'hs13', label: 'Palletising Robot',    icon: 'boxes',          top: '46%', left: '28%', detail: 'KUKA KR60 robots. 15,000 units/day throughput.' },
        { id: 'hs14', label: 'Export Labelling',      icon: 'tag',            top: '40%', left: '55%', detail: 'HS code, CE/UL/RoHS marks auto-printed & verified.' },
        { id: 'hs15', label: 'Dispatch Tracking',     icon: 'truck',          top: '58%', left: '72%', detail: 'Live GPS tracking from factory to port. API-connected with 12 carriers.' },
      ],
    },
  ];

  /* ── State ── */
  const state = {
    currentStop: 0,
    panX: 0,
    isDragging: false,
    lastX: 0,
    autoPlay: false,
    autoPlayTimer: null,
    autoPlayDelay: 8000,
    narrating: false,
    narrationIdx: 0,
  };

  /* ── DOM helpers ── */
  function qs(sel, ctx)  { return (ctx || document).querySelector(sel);   }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  /* ── Toast ── */
  function showToast(msg, icon) {
    const toast = qs('#tour-toast');
    if (!toast) return;
    qs('#tour-toast-text', toast).textContent = msg;
    if (icon) qs('#tour-toast-icon', toast).className = `fas fa-${icon}`;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 4000);
  }

  /* ── Render panorama background ── */
  function renderPanorama(stop) {
    const pano = qs('#tour-pano');
    if (pano) pano.style.background = stop.bg;
    // Reset pan position on stop change
    state.panX = 0;
    applyPan();
  }

  /* ── Apply pan transform ── */
  function applyPan() {
    const pano = qs('#tour-pano');
    if (pano) pano.style.backgroundPosition = `${state.panX % 100}% 50%`;
    // Pan the hotspot container
    const hs = qs('#tour-hotspots');
    if (hs) hs.style.transform = `translateX(${state.panX * 0.5}px)`;
  }

  /* ── Render hotspots ── */
  function renderHotspots(stop) {
    const container = qs('#tour-hotspots');
    if (!container) return;
    container.innerHTML = stop.hotspots.map(h => `
      <div class="tour-hotspot" style="top:${h.top};left:${h.left}" data-hs="${h.id}"
           title="${h.label}" onclick="FactoryTour.showHotspot('${h.id}')">
        <div class="tour-hotspot-ring">
          <i class="fas fa-${h.icon}"></i>
        </div>
        <div class="tour-hotspot-label">${h.label}</div>
      </div>`).join('');
  }

  /* ── Render stop info ── */
  function renderStopInfo(stop) {
    const nameEl = qs('#tour-stop-name');
    const descEl = qs('#tour-stop-desc');
    if (nameEl) nameEl.textContent = stop.name;
    if (descEl) descEl.textContent = stop.description;

    const counter = qs('#tour-stop-counter');
    if (counter) counter.textContent = `${state.currentStop + 1} / ${TOUR_STOPS.length}`;
  }

  /* ── Update progress bar ── */
  function updateProgress() {
    const stops = qsa('.tour-stop');
    stops.forEach((el, i) => {
      el.classList.toggle('active', i === state.currentStop);
      el.classList.toggle('completed', i < state.currentStop);
    });

    const bar = qs('#tour-stops-progress');
    if (bar) {
      const pct = state.currentStop / (TOUR_STOPS.length - 1) * 100;
      bar.style.width = `${pct}%`;
    }
  }

  /* ── Go to stop ── */
  function goToStop(idx) {
    if (idx < 0 || idx >= TOUR_STOPS.length) return;
    state.currentStop = idx;
    const stop = TOUR_STOPS[idx];
    renderPanorama(stop);
    renderHotspots(stop);
    renderStopInfo(stop);
    updateProgress();

    // Update prev/next buttons
    const prevBtn = qs('#btn-prev-stop');
    const nextBtn = qs('#btn-next-stop');
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.textContent = idx === TOUR_STOPS.length - 1 ? '✅ Complete Tour' : 'Next →';
  }

  /* ── Show hotspot detail ── */
  function showHotspot(id) {
    let hotspot = null;
    for (const stop of TOUR_STOPS) {
      hotspot = stop.hotspots.find(h => h.id === id);
      if (hotspot) break;
    }
    if (!hotspot) return;

    const modal = qs('#tour-hotspot-modal');
    if (modal) {
      qs('#hotspot-modal-title', modal).textContent = hotspot.label;
      qs('#hotspot-modal-body',  modal).textContent = hotspot.detail;
      modal.classList.add('open');
    }
  }

  /* ── Drag navigation ── */
  function onDragStart(e) {
    state.isDragging = true;
    state.lastX = e.clientX ?? e.touches?.[0].clientX ?? 0;
  }

  function onDragMove(e) {
    if (!state.isDragging) return;
    const x = e.clientX ?? e.touches?.[0].clientX ?? state.lastX;
    const dx = x - state.lastX;
    state.panX = Math.max(-200, Math.min(200, state.panX + dx * 0.5));
    state.lastX = x;
    applyPan();
  }

  function onDragEnd() { state.isDragging = false; }

  /* ── Keyboard navigation ── */
  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowLeft':  state.panX -= 20; applyPan(); break;
      case 'ArrowRight': state.panX += 20; applyPan(); break;
      case 'ArrowUp':
      case 'n':          nextStop(); break;
      case 'ArrowDown':
      case 'p':          prevStop(); break;
    }
  }

  /* ── Guided narration ── */
  const narrationLines = [
    '🏭 Welcome to our factory tour. Use arrow keys or drag to look around.',
    '🔍 Click on the glowing hotspots to learn about each area.',
    '⏭️ Use "Next" to advance through the tour stops.',
    '📅 Book a live virtual tour to speak directly with our engineers.',
  ];

  function startNarration() {
    if (state.narrating) return;
    state.narrating = true;
    state.narrationIdx = 0;
    (function narrate() {
      if (!state.narrating || state.narrationIdx >= narrationLines.length) {
        state.narrating = false;
        return;
      }
      showToast(narrationLines[state.narrationIdx], 'volume-up');
      state.narrationIdx++;
      state.narrationTimer = setTimeout(narrate, 5000);
    })();
  }

  function stopNarration() {
    state.narrating = false;
    clearTimeout(state.narrationTimer);
    showToast('Narration stopped.', 'volume-mute');
  }

  /* ── Auto-play ── */
  function toggleAutoPlay() {
    state.autoPlay = !state.autoPlay;
    const btn = qs('#btn-auto-play');
    if (state.autoPlay) {
      showToast('Auto-play started. Tour advances every 8 seconds.', 'play');
      if (btn) btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
      state.autoPlayTimer = setInterval(() => {
        const next = (state.currentStop + 1) % TOUR_STOPS.length;
        goToStop(next);
      }, state.autoPlayDelay);
    } else {
      clearInterval(state.autoPlayTimer);
      showToast('Auto-play paused.', 'pause');
      if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Auto-play';
    }
  }

  /* ── Schedule tour form ── */
  function openScheduleModal() {
    const modal = qs('#tour-schedule-modal');
    if (modal) modal.classList.add('open');
  }

  function submitSchedule(e) {
    e.preventDefault();
    qs('#tour-schedule-modal')?.classList.remove('open');
    showToast('Tour request submitted! You\'ll receive a confirmation within 2 hours.', 'check-circle');
  }

  /* ── Navigation wrappers ── */
  function nextStop() {
    if (state.currentStop < TOUR_STOPS.length - 1) {
      goToStop(state.currentStop + 1);
    } else {
      showToast('🎉 Tour complete! You can now request a live virtual tour.', 'flag-checkered');
    }
  }

  function prevStop() { goToStop(state.currentStop - 1); }

  /* ── Bind events ── */
  function bindEvents() {
    const canvas = qs('#tour-canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', onDragStart);
      canvas.addEventListener('touchstart', onDragStart, { passive: true });
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('touchmove', onDragMove, { passive: true });
      window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchend', onDragEnd);
    }

    window.addEventListener('keydown', onKeyDown);

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-tour-action]');
      if (!btn) return;
      const action = btn.dataset.tourAction;
      switch (action) {
        case 'next':             nextStop(); break;
        case 'prev':             prevStop(); break;
        case 'go-stop':          goToStop(Number(btn.dataset.stop)); break;
        case 'toggle-autoplay':  toggleAutoPlay(); break;
        case 'start-narration':  startNarration(); break;
        case 'stop-narration':   stopNarration(); break;
        case 'schedule-tour':    openScheduleModal(); break;
        case 'submit-schedule':  submitSchedule(e); break;
        case 'close-modal':      qs(btn.dataset.target)?.classList.remove('open'); break;
      }
    });

    // Close modal on overlay click
    qsa('.vr-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
  }

  /* ── Build progress bar HTML ── */
  function buildProgressBar() {
    const container = qs('#tour-progress-stops');
    if (!container) return;
    container.innerHTML = TOUR_STOPS.map((stop, i) => `
      <div class="tour-stop" data-tour-action="go-stop" data-stop="${i}">
        <div class="tour-stop-dot">${i + 1}</div>
        <div class="tour-stop-name">${stop.name}</div>
      </div>`).join('');
  }

  /* ── Init ── */
  function init() {
    buildProgressBar();
    bindEvents();
    goToStop(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ── */
  window.FactoryTour = { goToStop, nextStop, prevStop, showHotspot, startNarration, openScheduleModal };
})();
