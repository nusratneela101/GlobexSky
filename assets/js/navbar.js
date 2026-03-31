/**
 * Globex Sky Shared Secondary Navigation Component
 * Injects a consistent secondary nav with all 10 items into every page.
 * Base path is derived from this script's own URL so relative links always
 * resolve correctly regardless of the page's directory depth.
 */
(function () {
  'use strict';

  /* ── 1. Determine the site root from this script's src ── */
  var scriptEl = document.currentScript ||
    (function () {
      var tags = document.querySelectorAll('script[src*="navbar.js"]');
      return tags[tags.length - 1] || null;
    }());

  var base = '';
  if (scriptEl && scriptEl.src) {
    // Strip "assets/js/navbar.js" (plus any query string) from the full URL
    base = scriptEl.src.replace(/assets\/js\/navbar\.js(\?.*)?$/, '');
  }

  /* ── 2. Build the secondary nav HTML ── */
  var items = [
    { href: 'pages/sourcing/index.html',      icon: 'fa-boxes',       label: 'Sourcing'      },
    { href: 'pages/shipment/index.html',      icon: 'fa-shipping-fast', label: 'Shipment'     },
    { href: 'pages/shipment/carry/index.html',icon: 'fa-people-carry', label: 'Carry Service' },
    { href: 'pages/supplier/index.html',     icon: 'fa-store',        label: 'Suppliers'     },
    { href: 'pages/livestream/index.html',    icon: 'fa-video',        label: 'Live Streams'  },
    { href: 'pages/trade-shows/index.html',   icon: 'fa-handshake',    label: 'Trade Shows'   },
    { href: 'pages/sourcing/vr-showroom.html',icon: 'fa-vr-cardboard', label: 'VR Showroom'   },
    { href: 'pages/sourcing/inspection.html', icon: 'fa-search-plus',  label: 'Inspection'    },
    { href: 'pages/api/index.html',           icon: 'fa-code',         label: 'API Platform'  }
  ];

  var listHTML = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    listHTML +=
      '<li><a href="' + base + it.href + '">' +
        '<i class="fas ' + it.icon + '" aria-hidden="true"></i> ' + it.label +
      '</a></li>';
  }

  var navHTML =
    '<div class="nav-secondary" role="navigation" aria-label="Category navigation">' +
      '<div class="nav-container">' +
        '<ul class="secondary-nav-list" role="list">' +
          listHTML +
        '</ul>' +
      '</div>' +
    '</div>';

  /* ── 3. Inject the secondary nav ── */
  function inject() {
    // If an explicit placeholder exists, replace it.
    var placeholder = document.getElementById('secondary-nav-root');
    if (placeholder) {
      placeholder.outerHTML = navHTML;
      return;
    }

    // Otherwise look for a pre-existing hardcoded secondary nav and replace it.
    var existing = document.querySelector('.nav-secondary');
    if (existing) {
      existing.outerHTML = navHTML;
      return;
    }

    // As a last resort, append to the <header> element.
    var header = document.querySelector('header.site-header, header');
    if (header) {
      header.insertAdjacentHTML('beforeend', navHTML);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
}());
