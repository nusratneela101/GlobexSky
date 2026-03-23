/**
 * Globex Sky Shared Navigation Component
 * Injects a consistent secondary nav with all major section links into every page.
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
    { href: 'pages/search/index.html',        icon: 'fa-search',        label: 'Search'        },
    { href: 'pages/product/index.html',        icon: 'fa-box',           label: 'Products'      },
    { href: 'pages/sourcing/index.html',       icon: 'fa-boxes',         label: 'Sourcing'      },
    { href: 'pages/supplier/index.html',       icon: 'fa-store',         label: 'Suppliers'     },
    { href: 'pages/shipment/index.html',       icon: 'fa-shipping-fast', label: 'Shipment'      },
    { href: 'pages/logistics/index.html',      icon: 'fa-route',         label: 'Logistics'     },
    { href: 'pages/trade-finance/index.html',  icon: 'fa-hand-holding-usd', label: 'Trade Finance' },
    { href: 'pages/dropshipping/index.html',   icon: 'fa-truck',         label: 'Dropshipping'  },
    { href: 'pages/livestream/index.html',     icon: 'fa-video',         label: 'Live Streams'  },
    { href: 'pages/communication/index.html',  icon: 'fa-comments',      label: 'Communication' },
    { href: 'pages/ai/index.html',             icon: 'fa-robot',         label: 'AI Tools'      },
    { href: 'pages/advertising/index.html',    icon: 'fa-bullhorn',      label: 'Advertising'   },
    { href: 'pages/campaigns/index.html',      icon: 'fa-tags',          label: 'Campaigns'     },
    { href: 'pages/flash-sales/index.html',    icon: 'fa-bolt',          label: 'Flash Sales'   },
    { href: 'pages/vr/index.html',             icon: 'fa-vr-cardboard',  label: 'VR Showroom'   },
    { href: 'pages/trade-shows/index.html',    icon: 'fa-handshake',     label: 'Trade Shows'   },
    { href: 'pages/meetings/index.html',       icon: 'fa-calendar-check', label: 'Meetings'     },
    { href: 'pages/loyalty/index.html',        icon: 'fa-star',          label: 'Loyalty'       },
    { href: 'pages/insights/index.html',       icon: 'fa-chart-bar',     label: 'Insights'      },
    { href: 'pages/gdpr/cookie-consent.html',  icon: 'fa-shield-alt',    label: 'GDPR'          },
    { href: 'pages/account/index.html',        icon: 'fa-user',          label: 'My Account'    },
    { href: 'pages/cart/index.html',           icon: 'fa-shopping-cart', label: 'Cart'          },
    { href: 'pages/admin/index.html',          icon: 'fa-cogs',          label: 'Admin'         }
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
