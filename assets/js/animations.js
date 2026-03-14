/**
 * GlobexSky - animations.js
 * Door/reveal entrance animation for the landing page.
 * Handles door-open sequence, skip button, session caching,
 * and prefers-reduced-motion respect.
 */

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

/** Immediately reveal main content, bypassing the door animation. */
function skipToContent() {
  const doorWrapper = document.querySelector('.door-wrapper');
  const doorLeft = document.querySelector('.door-left');
  const doorRight = document.querySelector('.door-right');
  const mainContent = document.querySelector('.main-content');
  const loader = document.querySelector('.door-loader, .page-loader');

  // Remove door elements from view instantly
  if (doorWrapper) {
    doorWrapper.classList.add('door-skip');
    doorWrapper.style.transition = 'none';
    doorWrapper.style.opacity = '0';
    doorWrapper.style.pointerEvents = 'none';
    setTimeout(() => doorWrapper.remove(), 50);
  }

  [doorLeft, doorRight].forEach((el) => {
    if (el) {
      el.style.transition = 'none';
      el.classList.add('door-open');
    }
  });

  if (loader) loader.remove();

  // Show main content
  document.body.classList.add('page-revealed');
  if (mainContent) {
    mainContent.classList.remove('hidden');
    mainContent.removeAttribute('hidden');
  }
}

/** Run the full door-open animation sequence. */
function runDoorAnimation() {
  const doorWrapper = document.querySelector('.door-wrapper');
  const doorLeft = document.querySelector('.door-left');
  const doorRight = document.querySelector('.door-right');
  const mainContent = document.querySelector('.main-content');

  // Start opening the doors after a short delay so the user
  // registers the closed state first.
  setTimeout(() => {
    if (doorWrapper) {
      doorWrapper.classList.add('door-open');
    }

    // Also target individual door panels if present
    if (doorLeft) doorLeft.classList.add('door-open');
    if (doorRight) doorRight.classList.add('door-open');
  }, 200);

  // After the CSS transition finishes (~2 s), reveal page content
  setTimeout(() => {
    document.body.classList.add('page-revealed');

    if (mainContent) {
      mainContent.classList.remove('hidden');
      mainContent.removeAttribute('hidden');
    }

    // Fade out the door overlay entirely
    if (doorWrapper) {
      doorWrapper.addEventListener(
        'transitionend',
        () => {
          doorWrapper.style.pointerEvents = 'none';
          doorWrapper.setAttribute('aria-hidden', 'true');
        },
        { once: true }
      );
      doorWrapper.classList.add('door-complete');
    }

    // Mark session so the animation is skipped on page refreshes
    try {
      sessionStorage.setItem('skipDoor', '1');
    } catch (_) {
      // sessionStorage may be unavailable in private browsing on some browsers
    }
  }, 2200); // 200 ms delay + 2000 ms animation
}

/* ─────────────────────────────────────────────
   SKIP BUTTON
───────────────────────────────────────────── */
function initSkipButton() {
  const skipBtn = document.getElementById('skip-animation');
  if (!skipBtn) return;

  skipBtn.addEventListener('click', (e) => {
    e.preventDefault();
    skipToContent();
  });

  // Also allow keyboard users to skip with Enter / Space
  skipBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      skipToContent();
    }
  });
}

/* ─────────────────────────────────────────────
   MAIN INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Skip if reduced-motion preference is set
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    skipToContent();
    return;
  }

  // 2. Skip if the user has already seen the animation this session
  let skipDoor = false;
  try {
    skipDoor = sessionStorage.getItem('skipDoor') === '1';
  } catch (_) {
    // Ignore
  }

  if (skipDoor) {
    skipToContent();
    return;
  }

  // 3. No door elements in DOM — nothing to animate
  const hasDoor =
    document.querySelector('.door-wrapper') ||
    document.querySelector('.door-left') ||
    document.querySelector('.door-right');

  if (!hasDoor) {
    // Ensure main content is visible regardless
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('hidden');
      mainContent.removeAttribute('hidden');
    }
    document.body.classList.add('page-revealed');
    return;
  }

  // 4. Wire up the skip button before the animation starts
  initSkipButton();

  // 5. Run the entrance animation
  runDoorAnimation();
});

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};
Object.assign(window.GlobexSky, {
  skipToContent,
  runDoorAnimation,
});
