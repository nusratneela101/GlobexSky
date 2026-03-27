/**
 * GlobexSky — Freight Shipments Module
 * Handles freight dashboard, shipment list, booking form, and admin panel.
 * Uses localStorage with 'gsky_' prefix for demo data persistence.
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────
     DEMO DATA (localStorage persistence)
  ───────────────────────────────────────── */
  var LS_KEY = 'gsky_freight_shipments';
  var LS_TRACKING_KEY = 'gsky_freight_tracking';

  var DEMO_SHIPMENTS = [
    {
      id: 'fs-' + Date.now() + '-1',
      container_number: 'MSCU7284910',
      bill_of_lading: 'BOL-2026-00341',
      carrier_name: 'MSC Mediterranean',
      origin_port: 'Shanghai, China',
      destination_port: 'Rotterdam, Netherlands',
      departure_date: '2026-03-10T00:00:00.000Z',
      estimated_arrival: '2026-04-08T00:00:00.000Z',
      actual_arrival: null,
      status: 'in_transit',
      tracking_updates: [],
      freight_type: 'FCL',
      weight: 18400,
      volume: 28.5,
      customs_status: 'pending',
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '245 KB', uploaded_at: '2026-03-10T08:00:00.000Z' },
        { name: 'Commercial Invoice', type: 'pdf', size: '128 KB', uploaded_at: '2026-03-09T10:00:00.000Z' },
        { name: 'Packing List', type: 'pdf', size: '89 KB', uploaded_at: '2026-03-09T10:05:00.000Z' }
      ],
      created_at: '2026-03-09T08:00:00.000Z',
      updated_at: '2026-03-23T12:00:00.000Z'
    },
    {
      id: 'fs-' + Date.now() + '-2',
      container_number: 'HLCU3049271',
      bill_of_lading: 'BOL-2026-00287',
      carrier_name: 'HMM Ocean',
      origin_port: 'Busan, South Korea',
      destination_port: 'Los Angeles, USA',
      departure_date: '2026-03-05T00:00:00.000Z',
      estimated_arrival: '2026-03-25T00:00:00.000Z',
      actual_arrival: null,
      status: 'in_transit',
      tracking_updates: [],
      freight_type: 'FCL',
      weight: 22100,
      volume: 33.6,
      customs_status: 'pending',
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '234 KB', uploaded_at: '2026-03-05T08:00:00.000Z' }
      ],
      created_at: '2026-03-04T08:00:00.000Z',
      updated_at: '2026-03-21T08:00:00.000Z'
    },
    {
      id: 'fs-' + Date.now() + '-3',
      container_number: 'MAEU6140385',
      bill_of_lading: 'BOL-2026-00198',
      carrier_name: 'Maersk Line',
      origin_port: 'Hamburg, Germany',
      destination_port: 'Chittagong, Bangladesh',
      departure_date: '2026-02-28T00:00:00.000Z',
      estimated_arrival: '2026-03-28T00:00:00.000Z',
      actual_arrival: null,
      status: 'at_port',
      tracking_updates: [],
      freight_type: 'FCL',
      weight: 25800,
      volume: 38.2,
      customs_status: 'pending',
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '267 KB', uploaded_at: '2026-02-28T08:00:00.000Z' },
        { name: 'Import License', type: 'pdf', size: '198 KB', uploaded_at: '2026-02-25T08:00:00.000Z' }
      ],
      created_at: '2026-02-27T08:00:00.000Z',
      updated_at: '2026-03-27T08:00:00.000Z'
    },
    {
      id: 'fs-' + Date.now() + '-4',
      container_number: 'CMAU5293847',
      bill_of_lading: 'BOL-2026-00156',
      carrier_name: 'CMA CGM',
      origin_port: 'Shenzhen, China',
      destination_port: 'Dubai, UAE',
      departure_date: '2026-03-01T00:00:00.000Z',
      estimated_arrival: '2026-03-18T00:00:00.000Z',
      actual_arrival: null,
      status: 'customs',
      tracking_updates: [],
      freight_type: 'LCL',
      weight: 14200,
      volume: 22.1,
      customs_status: 'held',
      documents: [
        { name: 'Customs Declaration', type: 'pdf', size: '178 KB', uploaded_at: '2026-03-01T08:00:00.000Z' }
      ],
      created_at: '2026-02-28T08:00:00.000Z',
      updated_at: '2026-03-18T14:00:00.000Z'
    },
    {
      id: 'fs-' + Date.now() + '-5',
      container_number: 'APZU4883721',
      bill_of_lading: 'BOL-2026-00092',
      carrier_name: 'APL Global',
      origin_port: 'Mumbai, India',
      destination_port: 'Felixstowe, UK',
      departure_date: '2026-02-15T00:00:00.000Z',
      estimated_arrival: '2026-03-10T00:00:00.000Z',
      actual_arrival: '2026-03-09T14:22:00.000Z',
      status: 'delivered',
      tracking_updates: [],
      freight_type: 'FCL',
      weight: 19600,
      volume: 29.8,
      customs_status: 'cleared',
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '256 KB', uploaded_at: '2026-02-15T08:00:00.000Z' },
        { name: 'Delivery Receipt', type: 'pdf', size: '112 KB', uploaded_at: '2026-03-09T16:00:00.000Z' }
      ],
      created_at: '2026-02-14T08:00:00.000Z',
      updated_at: '2026-03-09T16:00:00.000Z'
    },
    {
      id: 'fs-' + Date.now() + '-6',
      container_number: null,
      bill_of_lading: 'AWB-2026-00441',
      carrier_name: 'Emirates SkyCargo',
      origin_port: 'Guangzhou, China',
      destination_port: 'Frankfurt, Germany',
      departure_date: '2026-03-20T00:00:00.000Z',
      estimated_arrival: '2026-03-22T00:00:00.000Z',
      actual_arrival: null,
      status: 'booked',
      tracking_updates: [],
      freight_type: 'air',
      weight: 3200,
      volume: 6.4,
      customs_status: 'pending',
      documents: [],
      created_at: '2026-03-19T08:00:00.000Z',
      updated_at: '2026-03-19T08:00:00.000Z'
    }
  ];

  var DEMO_TRACKING = [
    { id: 'ct-1', shipment_id: 'PLACEHOLDER_0', location: 'Shanghai Port, China', status: 'booked', timestamp: '2026-03-10T08:00:00.000Z', description: 'Shipment booked and cargo loaded', lat: 31.23, lng: 121.47 },
    { id: 'ct-2', shipment_id: 'PLACEHOLDER_0', location: 'South China Sea', status: 'in_transit', timestamp: '2026-03-14T12:00:00.000Z', description: 'Vessel underway in South China Sea', lat: 20.00, lng: 114.00 },
    { id: 'ct-3', shipment_id: 'PLACEHOLDER_0', location: 'Indian Ocean', status: 'in_transit', timestamp: '2026-03-23T10:00:00.000Z', description: 'Crossing Indian Ocean', lat: 8.00, lng: 70.00 }
  ];

  /* ─────────────────────────────────────────
     DATA ACCESS HELPERS
  ───────────────────────────────────────── */
  function loadShipments() {
    try {
      var stored = localStorage.getItem(LS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
  }

  function saveShipments(shipments) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(shipments)); } catch (e) {}
  }

  function loadTracking() {
    try {
      var stored = localStorage.getItem(LS_TRACKING_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
  }

  function saveTracking(events) {
    try { localStorage.setItem(LS_TRACKING_KEY, JSON.stringify(events)); } catch (e) {}
  }

  function getShipments() {
    var data = loadShipments();
    if (!data) {
      // Seed demo data with real IDs
      var seeded = DEMO_SHIPMENTS.map(function (s, i) {
        return Object.assign({}, s, { id: 'fs-demo-' + (i + 1) });
      });
      saveShipments(seeded);

      // Seed tracking events with real shipment IDs
      var trackingSeeded = DEMO_TRACKING.map(function (t) {
        return Object.assign({}, t, { shipment_id: seeded[0].id });
      });
      saveTracking(trackingSeeded);

      return seeded;
    }
    return data;
  }

  function getTracking() {
    var data = loadTracking();
    if (!data) {
      getShipments(); // trigger seeding
      data = loadTracking() || [];
    }
    return data;
  }

  function getShipmentById(id) {
    return getShipments().find(function (s) { return s.id === id; }) || null;
  }

  function getDashboardSummary() {
    var shipments = getShipments();
    var byStatus = {};
    var byType = {};
    shipments.forEach(function (s) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      byType[s.freight_type] = (byType[s.freight_type] || 0) + 1;
    });
    return { total: shipments.length, by_status: byStatus, by_freight_type: byType };
  }

  /* ─────────────────────────────────────────
     RENDERING HELPERS
  ───────────────────────────────────────── */
  var STATUS_LABELS = {
    booked: 'Booked',
    in_transit: 'In Transit',
    at_port: 'At Port',
    customs: 'Customs',
    delivered: 'Delivered'
  };

  var STATUS_CLASSES = {
    booked: 'badge-booked',
    in_transit: 'badge-in_transit',
    at_port: 'badge-at_port',
    customs: 'badge-customs',
    delivered: 'badge-delivered'
  };

  var STATUS_FILL_CLASSES = {
    booked: 'fill-booked',
    in_transit: 'fill-in_transit',
    at_port: 'fill-at_port',
    customs: 'fill-customs',
    delivered: 'fill-delivered'
  };

  function statusBadge(status) {
    var cls = STATUS_CLASSES[status] || 'badge-booked';
    var label = STATUS_LABELS[status] || status;
    return '<span class="badge ' + cls + '">' + esc(label) + '</span>';
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return iso; }
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return iso; }
  }

  /* ─────────────────────────────────────────
     DASHBOARD
  ───────────────────────────────────────── */
  function initDashboard() {
    var summary = getDashboardSummary();
    var bs = summary.by_status;
    var bt = summary.by_freight_type;

    // Metrics
    setEl('metTotal', summary.total);
    setEl('metTransit', bs.in_transit || 0);
    setEl('metCustoms', bs.customs || 0);
    setEl('metDelivered', bs.delivered || 0);
    setEl('metAtPort', bs.at_port || 0);

    // Status bars
    var barsEl = document.getElementById('statusBars');
    if (barsEl) {
      var total = summary.total || 1;
      var statuses = ['booked', 'in_transit', 'at_port', 'customs', 'delivered'];
      barsEl.innerHTML = statuses.map(function (s) {
        var cnt = bs[s] || 0;
        var pct = Math.round((cnt / total) * 100);
        var fillCls = STATUS_FILL_CLASSES[s] || 'fill-booked';
        return '<div class="status-bar-item">' +
          '<div class="status-bar-label">' + esc(STATUS_LABELS[s] || s) + '</div>' +
          '<div class="status-bar-track"><div class="status-bar-fill ' + fillCls + '" style="width:' + pct + '%"></div></div>' +
          '<div class="status-bar-count">' + cnt + '</div>' +
          '</div>';
      }).join('');
    }

    // Freight type grid
    var typeEl = document.getElementById('typeGrid');
    if (typeEl) {
      var types = Object.keys(bt);
      if (types.length === 0) {
        typeEl.innerHTML = '<p style="color:#94a3b8;font-size:.85rem">No shipments yet.</p>';
      } else {
        typeEl.innerHTML = types.map(function (t) {
          return '<div class="type-card"><div class="type-count">' + bt[t] + '</div><div class="type-name">' + esc(t) + '</div></div>';
        }).join('');
      }
    }

    // Recent shipments table
    renderShipmentsTable('shipmentsBody', getShipments().slice(0, 10), true);

    // Search filter
    var searchEl = document.getElementById('searchInput');
    var statusEl = document.getElementById('statusFilter');
    function applyFilters() {
      var q = searchEl ? searchEl.value.toLowerCase() : '';
      var st = statusEl ? statusEl.value : '';
      var filtered = getShipments().filter(function (s) {
        var matchQ = !q || (s.container_number || '').toLowerCase().includes(q) ||
          (s.bill_of_lading || '').toLowerCase().includes(q) ||
          (s.carrier_name || '').toLowerCase().includes(q);
        var matchSt = !st || s.status === st;
        return matchQ && matchSt;
      });
      renderShipmentsTable('shipmentsBody', filtered.slice(0, 10), true);
    }
    if (searchEl) searchEl.addEventListener('input', applyFilters);
    if (statusEl) statusEl.addEventListener('change', applyFilters);
  }

  /* ─────────────────────────────────────────
     SHIPMENTS LIST
  ───────────────────────────────────────── */
  var currentPage = 1;
  var pageSize = 10;
  var filteredShipments = [];

  function initShipmentsList() {
    filteredShipments = getShipments();
    renderPage();

    var searchEl = document.getElementById('searchInput');
    var statusEl = document.getElementById('statusFilter');
    var typeEl = document.getElementById('typeFilter');

    function applyFilters() {
      var q = searchEl ? searchEl.value.toLowerCase() : '';
      var st = statusEl ? statusEl.value : '';
      var ft = typeEl ? typeEl.value : '';
      filteredShipments = getShipments().filter(function (s) {
        var matchQ = !q || (s.container_number || '').toLowerCase().includes(q) ||
          (s.bill_of_lading || '').toLowerCase().includes(q) ||
          (s.carrier_name || '').toLowerCase().includes(q) ||
          (s.origin_port || '').toLowerCase().includes(q) ||
          (s.destination_port || '').toLowerCase().includes(q);
        var matchSt = !st || s.status === st;
        var matchFt = !ft || s.freight_type === ft;
        return matchQ && matchSt && matchFt;
      });
      currentPage = 1;
      renderPage();
    }

    if (searchEl) searchEl.addEventListener('input', applyFilters);
    if (statusEl) statusEl.addEventListener('change', applyFilters);
    if (typeEl) typeEl.addEventListener('change', applyFilters);

    // Modal close
    var modal = document.getElementById('shipmentModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.classList.remove('open');
      });
      var closeBtn = document.getElementById('closeModal');
      if (closeBtn) closeBtn.addEventListener('click', function () { modal.classList.remove('open'); });
    }
  }

  function renderPage() {
    var start = (currentPage - 1) * pageSize;
    var page = filteredShipments.slice(start, start + pageSize);
    renderShipmentsTable('shipmentsBody', page, false);
    renderPagination('pagination', Math.ceil(filteredShipments.length / pageSize));
  }

  function renderShipmentsTable(tbodyId, shipments, compact) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!shipments || shipments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8"><i class="fas fa-inbox" style="display:block;font-size:2rem;margin-bottom:8px"></i>No shipments found.</td></tr>';
      return;
    }
    tbody.innerHTML = shipments.map(function (s) {
      var trackBtn = '<button class="btn-sm btn-track-sm" onclick="FreightShipments.openShipmentDetail(\'' + esc(s.id) + '\')"><i class="fas fa-eye"></i> View</button>';
      return '<tr>' +
        '<td><code>' + esc(s.container_number || '—') + '</code></td>' +
        '<td>' + esc(s.bill_of_lading || '—') + '</td>' +
        (compact ? '' : '<td>' + esc(s.carrier_name) + '</td>') +
        '<td>' + esc(s.origin_port) + ' → ' + esc(s.destination_port) + '</td>' +
        '<td><span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:12px;font-size:.75rem;font-weight:600">' + esc(s.freight_type) + '</span></td>' +
        '<td>' + statusBadge(s.status) + '</td>' +
        '<td>' + fmtDate(s.estimated_arrival) + '</td>' +
        '<td>' + trackBtn + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderPagination(containerId, totalPages) {
    var el = document.getElementById(containerId);
    if (!el || totalPages <= 1) { if (el) el.innerHTML = ''; return; }
    var html = '';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" onclick="FreightShipments.goToPage(' + i + ')">' + i + '</button>';
    }
    el.innerHTML = html;
  }

  function goToPage(page) {
    currentPage = page;
    renderPage();
  }

  /* ─────────────────────────────────────────
     SHIPMENT DETAIL MODAL
  ───────────────────────────────────────── */
  var currentShipmentId = null;

  function openShipmentDetail(id) {
    var s = getShipmentById(id);
    if (!s) return;
    currentShipmentId = id;

    var modal = document.getElementById('shipmentModal');
    var titleEl = document.getElementById('modalTitle');
    var contentEl = document.getElementById('modalContent');
    var timelineEl = document.getElementById('modalTimeline');
    var docsEl = document.getElementById('modalDocs');
    if (!modal) return;

    if (titleEl) titleEl.textContent = (s.container_number || s.bill_of_lading || 'Shipment') + ' — Details';

    if (contentEl) {
      contentEl.innerHTML = [
        row('Carrier', s.carrier_name),
        row('Container #', s.container_number || '—'),
        row('Bill of Lading', s.bill_of_lading || '—'),
        row('Origin Port', s.origin_port),
        row('Destination Port', s.destination_port),
        row('Freight Type', s.freight_type),
        row('Status', statusBadge(s.status)),
        row('Departure', fmtDate(s.departure_date)),
        row('ETA', fmtDate(s.estimated_arrival)),
        row('Actual Arrival', fmtDate(s.actual_arrival)),
        row('Weight', s.weight ? s.weight + ' kg' : '—'),
        row('Volume', s.volume ? s.volume + ' CBM' : '—'),
        row('Customs Status', s.customs_status || '—'),
      ].join('');
    }

    // Pre-select current status in update dropdown
    var updateSt = document.getElementById('updateStatus');
    if (updateSt) updateSt.value = s.status;

    // Tracking events
    var events = getTracking().filter(function (t) { return t.shipment_id === id; });
    if (timelineEl) {
      if (events.length === 0) {
        timelineEl.innerHTML = '<li style="color:#94a3b8;font-size:.85rem;padding:8px 0">No tracking events yet.</li>';
      } else {
        timelineEl.innerHTML = events.map(function (e) {
          return '<li class="timeline-item">' +
            '<div class="timeline-date">' + fmtDateTime(e.timestamp) + '</div>' +
            '<div class="timeline-body"><strong>' + esc(e.status ? STATUS_LABELS[e.status] || e.status : '') + ' — ' + esc(e.location) + '</strong>' +
            (e.description ? '<span>' + esc(e.description) + '</span>' : '') + '</div>' +
            '</li>';
        }).join('');
      }
    }

    // Documents
    var docs = s.documents || [];
    if (docsEl) {
      if (docs.length === 0) {
        docsEl.innerHTML = '<li style="color:#94a3b8;font-size:.85rem;padding:8px 0">No documents attached.</li>';
      } else {
        docsEl.innerHTML = docs.map(function (d) {
          var icon = d.type === 'pdf' ? 'fa-file-pdf' : (d.type === 'xlsx' ? 'fa-file-excel' : 'fa-file');
          return '<li class="doc-item"><i class="fas ' + icon + '"></i><div><strong>' + esc(d.name) + '</strong>' +
            (d.size ? ' <span style="color:#94a3b8;font-size:.78rem">(' + esc(d.size) + ')</span>' : '') +
            '<div style="font-size:.75rem;color:#94a3b8">' + fmtDate(d.uploaded_at) + '</div></div></li>';
        }).join('');
      }
    }

    modal.classList.add('open');
  }

  function row(label, value) {
    return '<div class="detail-row"><div class="detail-label">' + esc(label) + '</div><div class="detail-val">' + value + '</div></div>';
  }

  /* ─────────────────────────────────────────
     BOOKING FORM
  ───────────────────────────────────────── */
  function initBookingForm() {
    var form = document.getElementById('freightForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'; }

      var fd = new FormData(form);
      var data = {};
      fd.forEach(function (v, k) { data[k] = v; });

      var orderId = (data.order_id || '').trim();
      if (!orderId || !isValidUUID(orderId)) delete data.order_id;

      var shipment = Object.assign({
        id: 'fs-' + Date.now(),
        status: 'booked',
        tracking_updates: [],
        documents: [],
        actual_arrival: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, data);

      if (shipment.container_number) shipment.container_number = shipment.container_number.toUpperCase();
      if (shipment.weight) shipment.weight = parseFloat(shipment.weight);
      if (shipment.volume) shipment.volume = parseFloat(shipment.volume);

      // Save
      var all = getShipments();
      all.unshift(shipment);
      saveShipments(all);

      showAlert('formAlert', 'success', '<i class="fas fa-check-circle"></i> Shipment created! Redirecting to dashboard…');

      setTimeout(function () {
        window.location.href = 'freight-dashboard.html';
      }, 1800);
    });
  }

  function isValidUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  /* ─────────────────────────────────────────
     ADMIN PANEL
  ───────────────────────────────────────── */
  function initAdmin() {
    // Metrics
    var summary = getDashboardSummary();
    var bs = summary.by_status;
    setEl('metTotal', summary.total);
    setEl('metTransit', bs.in_transit || 0);
    setEl('metCustoms', bs.customs || 0);
    setEl('metDelivered', bs.delivered || 0);

    // Table
    filteredShipments = getShipments();
    renderAdminTable();

    // Filters
    var searchEl = document.getElementById('shipmentSearch');
    var statusEl = document.getElementById('statusFilterAdmin');
    var typeEl = document.getElementById('typeFilterAdmin');

    function applyAdminFilters() {
      var q = searchEl ? searchEl.value.toLowerCase() : '';
      var st = statusEl ? statusEl.value : '';
      var ft = typeEl ? typeEl.value : '';
      filteredShipments = getShipments().filter(function (s) {
        var matchQ = !q || (s.container_number || '').toLowerCase().includes(q) ||
          (s.bill_of_lading || '').toLowerCase().includes(q) ||
          (s.carrier_name || '').toLowerCase().includes(q);
        var matchSt = !st || s.status === st;
        var matchFt = !ft || s.freight_type === ft;
        return matchQ && matchSt && matchFt;
      });
      currentPage = 1;
      renderAdminTable();
    }

    if (searchEl) searchEl.addEventListener('input', applyAdminFilters);
    if (statusEl) statusEl.addEventListener('change', applyAdminFilters);
    if (typeEl) typeEl.addEventListener('change', applyAdminFilters);

    // Create form
    var createForm = document.getElementById('createForm');
    if (createForm) {
      createForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(createForm);
        var data = {};
        fd.forEach(function (v, k) { if (v.trim()) data[k] = v.trim(); });

        if (!data.carrier_name || !data.freight_type || !data.origin_port || !data.destination_port) {
          showAlert('createAlert', 'error', 'Please fill in all required fields.');
          return;
        }

        var shipment = Object.assign({
          id: 'fs-' + Date.now(),
          status: data.status || 'booked',
          tracking_updates: [],
          documents: [],
          actual_arrival: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, data);

        if (shipment.container_number) shipment.container_number = shipment.container_number.toUpperCase();
        if (shipment.weight) shipment.weight = parseFloat(shipment.weight);
        if (shipment.volume) shipment.volume = parseFloat(shipment.volume);

        var all = getShipments();
        all.unshift(shipment);
        saveShipments(all);
        filteredShipments = all;

        showAlert('createAlert', 'success', '<i class="fas fa-check-circle"></i> Shipment created successfully!');
        createForm.reset();
        renderAdminTable();

        // Update metrics
        var newSummary = getDashboardSummary();
        setEl('metTotal', newSummary.total);
      });
    }

    // Tracking form
    var trackingForm = document.getElementById('trackingForm');
    if (trackingForm) {
      trackingForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(trackingForm);
        var data = {};
        fd.forEach(function (v, k) { if (v.trim()) data[k] = v.trim(); });

        var shipmentId = data.shipment_id;
        var s = getShipmentById(shipmentId);
        if (!s) { showAlert('trackingAlert', 'error', 'Shipment not found. Check the ID.'); return; }
        if (!data.location || !data.status) { showAlert('trackingAlert', 'error', 'Location and status are required.'); return; }

        var event = {
          id: 'ct-' + Date.now(),
          shipment_id: shipmentId,
          location: data.location,
          status: data.status,
          description: data.description || '',
          lat: data.lat ? parseFloat(data.lat) : null,
          lng: data.lng ? parseFloat(data.lng) : null,
          timestamp: new Date().toISOString()
        };

        var allTracking = getTracking();
        allTracking.push(event);
        saveTracking(allTracking);

        // Also update shipment status
        var all = getShipments();
        var idx = all.findIndex(function (sh) { return sh.id === shipmentId; });
        if (idx !== -1) {
          all[idx].status = data.status;
          all[idx].updated_at = new Date().toISOString();
          var updates = all[idx].tracking_updates || [];
          updates.push({ location: data.location, status: data.status, description: data.description, timestamp: event.timestamp });
          all[idx].tracking_updates = updates;
          saveShipments(all);
          filteredShipments = all;
          renderAdminTable();
        }

        showAlert('trackingAlert', 'success', '<i class="fas fa-check-circle"></i> Tracking event added!');
        trackingForm.reset();
      });
    }
  }

  function renderAdminTable() {
    var start = (currentPage - 1) * pageSize;
    var page = filteredShipments.slice(start, start + pageSize);
    var tbody = document.getElementById('shipmentsBody');
    if (!tbody) return;

    if (page.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8"><i class="fas fa-inbox" style="display:block;font-size:2rem;margin-bottom:8px"></i>No shipments found.</td></tr>';
    } else {
      tbody.innerHTML = page.map(function (s) {
        return '<tr>' +
          '<td><code style="font-size:.8rem">' + esc(s.container_number || '—') + '</code></td>' +
          '<td>' + esc(s.bill_of_lading || '—') + '</td>' +
          '<td>' + esc(s.carrier_name) + '</td>' +
          '<td style="font-size:.82rem">' + esc(s.origin_port) + ' → ' + esc(s.destination_port) + '</td>' +
          '<td><span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:12px;font-size:.72rem;font-weight:600">' + esc(s.freight_type) + '</span></td>' +
          '<td>' + statusBadge(s.status) + '</td>' +
          '<td>' + fmtDate(s.estimated_arrival) + '</td>' +
          '<td><button class="btn btn-secondary btn-sm" onclick="FreightShipments.openAdminDetail(\'' + esc(s.id) + '\')"><i class="fas fa-eye"></i> View</button> ' +
          '<button class="btn btn-sm" style="background:#f59e0b;color:#fff" onclick="FreightShipments.copyId(\'' + esc(s.id) + '\')"><i class="fas fa-copy"></i></button>' +
          '</td></tr>';
      }).join('');
    }

    renderPagination('pagination', Math.ceil(filteredShipments.length / pageSize));
  }

  function openAdminDetail(id) {
    openShipmentDetail(id);
  }

  function copyId(id) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id).then(function () {
        var tidEl = document.getElementById('trackingShipmentId');
        if (tidEl) { tidEl.value = id; tidEl.focus(); }
      });
    } else {
      var tidEl = document.getElementById('trackingShipmentId');
      if (tidEl) { tidEl.value = id; tidEl.focus(); }
    }
  }

  function updateShipmentStatus() {
    if (!currentShipmentId) return;
    var statusEl = document.getElementById('updateStatus');
    var arrivalEl = document.getElementById('updateActualArrival');
    if (!statusEl) return;

    var all = getShipments();
    var idx = all.findIndex(function (s) { return s.id === currentShipmentId; });
    if (idx === -1) { showAlert('updateAlert', 'error', 'Shipment not found.'); return; }

    all[idx].status = statusEl.value;
    all[idx].updated_at = new Date().toISOString();
    if (arrivalEl && arrivalEl.value) all[idx].actual_arrival = new Date(arrivalEl.value).toISOString();

    saveShipments(all);
    filteredShipments = all;
    renderAdminTable && renderAdminTable();

    showAlert('updateAlert', 'success', '<i class="fas fa-check-circle"></i> Status updated!');
  }

  function addDocument() {
    if (!currentShipmentId) return;
    var nameEl = document.getElementById('docName');
    var typeEl = document.getElementById('docType');
    var urlEl = document.getElementById('docUrl');

    var name = nameEl ? nameEl.value.trim() : '';
    var type = typeEl ? typeEl.value.trim() : 'pdf';
    var url = urlEl ? urlEl.value.trim() : '';

    if (!name) { showAlert('updateAlert', 'error', 'Document name is required.'); return; }

    var all = getShipments();
    var idx = all.findIndex(function (s) { return s.id === currentShipmentId; });
    if (idx === -1) return;

    var docs = all[idx].documents || [];
    docs.push({ name: name, type: type || 'pdf', url: url, uploaded_at: new Date().toISOString() });
    all[idx].documents = docs;
    all[idx].updated_at = new Date().toISOString();
    saveShipments(all);

    showAlert('updateAlert', 'success', '<i class="fas fa-check-circle"></i> Document added!');
    if (nameEl) nameEl.value = '';
    if (typeEl) typeEl.value = '';
    if (urlEl) urlEl.value = '';

    // Refresh modal docs
    openShipmentDetail(currentShipmentId);
  }

  /* ─────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────── */
  function setEl(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function showAlert(containerId, type, html) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="alert alert-' + type + '">' + html + '</div>';
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; el.innerHTML = ''; }, 4000);
  }

  /* ─────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────── */
  global.FreightShipments = {
    initDashboard: initDashboard,
    initShipmentsList: initShipmentsList,
    initBookingForm: initBookingForm,
    initAdmin: initAdmin,
    openShipmentDetail: openShipmentDetail,
    openAdminDetail: openAdminDetail,
    goToPage: goToPage,
    copyId: copyId,
    updateShipmentStatus: updateShipmentStatus,
    addDocument: addDocument
  };

})(window);
