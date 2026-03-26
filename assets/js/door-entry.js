/**
 * GlobexSky — Door Entry Animation Controller
 * Exposes the GlobexSky.DoorEntry namespace with init(), skip(), replay()
 * methods. The core CSS transitions live in assets/css/door-entry.css and
 * assets/css/animations.css. The base animation logic lives in animations.js.
 *
 * This file wraps the existing animation system and adds:
 *   • GlobexSky.DoorEntry.init()    — start the animation (deferred to animations.js)
 *   • GlobexSky.DoorEntry.skip()    — immediately reveal page content
 *   • GlobexSky.DoorEntry.replay()  — clear session flag and replay animation
 *   • Escape-key global shortcut to skip
 */

/* ─────────────────────────────────────────────
   NAMESPACE BOOTSTRAP
───────────────────────────────────────────── */

window.GlobexSky = window.GlobexSky || {};

window.GlobexSky.DoorEntry = (function () {
  'use strict';

  var SESSION_KEY = 'skipDoor';

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */

  function _getElements() {
    return {
      doorEntry:   document.getElementById('door-entry'),
      doorWrapper: document.querySelector('.door-wrapper'),
      doorLeft:    document.querySelector('.door-left'),
      doorRight:   document.querySelector('.door-right'),
      mainContent: document.getElementById('main-content') ||
                   document.querySelector('.main-content'),
    };
  }

  function _revealContent() {
    var e = _getElements();
    document.body.classList.add('page-revealed');
    if (e.mainContent) {
      e.mainContent.removeAttribute('aria-hidden');
      e.mainContent.classList.remove('hidden');
      e.mainContent.removeAttribute('hidden');
      e.mainContent.style.display    = 'block';
      e.mainContent.style.opacity    = '1';
      e.mainContent.style.visibility = 'visible';
    }
  }

  function _hideDoorEntry() {
    var e = _getElements();
    if (e.doorEntry) {
      e.doorEntry.style.transition    = 'opacity 0.5s ease';
      e.doorEntry.style.opacity       = '0';
      e.doorEntry.style.pointerEvents = 'none';
      setTimeout(function () {
        if (e.doorEntry) {
          e.doorEntry.style.display = 'none';
          e.doorEntry.setAttribute('aria-hidden', 'true');
        }
      }, 500);
    }
    if (e.doorWrapper) {
      e.doorWrapper.classList.add('door-complete');
      e.doorWrapper.style.pointerEvents = 'none';
    }
  }

  function _markSessionSeen() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}
  }

  function _clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  /* ─────────────────────────────────────────────
     PUBLIC: skip()
  ───────────────────────────────────────────── */

  function skip() {
    // Delegate to animations.js skip handler if available
    if (typeof window.GlobexSky.skipToContent === 'function') {
      window.GlobexSky.skipToContent();
      return;
    }

    // Standalone fallback (when animations.js is not loaded)
    var e = _getElements();
    if (e.doorWrapper) {
      e.doorWrapper.style.transition    = 'none';
      e.doorWrapper.style.opacity       = '0';
      e.doorWrapper.style.pointerEvents = 'none';
    }
    if (e.doorEntry) {
      e.doorEntry.style.display       = 'none';
      e.doorEntry.style.pointerEvents = 'none';
    }
    _revealContent();
    _markSessionSeen();
  }

  /* ─────────────────────────────────────────────
     PUBLIC: init()
  ───────────────────────────────────────────── */

  /**
   * init() starts (or restarts) the door animation.
   * When animations.js is present it delegates to that module; otherwise it
   * runs a minimal standalone sequence using the CSS classes.
   */
  function init() {
    // If animations.js already manages the lifecycle, just ensure the
    // Escape-key handler is active and exit — animations.js handles the rest.
    if (typeof window.GlobexSky.runDoorAnimation === 'function') {
      _initEscapeKey();
      return;
    }

    // Standalone path (animations.js not loaded)
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      skip();
      return;
    }

    var skipFlag = false;
    try { skipFlag = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (_) {}
    if (skipFlag) { skip(); return; }

    var e = _getElements();
    if (!e.doorWrapper && !e.doorLeft) {
      _revealContent();
      return;
    }

    _initEscapeKey();

    // Open doors after a brief pause
    setTimeout(function () {
      if (e.doorWrapper) e.doorWrapper.classList.add('door-open');
    }, 800);

    // Listen for CSS transition end to reveal content
    var transTarget = e.doorLeft || e.doorRight || e.doorWrapper;
    if (transTarget) {
      transTarget.addEventListener('transitionend', function onEnd(ev) {
        if (ev.propertyName !== 'transform') return;
        // { once: true } automatically removes the listener; no manual removal needed
        _revealContent();
        _hideDoorEntry();
        _markSessionSeen();
      }, { once: true });
    }

    // Safety fallback
    setTimeout(function () {
      var mc = _getElements().mainContent;
      if (mc && (mc.getAttribute('aria-hidden') === 'true' ||
                 getComputedStyle(mc).visibility === 'hidden')) {
        skip();
      }
    }, 5000);
  }

  /* ─────────────────────────────────────────────
     PUBLIC: replay()
  ───────────────────────────────────────────── */

  function replay() {
    _clearSession();

    var e = _getElements();

    // Re-show door overlay
    if (e.doorEntry) {
      e.doorEntry.style.display       = '';
      e.doorEntry.style.opacity       = '';
      e.doorEntry.style.pointerEvents = '';
      e.doorEntry.removeAttribute('aria-hidden');
    }

    // Reset wrapper classes
    if (e.doorWrapper) {
      e.doorWrapper.classList.remove('door-open', 'door-complete', 'door-done');
      e.doorWrapper.style.transition    = '';
      e.doorWrapper.style.opacity       = '';
      e.doorWrapper.style.pointerEvents = '';
    }

    // Re-hide main content
    document.body.classList.remove('page-revealed');
    if (e.mainContent) {
      e.mainContent.setAttribute('aria-hidden', 'true');
      e.mainContent.style.opacity    = '';
      e.mainContent.style.visibility = '';
      e.mainContent.style.display    = '';
    }

    // Clear any existing safety timers
    if (window._doorSafetyTimer) {
      clearTimeout(window._doorSafetyTimer);
      window._doorSafetyTimer = null;
    }

    // Start animation after a paint frame
    setTimeout(function () {
      if (typeof window.GlobexSky.runDoorAnimation === 'function') {
        window.GlobexSky.runDoorAnimation();
      } else {
        init();
      }
    }, 50);
  }

  /* ─────────────────────────────────────────────
     ESCAPE KEY
  ───────────────────────────────────────────── */

  var _escRegistered = false;
  function _initEscapeKey() {
    if (_escRegistered) return;
    _escRegistered = true;
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onEsc);
        _escRegistered = false;
        skip();
      }
    });
  }

  /* ─────────────────────────────────────────────
     AUTO-INIT — register Escape key once DOM ready
  ───────────────────────────────────────────── */

  function _autoInit() {
    // If animations.js is present it owns the animation lifecycle;
    // door-entry.js only adds the Escape shortcut and the DoorEntry namespace.
    _initEscapeKey();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    setTimeout(_autoInit, 0);
  }

  return { init: init, skip: skip, replay: replay };

}());

