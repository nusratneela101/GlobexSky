/**
 * GlobexSky — Container Tracking Module
 * Freight forwarding & container tracking with Leaflet.js maps
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     MOCK DATA — 6 sample shipments
  ───────────────────────────────────────── */
  var MOCK_SHIPMENTS = [
    {
      id: 'GSKY-CTR-88201',
      containerNumber: 'MSCU7284910',
      origin: 'Shanghai, China',
      originCoords: [31.23, 121.47],
      destination: 'Rotterdam, Netherlands',
      destCoords: [51.91, 4.48],
      vesselName: 'MSC Isabella',
      etd: '2026-03-10',
      eta: '2026-04-08',
      status: 'in-transit',
      cargoType: 'Electronics',
      weight: '18,400 kg',
      route: [[31.23,121.47],[22.28,114.17],[13.76,100.50],[6.15,80.20],[12.50,43.14],[30.04,32.40],[37.90,23.73],[43.30,5.37],[51.91,4.48]],
      timeline: [
        { date: '2026-03-10', title: 'Departed Shanghai Port', desc: 'Loaded onto MSC Isabella, Berth 7', status: 'completed' },
        { date: '2026-03-14', title: 'Passed Hong Kong', desc: 'Transit through South China Sea', status: 'completed' },
        { date: '2026-03-18', title: 'Strait of Malacca', desc: 'In transit through Malacca Strait', status: 'completed' },
        { date: '2026-03-23', title: 'Indian Ocean', desc: 'Crossing Indian Ocean', status: 'current' },
        { date: '2026-03-30', title: 'Suez Canal Transit', desc: 'Expected transit through Suez', status: 'pending' },
        { date: '2026-04-05', title: 'Mediterranean Sea', desc: 'Crossing Mediterranean', status: 'pending' },
        { date: '2026-04-08', title: 'Arrive Rotterdam', desc: 'ECT Delta Terminal, Berth 12', status: 'pending' }
      ],
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '245 KB', date: '2026-03-10' },
        { name: 'Commercial Invoice', type: 'pdf', size: '128 KB', date: '2026-03-09' },
        { name: 'Packing List', type: 'pdf', size: '89 KB', date: '2026-03-09' },
        { name: 'Certificate of Origin', type: 'pdf', size: '156 KB', date: '2026-03-08' }
      ]
    },
    {
      id: 'GSKY-CTR-77340',
      containerNumber: 'HLCU3049271',
      origin: 'Busan, South Korea',
      originCoords: [35.10, 129.03],
      destination: 'Los Angeles, USA',
      destCoords: [33.74, -118.27],
      vesselName: 'HMM Algeciras',
      etd: '2026-03-05',
      eta: '2026-03-25',
      status: 'in-transit',
      cargoType: 'Auto Parts',
      weight: '22,100 kg',
      route: [[35.10,129.03],[40.70,152.50],[45.00,-170.00],[40.00,-145.00],[33.74,-118.27]],
      timeline: [
        { date: '2026-03-05', title: 'Departed Busan Port', desc: 'Loaded onto HMM Algeciras', status: 'completed' },
        { date: '2026-03-10', title: 'North Pacific Ocean', desc: 'Crossing North Pacific', status: 'completed' },
        { date: '2026-03-16', title: 'Mid-Pacific', desc: 'International Date Line crossing', status: 'completed' },
        { date: '2026-03-21', title: 'Approaching West Coast', desc: 'Nearing US territorial waters', status: 'current' },
        { date: '2026-03-25', title: 'Arrive Los Angeles', desc: 'Port of Los Angeles, Terminal Island', status: 'pending' }
      ],
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '234 KB', date: '2026-03-05' },
        { name: 'Commercial Invoice', type: 'pdf', size: '142 KB', date: '2026-03-04' },
        { name: 'Customs Declaration', type: 'pdf', size: '178 KB', date: '2026-03-04' }
      ]
    },
    {
      id: 'GSKY-CTR-55912',
      containerNumber: 'MAEU6140385',
      origin: 'Hamburg, Germany',
      originCoords: [53.55, 9.99],
      destination: 'Chittagong, Bangladesh',
      destCoords: [22.33, 91.83],
      vesselName: 'Maersk Edmonton',
      etd: '2026-02-28',
      eta: '2026-03-28',
      status: 'at-port',
      cargoType: 'Machinery',
      weight: '25,800 kg',
      route: [[53.55,9.99],[36.13,-5.35],[31.20,32.30],[12.85,45.00],[22.33,91.83]],
      timeline: [
        { date: '2026-02-28', title: 'Departed Hamburg', desc: 'Loaded onto Maersk Edmonton', status: 'completed' },
        { date: '2026-03-06', title: 'Strait of Gibraltar', desc: 'Entered Mediterranean', status: 'completed' },
        { date: '2026-03-12', title: 'Suez Canal Transit', desc: 'Passed through Suez Canal', status: 'completed' },
        { date: '2026-03-19', title: 'Gulf of Aden', desc: 'Passing Gulf of Aden', status: 'completed' },
        { date: '2026-03-27', title: 'Arrived Chittagong', desc: 'Docked at Chittagong Port', status: 'current' },
        { date: '2026-03-28', title: 'Unloading', desc: 'Container being offloaded', status: 'pending' }
      ],
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '267 KB', date: '2026-02-28' },
        { name: 'Commercial Invoice', type: 'pdf', size: '134 KB', date: '2026-02-27' },
        { name: 'Import License', type: 'pdf', size: '198 KB', date: '2026-02-25' },
        { name: 'Insurance Certificate', type: 'pdf', size: '145 KB', date: '2026-02-26' }
      ]
    },
    {
      id: 'GSKY-CTR-44087',
      containerNumber: 'CMAU5293847',
      origin: 'Shenzhen, China',
      originCoords: [22.54, 114.06],
      destination: 'Dubai, UAE',
      destCoords: [25.27, 55.30],
      vesselName: 'CMA CGM Marco Polo',
      etd: '2026-03-01',
      eta: '2026-03-18',
      status: 'customs',
      cargoType: 'Consumer Goods',
      weight: '14,200 kg',
      route: [[22.54,114.06],[10.30,107.05],[1.35,103.82],[6.15,80.20],[25.27,55.30]],
      timeline: [
        { date: '2026-03-01', title: 'Departed Shenzhen', desc: 'Yantian Terminal, Berth 3', status: 'completed' },
        { date: '2026-03-04', title: 'South China Sea', desc: 'In transit', status: 'completed' },
        { date: '2026-03-07', title: 'Singapore Strait', desc: 'Transited Singapore', status: 'completed' },
        { date: '2026-03-12', title: 'Indian Ocean', desc: 'Crossing Indian Ocean', status: 'completed' },
        { date: '2026-03-17', title: 'Arrived Jebel Ali', desc: 'Docked at Dubai port', status: 'completed' },
        { date: '2026-03-18', title: 'Customs Clearance', desc: 'Under customs inspection', status: 'current' }
      ],
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '221 KB', date: '2026-03-01' },
        { name: 'Customs Declaration Form', type: 'pdf', size: '189 KB', date: '2026-03-17' },
        { name: 'Packing List', type: 'pdf', size: '95 KB', date: '2026-02-28' }
      ]
    },
    {
      id: 'GSKY-CTR-33650',
      containerNumber: 'EGLV4018293',
      origin: 'Yokohama, Japan',
      originCoords: [35.44, 139.64],
      destination: 'Sydney, Australia',
      destCoords: [-33.86, 151.21],
      vesselName: 'ONE Competence',
      etd: '2026-02-20',
      eta: '2026-03-10',
      status: 'delivered',
      cargoType: 'Textiles',
      weight: '11,600 kg',
      route: [[35.44,139.64],[24.00,133.00],[10.00,140.00],[-10.00,148.00],[-33.86,151.21]],
      timeline: [
        { date: '2026-02-20', title: 'Departed Yokohama', desc: 'Loaded onto ONE Competence', status: 'completed' },
        { date: '2026-02-24', title: 'East China Sea', desc: 'Heading south', status: 'completed' },
        { date: '2026-02-28', title: 'Philippine Sea', desc: 'In transit', status: 'completed' },
        { date: '2026-03-05', title: 'Coral Sea', desc: 'Approaching Australia', status: 'completed' },
        { date: '2026-03-09', title: 'Arrived Sydney', desc: 'Botany Bay Terminal', status: 'completed' },
        { date: '2026-03-10', title: 'Delivered', desc: 'Container released to consignee', status: 'completed' }
      ],
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '210 KB', date: '2026-02-20' },
        { name: 'Delivery Order', type: 'pdf', size: '156 KB', date: '2026-03-09' },
        { name: 'Import Declaration', type: 'pdf', size: '178 KB', date: '2026-03-08' },
        { name: 'Commercial Invoice', type: 'pdf', size: '120 KB', date: '2026-02-19' }
      ]
    },
    {
      id: 'GSKY-CTR-22418',
      containerNumber: 'OOLU7583291',
      origin: 'Singapore',
      originCoords: [1.26, 103.84],
      destination: 'Felixstowe, UK',
      destCoords: [51.96, 1.35],
      vesselName: 'OOCL Hong Kong',
      etd: '2026-03-15',
      eta: '2026-04-12',
      status: 'in-transit',
      cargoType: 'Rubber & Plastics',
      weight: '20,500 kg',
      route: [[1.26,103.84],[6.15,80.20],[12.50,43.14],[30.04,32.40],[37.90,23.73],[36.13,-5.35],[48.40,-5.10],[51.96,1.35]],
      timeline: [
        { date: '2026-03-15', title: 'Departed Singapore', desc: 'PSA Terminal, Berth 9', status: 'completed' },
        { date: '2026-03-20', title: 'Indian Ocean', desc: 'Heading west across Indian Ocean', status: 'completed' },
        { date: '2026-03-26', title: 'Gulf of Aden', desc: 'Approaching Red Sea', status: 'current' },
        { date: '2026-04-01', title: 'Suez Canal', desc: 'Expected Suez transit', status: 'pending' },
        { date: '2026-04-07', title: 'Mediterranean / Atlantic', desc: 'Strait of Gibraltar transit', status: 'pending' },
        { date: '2026-04-12', title: 'Arrive Felixstowe', desc: 'Trinity Terminal', status: 'pending' }
      ],
      documents: [
        { name: 'Bill of Lading', type: 'pdf', size: '238 KB', date: '2026-03-15' },
        { name: 'Commercial Invoice', type: 'pdf', size: '115 KB', date: '2026-03-14' },
        { name: 'Packing List', type: 'pdf', size: '87 KB', date: '2026-03-14' }
      ]
    }
  ];

  /* ─────────────────────────────────────────
     STORAGE HELPERS
  ───────────────────────────────────────── */
  var STORAGE_KEY = 'gsky_container_shipments';

  function loadShipments() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_SHIPMENTS));
    return MOCK_SHIPMENTS;
  }

  function getShipments() {
    return loadShipments();
  }

  function findShipment(query) {
    var q = (query || '').trim().toUpperCase();
    var all = getShipments();
    return all.find(function (s) {
      return s.id.toUpperCase() === q ||
             s.containerNumber.toUpperCase() === q ||
             s.id.toUpperCase().indexOf(q) !== -1 ||
             s.containerNumber.toUpperCase().indexOf(q) !== -1;
    }) || null;
  }

  /* ─────────────────────────────────────────
     MAP (LEAFLET.JS)
  ───────────────────────────────────────── */
  var map = null;
  var routeLayer = null;
  var markerLayer = null;

  function initMap() {
    var el = document.getElementById('trackingMap');
    if (!el || typeof L === 'undefined') return;

    map = L.map('trackingMap', { scrollWheelZoom: false }).setView([20, 40], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    routeLayer = L.layerGroup().addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  function renderRoute(shipment) {
    if (!map || !shipment) return;
    routeLayer.clearLayers();
    markerLayer.clearLayers();

    var coords = shipment.route || [];
    if (coords.length < 2) return;

    // Draw polyline route
    var polyline = L.polyline(coords, {
      color: '#0052CC',
      weight: 3,
      opacity: 0.7,
      dashArray: '8, 6'
    });
    routeLayer.addLayer(polyline);

    // Origin marker (green)
    var originIcon = L.divIcon({
      className: 'ct-map-marker',
      html: '<div style="background:#059669;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"><i class="fa-solid fa-anchor"></i></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker(shipment.originCoords, { icon: originIcon })
      .bindPopup('<b>Origin:</b> ' + escapeHtml(shipment.origin))
      .addTo(markerLayer);

    // Destination marker (red)
    var destIcon = L.divIcon({
      className: 'ct-map-marker',
      html: '<div style="background:#dc2626;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"><i class="fa-solid fa-flag"></i></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker(shipment.destCoords, { icon: destIcon })
      .bindPopup('<b>Destination:</b> ' + escapeHtml(shipment.destination))
      .addTo(markerLayer);

    // Current position marker (blue, pulsing)
    var currentIdx = 0;
    var tl = shipment.timeline || [];
    for (var i = 0; i < tl.length; i++) {
      if (tl[i].status === 'current') { currentIdx = i; break; }
      if (tl[i].status === 'completed') currentIdx = i;
    }
    var progressRatio = tl.length > 1 ? currentIdx / (tl.length - 1) : 0;
    var routeIdx = Math.min(Math.floor(progressRatio * (coords.length - 1)), coords.length - 1);
    var currentPos = coords[routeIdx];

    var shipIcon = L.divIcon({
      className: 'ct-map-marker',
      html: '<div style="background:#0052CC;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,82,204,.5);animation:pulse-marker 1.5s infinite"><i class="fa-solid fa-ship"></i></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    L.marker(currentPos, { icon: shipIcon })
      .bindPopup('<b>' + escapeHtml(shipment.vesselName) + '</b><br>Status: ' + formatStatus(shipment.status))
      .addTo(markerLayer);

    // Fit bounds
    map.fitBounds(polyline.getBounds().pad(0.15));
  }

  /* ─────────────────────────────────────────
     TIMELINE
  ───────────────────────────────────────── */
  function renderTimeline(shipment) {
    var el = document.getElementById('shipmentTimeline');
    if (!el || !shipment) { if (el) el.innerHTML = ''; return; }

    var tl = shipment.timeline || [];
    el.innerHTML = tl.map(function (item) {
      var cls = item.status === 'completed' ? 'completed' : item.status === 'current' ? 'current' : '';
      return '<div class="timeline-item ' + cls + '">' +
        '<div class="timeline-dot"></div>' +
        '<div class="timeline-date">' + escapeHtml(formatDate(item.date)) + '</div>' +
        '<div class="timeline-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="timeline-desc">' + escapeHtml(item.desc) + '</div>' +
        '</div>';
    }).join('');
  }

  /* ─────────────────────────────────────────
     CONTAINER DETAILS
  ───────────────────────────────────────── */
  function renderDetails(shipment) {
    var el = document.getElementById('containerDetails');
    if (!el || !shipment) { if (el) el.style.display = 'none'; return; }
    el.style.display = 'block';

    setTextById('detOrigin', shipment.origin);
    setTextById('detDestination', shipment.destination);
    setTextById('detVessel', shipment.vesselName);
    setTextById('detETD', formatDate(shipment.etd));
    setTextById('detETA', formatDate(shipment.eta));
    setTextById('detStatus', formatStatus(shipment.status));
    setTextById('detContainer', shipment.containerNumber);
    setTextById('detCargo', shipment.cargoType);
    setTextById('detWeight', shipment.weight);
  }

  /* ─────────────────────────────────────────
     DOCUMENTS
  ───────────────────────────────────────── */
  function renderDocuments(shipment) {
    var el = document.getElementById('documentList');
    if (!el) return;
    if (!shipment || !shipment.documents || !shipment.documents.length) {
      el.innerHTML = '<li style="padding:20px;color:#94a3b8;text-align:center">No documents available. Search for a container to view documents.</li>';
      return;
    }
    el.innerHTML = shipment.documents.map(function (doc) {
      return '<li>' +
        '<div class="doc-info">' +
          '<div class="doc-icon"><i class="fa-solid fa-file-pdf"></i></div>' +
          '<div>' +
            '<div class="doc-name">' + escapeHtml(doc.name) + '</div>' +
            '<div class="doc-meta">' + escapeHtml(doc.type.toUpperCase()) + ' · ' + escapeHtml(doc.size) + ' · ' + escapeHtml(formatDate(doc.date)) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="doc-actions">' +
          '<button onclick="alert(\'Demo: Downloading ' + escapeHtml(doc.name) + '\')"><i class="fa-solid fa-download"></i> Download</button>' +
          '<button onclick="alert(\'Demo: Viewing ' + escapeHtml(doc.name) + '\')"><i class="fa-solid fa-eye"></i> View</button>' +
        '</div>' +
        '</li>';
    }).join('');
  }

  /* ─────────────────────────────────────────
     ACTIVE SHIPMENTS TABLE
  ───────────────────────────────────────── */
  function renderShipmentsTable() {
    var el = document.getElementById('shipmentsTableBody');
    if (!el) return;
    var all = getShipments();
    el.innerHTML = all.map(function (s) {
      var badgeClass = 'badge-transit';
      if (s.status === 'at-port') badgeClass = 'badge-port';
      else if (s.status === 'customs') badgeClass = 'badge-customs';
      else if (s.status === 'delivered') badgeClass = 'badge-delivered';

      return '<tr>' +
        '<td><strong>' + escapeHtml(s.id) + '</strong></td>' +
        '<td>' + escapeHtml(s.containerNumber) + '</td>' +
        '<td>' + escapeHtml(s.origin) + '</td>' +
        '<td>' + escapeHtml(s.destination) + '</td>' +
        '<td>' + escapeHtml(s.vesselName) + '</td>' +
        '<td><span class="badge ' + badgeClass + '">' + escapeHtml(formatStatus(s.status)) + '</span></td>' +
        '<td>' + escapeHtml(formatDate(s.eta)) + '</td>' +
        '<td><button class="btn-view-track" data-track-id="' + escapeHtml(s.id) + '"><i class="fa-solid fa-location-dot"></i> Track</button></td>' +
        '</tr>';
    }).join('');

    // Bind track buttons
    el.querySelectorAll('.btn-view-track').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-track-id');
        var input = document.getElementById('trackingInput');
        if (input) input.value = id;
        performSearch(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ─────────────────────────────────────────
     STATUS COUNTERS
  ───────────────────────────────────────── */
  function updateStatusCards() {
    var all = getShipments();
    var counts = { 'in-transit': 0, 'at-port': 0, 'customs': 0, 'delivered': 0 };
    all.forEach(function (s) {
      if (counts[s.status] !== undefined) counts[s.status]++;
    });
    setTextById('countTransit', counts['in-transit']);
    setTextById('countPort', counts['at-port']);
    setTextById('countCustoms', counts['customs']);
    setTextById('countDelivered', counts['delivered']);
  }

  /* ─────────────────────────────────────────
     SEARCH
  ───────────────────────────────────────── */
  function performSearch(query) {
    var shipment = findShipment(query);
    var resultArea = document.getElementById('trackingResultArea');

    if (!shipment) {
      if (resultArea) resultArea.style.display = 'block';
      var noResult = document.getElementById('noResultMsg');
      if (noResult) noResult.style.display = 'block';
      var detailsEl = document.getElementById('containerDetails');
      if (detailsEl) detailsEl.style.display = 'none';
      var timelineSection = document.getElementById('timelineSection');
      if (timelineSection) timelineSection.style.display = 'none';
      var docsSection = document.getElementById('docsSection');
      if (docsSection) docsSection.style.display = 'none';
      if (map) { routeLayer.clearLayers(); markerLayer.clearLayers(); }
      return;
    }

    // Hide no-result, show sections
    var noResult = document.getElementById('noResultMsg');
    if (noResult) noResult.style.display = 'none';
    if (resultArea) resultArea.style.display = 'block';
    var detailsEl = document.getElementById('containerDetails');
    if (detailsEl) detailsEl.style.display = 'block';
    var timelineSection = document.getElementById('timelineSection');
    if (timelineSection) timelineSection.style.display = 'block';
    var docsSection = document.getElementById('docsSection');
    if (docsSection) docsSection.style.display = 'block';

    renderRoute(shipment);
    renderDetails(shipment);
    renderTimeline(shipment);
    renderDocuments(shipment);
  }

  /* ─────────────────────────────────────────
     FREIGHT QUOTE CALCULATOR
  ───────────────────────────────────────── */
  function initQuoteCalculator() {
    var form = document.getElementById('freightQuoteForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var origin = document.getElementById('quoteOrigin');
      var dest = document.getElementById('quoteDest');
      var weight = document.getElementById('quoteWeight');
      var type = document.getElementById('quoteContainerType');

      if (!origin || !dest || !weight) return;
      if (!origin.value.trim() || !dest.value.trim() || !weight.value) {
        alert('Please fill in all required fields.');
        return;
      }

      // Calculate mock quote
      var w = parseFloat(weight.value) || 1;
      var baseRate = 2.50;
      var containerMultiplier = 1;
      if (type && type.value === '40ft') containerMultiplier = 1.8;
      else if (type && type.value === '40hc') containerMultiplier = 2.0;
      else if (type && type.value === 'reefer') containerMultiplier = 2.5;

      var freight = (w * baseRate * containerMultiplier).toFixed(2);
      var handling = (w * 0.35).toFixed(2);
      var insurance = (w * baseRate * containerMultiplier * 0.02).toFixed(2);
      var customs = 250;
      var total = (parseFloat(freight) + parseFloat(handling) + parseFloat(insurance) + customs).toFixed(2);

      var result = document.getElementById('quoteResult');
      if (result) {
        result.style.display = 'block';
        var amountEl = result.querySelector('.quote-amount');
        if (amountEl) amountEl.textContent = '$' + total;
        setTextById('qFreight', '$' + freight);
        setTextById('qHandling', '$' + handling);
        setTextById('qInsurance', '$' + insurance);
        setTextById('qCustoms', '$' + customs.toFixed(2));
      }
    });
  }

  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */
  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  function formatStatus(status) {
    var map = {
      'in-transit': 'In Transit',
      'at-port': 'At Port',
      'customs': 'Customs',
      'delivered': 'Delivered'
    };
    return map[status] || status || 'Unknown';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      var d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function setTextById(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Load data
    loadShipments();
    updateStatusCards();
    renderShipmentsTable();
    renderDocuments(null);

    // Init map
    initMap();

    // Init quote calculator
    initQuoteCalculator();

    // Search button
    var searchBtn = document.getElementById('trackingSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function () {
        var input = document.getElementById('trackingInput');
        if (input) performSearch(input.value);
      });
    }

    // Enter key on search input
    var searchInput = document.getElementById('trackingInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          performSearch(searchInput.value);
        }
      });
    }

    // Sample buttons
    document.querySelectorAll('[data-sample-track]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-sample-track');
        var input = document.getElementById('trackingInput');
        if (input) input.value = id;
        performSearch(id);
      });
    });
  });

})();
