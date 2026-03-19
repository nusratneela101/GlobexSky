/**
 * GlobexSky - Shared Navbar Component
 *
 * Dynamically injects a consistent navbar and secondary navigation
 * into every page. Each page sets window.NAV_DEPTH before loading
 * this script to ensure correct relative paths:
 *   depth 0 → root  (index.html)
 *   depth 1 → pages/*.html
 *   depth 2 → pages/subdir/*.html
 *   depth 3 → pages/subdir/subdir/*.html
 *
 * Usage in each HTML page:
 *   <script>window.NAV_DEPTH = N;</script>
 *   <script src="PATH/assets/js/navbar.js"></script>
 */
(function () {
  'use strict';

  var depth = (typeof window.NAV_DEPTH !== 'undefined') ? window.NAV_DEPTH : 0;
  var p = ''; // path prefix
  for (var i = 0; i < depth; i++) { p += '../'; }

  var navHTML = [
    '<header class="site-header" role="banner">',
    '  <nav class="navbar" role="navigation" aria-label="Main navigation">',
    '    <div class="nav-container">',

    '      <!-- Logo -->',
    '      <a href="' + p + 'index.html" class="nav-logo" aria-label="GlobexSky Home">',
    '        <svg class="logo-icon" width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
    '          <circle cx="18" cy="18" r="17" stroke="#0052CC" stroke-width="2" fill="none"/>',
    '          <ellipse cx="18" cy="18" rx="8" ry="17" stroke="#0052CC" stroke-width="1.5" fill="none"/>',
    '          <line x1="1" y1="18" x2="35" y2="18" stroke="#0052CC" stroke-width="1.5"/>',
    '          <line x1="2" y1="11" x2="34" y2="11" stroke="#0052CC" stroke-width="1"/>',
    '          <line x1="2" y1="25" x2="34" y2="25" stroke="#0052CC" stroke-width="1"/>',
    '          <path d="M22 10 L30 14 L26 16 L28 24 L20 20 L22 10Z" fill="#FF6B35"/>',
    '        </svg>',
    '        <span class="logo-text">Globex<span class="logo-accent">Sky</span></span>',
    '      </a>',

    '      <!-- Search Bar -->',
    '      <div class="nav-search" role="search">',
    '        <div class="search-wrapper">',
    '          <input type="search" class="search-input" placeholder="Search products, suppliers, categories..." aria-label="Search products, suppliers, and categories" />',
    '          <div class="search-actions">',
    '            <button class="search-btn search-voice" aria-label="Voice search"><i class="fas fa-microphone" aria-hidden="true"></i></button>',
    '            <button class="search-btn search-image" aria-label="Image search"><i class="fas fa-camera" aria-hidden="true"></i></button>',
    '            <button class="search-btn search-submit" aria-label="Submit search"><i class="fas fa-search" aria-hidden="true"></i></button>',
    '          </div>',
    '        </div>',
    '      </div>',

    '      <!-- Nav Controls -->',
    '      <div class="nav-controls">',

    '        <!-- Language Switcher -->',
    '        <div id="lang-switcher-root" class="nav-lang-switcher" aria-label="Language switcher"></div>',

    '        <!-- Currency Selector -->',
    '        <div class="nav-select-group">',
    '          <label for="currency-select" class="sr-only">Currency</label>',
    '          <select id="currency-select" class="nav-select" aria-label="Select currency">',
    '            <option value="USD">$ USD</option>',
    '            <option value="EUR">\u20ac EUR</option>',
    '            <option value="GBP">\u00a3 GBP</option>',
    '            <option value="CNY">\u00a5 CNY</option>',
    '            <option value="AED">\u062f.\u0625 AED</option>',
    '          </select>',
    '        </div>',

    '        <!-- Auth Buttons -->',
    '        <a href="' + p + 'pages/auth/login.html" class="btn-nav btn-login">',
    '          <i class="fas fa-sign-in-alt" aria-hidden="true"></i><span>Login</span>',
    '        </a>',
    '        <a href="' + p + 'pages/auth/register.html" class="btn-nav btn-register">',
    '          <i class="fas fa-user-plus" aria-hidden="true"></i><span>Register</span>',
    '        </a>',

    '        <!-- Cart -->',
    '        <a href="' + p + 'pages/sourcing/cart.html" class="nav-cart" aria-label="Shopping cart">',
    '          <i class="fas fa-shopping-cart" aria-hidden="true"></i>',
    '          <span class="cart-badge" id="cart-count">0</span>',
    '        </a>',

    '        <!-- User Avatar Dropdown -->',
    '        <div class="nav-user-dropdown" id="user-dropdown">',
    '          <button class="user-avatar-btn" aria-haspopup="true" aria-expanded="false" aria-controls="user-menu" aria-label="User account menu">',
    '            <img src="https://ui-avatars.com/api/?name=Guest+User&background=0052CC&color=fff&size=36" alt="User avatar" class="user-avatar" width="36" height="36" />',
    '            <i class="fas fa-chevron-down" aria-hidden="true"></i>',
    '          </button>',
    '          <ul class="dropdown-menu" id="user-menu" role="menu" aria-label="User menu">',
    '            <li role="menuitem"><a href="' + p + 'pages/account/profile.html"><i class="fas fa-tachometer-alt" aria-hidden="true"></i> Dashboard</a></li>',
    '            <li role="menuitem"><a href="' + p + 'pages/account/orders.html"><i class="fas fa-box" aria-hidden="true"></i> My Orders</a></li>',
    '            <li role="menuitem"><a href="' + p + 'pages/account/wishlist.html"><i class="fas fa-heart" aria-hidden="true"></i> Wishlist</a></li>',
    '            <li role="menuitem"><a href="' + p + 'pages/account/settings.html"><i class="fas fa-cog" aria-hidden="true"></i> Settings</a></li>',
    '            <li class="dropdown-divider" role="separator"></li>',
    '            <li role="menuitem"><a href="' + p + 'pages/auth/login.html" class="logout-link"><i class="fas fa-sign-out-alt" aria-hidden="true"></i> Logout</a></li>',
    '          </ul>',
    '        </div>',

    '      </div><!-- /.nav-controls -->',

    '      <!-- Hamburger (mobile) -->',
    '      <button class="hamburger" id="hamburger-btn" aria-label="Toggle mobile menu" aria-expanded="false" aria-controls="mobile-nav">',
    '        <span class="hamburger-line"></span>',
    '        <span class="hamburger-line"></span>',
    '        <span class="hamburger-line"></span>',
    '      </button>',

    '    </div><!-- /.nav-container -->',

    '    <!-- Mobile Nav -->',
    '    <div class="mobile-nav" id="mobile-nav" aria-hidden="true">',
    '      <ul class="mobile-nav-list" role="list">',
    '        <li><a href="' + p + 'pages/sourcing/index.html"><i class="fas fa-boxes" aria-hidden="true"></i> Sourcing</a></li>',
    '        <li><a href="' + p + 'pages/shipment/index.html"><i class="fas fa-shipping-fast" aria-hidden="true"></i> Shipment</a></li>',
    '        <li><a href="' + p + 'pages/shipment/carry/index.html"><i class="fas fa-people-carry" aria-hidden="true"></i> Carry Service</a></li>',
    '        <li><a href="' + p + 'pages/dropshipping/dashboard.html"><i class="fas fa-truck" aria-hidden="true"></i> Dropshipping</a></li>',
    '        <li><a href="' + p + 'pages/supplier/dashboard.html"><i class="fas fa-store" aria-hidden="true"></i> Suppliers</a></li>',
    '        <li><a href="' + p + 'pages/livestream/watch.html"><i class="fas fa-video" aria-hidden="true"></i> Live Streams</a></li>',
    '        <li><a href="' + p + 'pages/auth/login.html" class="mobile-login"><i class="fas fa-sign-in-alt" aria-hidden="true"></i> Login</a></li>',
    '        <li><a href="' + p + 'pages/auth/register.html" class="mobile-register"><i class="fas fa-user-plus" aria-hidden="true"></i> Register</a></li>',
    '      </ul>',
    '    </div>',

    '  </nav><!-- /.navbar -->',

    '  <!-- Secondary Nav Bar -->',
    '  <div class="nav-secondary" role="navigation" aria-label="Category navigation">',
    '    <div class="nav-container">',
    '      <ul class="secondary-nav-list" role="list">',
    '        <li><a href="' + p + 'pages/sourcing/index.html"><i class="fas fa-boxes" aria-hidden="true"></i> Sourcing</a></li>',
    '        <li><a href="' + p + 'pages/shipment/index.html"><i class="fas fa-shipping-fast" aria-hidden="true"></i> Shipment</a></li>',
    '        <li><a href="' + p + 'pages/shipment/carry/index.html"><i class="fas fa-people-carry" aria-hidden="true"></i> Carry Service</a></li>',
    '        <li><a href="' + p + 'pages/dropshipping/dashboard.html"><i class="fas fa-truck" aria-hidden="true"></i> Dropshipping</a></li>',
    '        <li><a href="' + p + 'pages/supplier/dashboard.html"><i class="fas fa-store" aria-hidden="true"></i> Suppliers</a></li>',
    '        <li><a href="' + p + 'pages/livestream/watch.html"><i class="fas fa-video" aria-hidden="true"></i> Live Streams</a></li>',
    '        <li><a href="' + p + 'pages/trade-shows/schedule.html"><i class="fas fa-handshake" aria-hidden="true"></i> Trade Shows</a></li>',
    '        <li><a href="' + p + 'pages/sourcing/vr-showroom.html"><i class="fas fa-vr-cardboard" aria-hidden="true"></i> VR Showroom</a></li>',
    '        <li><a href="' + p + 'pages/sourcing/inspection.html"><i class="fas fa-search-plus" aria-hidden="true"></i> Inspection</a></li>',
    '        <li><a href="' + p + 'pages/api/index.html"><i class="fas fa-code" aria-hidden="true"></i> API Platform</a></li>',
    '      </ul>',
    '    </div>',
    '  </div>',

    '</header><!-- /.site-header -->'
  ].join('\n');

  function injectNavbar() {
    // On the homepage, navbar lives inside #main-content (door animation wrapper)
    var mainContent = document.getElementById('main-content');
    var target = mainContent || document.body;
    if (target) {
      target.insertAdjacentHTML('afterbegin', navHTML);
      initNavbarBehavior();
    }
  }

  function initNavbarBehavior() {
    // Hamburger / mobile menu toggle
    var hamburger = document.getElementById('hamburger-btn');
    var mobileNav = document.getElementById('mobile-nav');
    if (hamburger && mobileNav) {
      hamburger.addEventListener('click', function () {
        var isOpen = mobileNav.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', String(isOpen));
        mobileNav.setAttribute('aria-hidden', String(!isOpen));
      });
    }

    // User avatar dropdown toggle
    var userDropdown = document.getElementById('user-dropdown');
    if (userDropdown) {
      var avatarBtn = userDropdown.querySelector('.user-avatar-btn');
      if (avatarBtn) {
        avatarBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var isOpen = userDropdown.classList.toggle('open');
          avatarBtn.setAttribute('aria-expanded', String(isOpen));
        });
        document.addEventListener('click', function () {
          userDropdown.classList.remove('open');
          avatarBtn.setAttribute('aria-expanded', 'false');
        });
      }
    }

    // Highlight active secondary-nav link based on current URL
    var links = document.querySelectorAll('.secondary-nav-list a');
    var currentPath = window.location.pathname;
    for (var i = 0; i < links.length; i++) {
      var linkPath = links[i].getAttribute('href');
      if (linkPath && currentPath.indexOf(linkPath.replace(/^(\.\.\/)+/, '')) !== -1) {
        links[i].classList.add('active');
        break;
      }
    }
  }

  // Inject immediately if <body> is available (synchronous script in <body>),
  // otherwise wait for DOMContentLoaded (script in <head>)
  if (document.body) {
    injectNavbar();
  } else {
    document.addEventListener('DOMContentLoaded', injectNavbar);
  }
}());
