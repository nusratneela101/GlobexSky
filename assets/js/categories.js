/**
 * Globex Sky - Category Sidebar & Drawer JS
 */

// Mobile category drawer
function openCatDrawer() {
  var drawer = document.getElementById('cat-drawer');
  var overlay = document.getElementById('cat-drawer-overlay');
  var btn = document.querySelector('.cat-mobile-btn');
  if (drawer) {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  if (overlay) overlay.classList.add('active');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('cat-drawer-open');
}

function closeCatDrawer() {
  var drawer = document.getElementById('cat-drawer');
  var overlay = document.getElementById('cat-drawer-overlay');
  var btn = document.querySelector('.cat-mobile-btn');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (overlay) overlay.classList.remove('active');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('cat-drawer-open');
}

// Desktop category mega-menu: toggle on click for touch/keyboard support
document.addEventListener('DOMContentLoaded', function () {
  // Show mobile categories button on small screens
  var mobileBtnWrap = document.getElementById('mobile-cat-btn-wrap');
  function checkMobile() {
    if (mobileBtnWrap) {
      mobileBtnWrap.style.display = window.innerWidth < 1024 ? 'block' : 'none';
    }
  }
  checkMobile();
  window.addEventListener('resize', checkMobile);

  // Desktop mega menu: open on hover (CSS handles this) + close on outside click
  var catItems = document.querySelectorAll('.cat-item');
  catItems.forEach(function (item) {
    var link = item.querySelector('.cat-item-link');
    var mega = item.querySelector('.cat-mega');
    if (!link || !mega) return;

    // On click, if the mega panel exists, prevent navigation and toggle panel instead
    link.addEventListener('click', function (e) {
      var isOpen = item.classList.contains('cat-active');
      // Close all
      catItems.forEach(function (ci) { ci.classList.remove('cat-active'); });
      if (!isOpen) {
        item.classList.add('cat-active');
        e.preventDefault(); // don't navigate, show submenu
      }
    });
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.homepage-cat-sidebar')) {
      catItems.forEach(function (ci) { ci.classList.remove('cat-active'); });
    }
  });

  // Escape key closes
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      catItems.forEach(function (ci) { ci.classList.remove('cat-active'); });
      closeCatDrawer();
    }
  });
});
