/**
 * Supplier Scorecard & Badge System
 * GlobexSky B2B E-Commerce Platform
 *
 * Features:
 *  - Score calculation engine
 *  - Chart.js rendering (trend + radar + comparison)
 *  - Badge eligibility checking
 *  - 12 sample suppliers with scores
 *  - 8 badge types with criteria
 *  - Score history tracking (12 months)
 *  - Badge award animations
 *  - Supplier comparison logic
 *  - localStorage persistence
 */

/* global Chart */

const SupplierScorecard = (() => {
  // ── Storage Keys ──
  const KEYS = {
    suppliers: 'gsky_suppliers',
    badges: 'gsky_badge_types',
    awards: 'gsky_badge_awards',
    history: 'gsky_score_history',
  };

  // ── 8+ Badge Types ──
  const DEFAULT_BADGE_TYPES = [
    { id: 'gold_supplier', name: 'Gold Supplier', icon: 'fa-medal', color: 'gold-bg', description: 'Achieved an overall score of 85+', criteria: { overall_min: 85 } },
    { id: 'verified', name: 'Verified', icon: 'fa-check-circle', color: 'blue-bg', description: 'Identity and business verified', criteria: { verified: true } },
    { id: 'fast_shipper', name: 'Fast Shipper', icon: 'fa-shipping-fast', color: 'green-bg', description: 'Delivery score of 90+', criteria: { delivery_min: 90 } },
    { id: 'top_rated', name: 'Top Rated', icon: 'fa-star', color: 'purple-bg', description: 'Average rating of 4.5+ stars', criteria: { rating_min: 4.5 } },
    { id: 'eco_friendly', name: 'Eco-Friendly', icon: 'fa-leaf', color: 'teal-bg', description: 'Meets sustainability standards', criteria: { eco_certified: true } },
    { id: 'premium_quality', name: 'Premium Quality', icon: 'fa-gem', color: 'indigo-bg', description: 'Quality score of 90+', criteria: { quality_min: 90 } },
    { id: 'responsive', name: 'Quick Responder', icon: 'fa-bolt', color: 'orange-bg', description: 'Communication score of 90+', criteria: { communication_min: 90 } },
    { id: 'compliance_star', name: 'Compliance Star', icon: 'fa-shield-alt', color: 'red-bg', description: 'Compliance score of 95+', criteria: { compliance_min: 95 } },
  ];

  // ── 12 Sample Suppliers ──
  const DEFAULT_SUPPLIERS = [
    { id: 'sup_001', name: 'TechParts Global', country: 'China', category: 'Electronics', email: 'sales@techparts.cn', joined: '2022-03-15', verified: true, eco_certified: true, rating: 4.8, scores: { quality: 92, delivery: 88, communication: 85, pricing: 90, compliance: 95 } },
    { id: 'sup_002', name: 'SteelForge Industries', country: 'India', category: 'Metals', email: 'info@steelforge.in', joined: '2021-07-20', verified: true, eco_certified: false, rating: 4.5, scores: { quality: 87, delivery: 82, communication: 78, pricing: 85, compliance: 91 } },
    { id: 'sup_003', name: 'GreenLeaf Textiles', country: 'Bangladesh', category: 'Textiles', email: 'contact@greenleaf.bd', joined: '2023-01-10', verified: true, eco_certified: true, rating: 4.6, scores: { quality: 84, delivery: 79, communication: 92, pricing: 88, compliance: 86 } },
    { id: 'sup_004', name: 'OceanBlue Logistics', country: 'Singapore', category: 'Logistics', email: 'ops@oceanblue.sg', joined: '2020-11-05', verified: true, eco_certified: false, rating: 4.3, scores: { quality: 80, delivery: 95, communication: 88, pricing: 82, compliance: 90 } },
    { id: 'sup_005', name: 'PrecisionTools Co.', country: 'Germany', category: 'Tools', email: 'sales@precisiontools.de', joined: '2022-06-18', verified: true, eco_certified: true, rating: 4.9, scores: { quality: 96, delivery: 91, communication: 90, pricing: 78, compliance: 97 } },
    { id: 'sup_006', name: 'SilkRoad Trading', country: 'Turkey', category: 'Textiles', email: 'trade@silkroad.tr', joined: '2023-04-22', verified: false, eco_certified: false, rating: 3.8, scores: { quality: 72, delivery: 68, communication: 74, pricing: 92, compliance: 70 } },
    { id: 'sup_007', name: 'NovaChem Labs', country: 'USA', category: 'Chemicals', email: 'lab@novachem.us', joined: '2021-09-14', verified: true, eco_certified: true, rating: 4.7, scores: { quality: 94, delivery: 86, communication: 82, pricing: 75, compliance: 98 } },
    { id: 'sup_008', name: 'MapleCraft Furniture', country: 'Canada', category: 'Furniture', email: 'info@maplecraft.ca', joined: '2022-12-01', verified: true, eco_certified: true, rating: 4.4, scores: { quality: 88, delivery: 83, communication: 86, pricing: 80, compliance: 88 } },
    { id: 'sup_009', name: 'SwiftPack Solutions', country: 'Vietnam', category: 'Packaging', email: 'hello@swiftpack.vn', joined: '2023-08-10', verified: true, eco_certified: false, rating: 4.1, scores: { quality: 76, delivery: 92, communication: 80, pricing: 94, compliance: 82 } },
    { id: 'sup_010', name: 'BrightStar Electronics', country: 'South Korea', category: 'Electronics', email: 'sales@brightstar.kr', joined: '2021-02-28', verified: true, eco_certified: false, rating: 4.6, scores: { quality: 90, delivery: 87, communication: 83, pricing: 86, compliance: 92 } },
    { id: 'sup_011', name: 'AgroFresh Exports', country: 'Brazil', category: 'Agriculture', email: 'export@agrofresh.br', joined: '2023-03-05', verified: false, eco_certified: true, rating: 4.0, scores: { quality: 78, delivery: 71, communication: 88, pricing: 90, compliance: 75 } },
    { id: 'sup_012', name: 'AlpineGear Sports', country: 'Switzerland', category: 'Sports', email: 'gear@alpinegear.ch', joined: '2022-09-20', verified: true, eco_certified: true, rating: 4.8, scores: { quality: 95, delivery: 90, communication: 91, pricing: 72, compliance: 96 } },
  ];

  // ── Initialize ──
  function init() {
    if (!localStorage.getItem(KEYS.suppliers)) {
      localStorage.setItem(KEYS.suppliers, JSON.stringify(DEFAULT_SUPPLIERS));
    }
    if (!localStorage.getItem(KEYS.badges)) {
      localStorage.setItem(KEYS.badges, JSON.stringify(DEFAULT_BADGE_TYPES));
    }
    if (!localStorage.getItem(KEYS.history)) {
      localStorage.setItem(KEYS.history, JSON.stringify(generateHistory()));
    }
    if (!localStorage.getItem(KEYS.awards)) {
      const awards = computeAllAwards();
      localStorage.setItem(KEYS.awards, JSON.stringify(awards));
    }
  }

  // ── Data Access ──
  function getSuppliers() { return JSON.parse(localStorage.getItem(KEYS.suppliers) || '[]'); }
  function getBadgeTypes() { return JSON.parse(localStorage.getItem(KEYS.badges) || '[]'); }
  function getAwards() { return JSON.parse(localStorage.getItem(KEYS.awards) || '{}'); }
  function getHistory() { return JSON.parse(localStorage.getItem(KEYS.history) || '{}'); }

  function saveSuppliers(s) { localStorage.setItem(KEYS.suppliers, JSON.stringify(s)); }
  function saveBadgeTypes(b) { localStorage.setItem(KEYS.badges, JSON.stringify(b)); }
  function saveAwards(a) { localStorage.setItem(KEYS.awards, JSON.stringify(a)); }

  function getSupplier(id) { return getSuppliers().find(s => s.id === id); }

  // ── Score Calculation ──
  function calculateOverall(scores) {
    if (!scores) return 0;
    const weights = { quality: 0.25, delivery: 0.2, communication: 0.15, pricing: 0.15, compliance: 0.25 };
    let total = 0, wSum = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (scores[key] !== undefined) {
        total += scores[key] * weight;
        wSum += weight;
      }
    }
    return wSum > 0 ? Math.round(total / wSum) : 0;
  }

  function getTier(overall) {
    if (overall >= 90) return 'diamond';
    if (overall >= 80) return 'gold';
    if (overall >= 65) return 'silver';
    if (overall >= 50) return 'bronze';
    return 'unverified';
  }

  function getScoreClass(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'average';
    return 'poor';
  }

  // ── Category Averages ──
  function getCategoryAverages() {
    const suppliers = getSuppliers();
    const cats = ['quality', 'delivery', 'communication', 'pricing', 'compliance'];
    const avgs = {};
    cats.forEach(c => {
      const vals = suppliers.map(s => s.scores[c]).filter(v => v !== undefined);
      avgs[c] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    });
    avgs.overall = Math.round(suppliers.map(s => calculateOverall(s.scores)).reduce((a, b) => a + b, 0) / (suppliers.length || 1));
    return avgs;
  }

  // ── Score History (12 months) ──
  function generateHistory() {
    const suppliers = getSuppliers();
    const history = {};
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
    }
    suppliers.forEach(s => {
      const base = calculateOverall(s.scores);
      history[s.id] = {
        labels: months,
        scores: months.map((_, i) => {
          const variance = Math.round((Math.random() - 0.4) * 12);
          return Math.max(30, Math.min(100, base + variance - (11 - i) * 0.5));
        }),
      };
      // Make last month the current score
      history[s.id].scores[11] = base;
    });
    return history;
  }

  // ── Badge Eligibility ──
  function checkEligibility(supplier, badgeType) {
    const c = badgeType.criteria;
    const s = supplier.scores;
    const overall = calculateOverall(s);

    if (c.overall_min && overall < c.overall_min) return false;
    if (c.quality_min && (s.quality || 0) < c.quality_min) return false;
    if (c.delivery_min && (s.delivery || 0) < c.delivery_min) return false;
    if (c.communication_min && (s.communication || 0) < c.communication_min) return false;
    if (c.compliance_min && (s.compliance || 0) < c.compliance_min) return false;
    if (c.rating_min && (supplier.rating || 0) < c.rating_min) return false;
    if (c.verified && !supplier.verified) return false;
    if (c.eco_certified && !supplier.eco_certified) return false;
    return true;
  }

  function computeAllAwards() {
    const suppliers = getSuppliers();
    const badges = getBadgeTypes();
    const awards = {};
    suppliers.forEach(s => {
      awards[s.id] = badges.filter(b => checkEligibility(s, b)).map(b => b.id);
    });
    return awards;
  }

  function refreshAwards() {
    const awards = computeAllAwards();
    saveAwards(awards);
    return awards;
  }

  // ── Manual Badge Management ──
  function awardBadge(supplierId, badgeId) {
    const awards = getAwards();
    if (!awards[supplierId]) awards[supplierId] = [];
    if (!awards[supplierId].includes(badgeId)) {
      awards[supplierId].push(badgeId);
    }
    saveAwards(awards);
  }

  function revokeBadge(supplierId, badgeId) {
    const awards = getAwards();
    if (awards[supplierId]) {
      awards[supplierId] = awards[supplierId].filter(id => id !== badgeId);
    }
    saveAwards(awards);
  }

  // ── Rankings ──
  function getRankings() {
    const suppliers = getSuppliers();
    const awards = getAwards();
    return suppliers.map(s => ({
      ...s,
      overall: calculateOverall(s.scores),
      tier: getTier(calculateOverall(s.scores)),
      badgeCount: (awards[s.id] || []).length,
      badges: awards[s.id] || [],
    })).sort((a, b) => b.overall - a.overall);
  }

  // ── Chart Rendering ──

  function renderTrendChart(canvasId, supplierId) {
    const history = getHistory();
    const data = history[supplierId];
    if (!data) return null;

    const avgs = getCategoryAverages();
    const avgLine = data.labels.map(() => avgs.overall);

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    try {
      if (typeof Chart === 'undefined') return null;
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            {
              label: 'Your Score',
              data: data.scores,
              borderColor: '#0052CC',
              backgroundColor: 'rgba(0,82,204,.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2.5,
            },
            {
              label: 'Category Average',
              data: avgLine,
              borderColor: '#94a3b8',
              borderDash: [6, 4],
              fill: false,
              tension: 0,
              pointRadius: 0,
              borderWidth: 1.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } } },
          scales: {
            y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,.05)' } },
            x: { grid: { display: false } },
          },
        },
      });
    } catch (e) { return null; }
  }

  function renderRadarChart(canvasId, supplierId) {
    const supplier = getSupplier(supplierId);
    if (!supplier) return null;
    const avgs = getCategoryAverages();
    const labels = ['Quality', 'Delivery', 'Communication', 'Pricing', 'Compliance'];
    const cats = ['quality', 'delivery', 'communication', 'pricing', 'compliance'];

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    try {
      if (typeof Chart === 'undefined') return null;
      return new Chart(ctx, {
        type: 'radar',
        data: {
          labels,
          datasets: [
            {
              label: supplier.name,
              data: cats.map(c => supplier.scores[c] || 0),
              borderColor: '#0052CC',
              backgroundColor: 'rgba(0,82,204,.15)',
              borderWidth: 2,
              pointRadius: 4,
            },
            {
              label: 'Category Average',
              data: cats.map(c => avgs[c]),
              borderColor: '#94a3b8',
              backgroundColor: 'rgba(148,163,184,.1)',
              borderWidth: 1.5,
              borderDash: [4, 4],
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } } },
          scales: {
            r: { min: 0, max: 100, ticks: { stepSize: 20, display: false }, grid: { color: 'rgba(0,0,0,.08)' }, pointLabels: { font: { size: 12, family: 'Inter' } } },
          },
        },
      });
    } catch (e) { return null; }
  }

  function renderComparisonBar(canvasId, supplierId) {
    const supplier = getSupplier(supplierId);
    if (!supplier) return null;
    const avgs = getCategoryAverages();
    const labels = ['Quality', 'Delivery', 'Communication', 'Pricing', 'Compliance'];
    const cats = ['quality', 'delivery', 'communication', 'pricing', 'compliance'];

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    try {
      if (typeof Chart === 'undefined') return null;
      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Your Score',
              data: cats.map(c => supplier.scores[c] || 0),
              backgroundColor: '#0052CC',
              borderRadius: 6,
              barPercentage: 0.5,
            },
            {
              label: 'Category Average',
              data: cats.map(c => avgs[c]),
              backgroundColor: '#e2e8f0',
              borderRadius: 6,
              barPercentage: 0.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } } },
          scales: {
            y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,.05)' } },
            x: { grid: { display: false } },
          },
        },
      });
    } catch (e) { return null; }
  }

  // ── Badge Award Animation ──
  function animateBadgeAward(cardElement) {
    if (!cardElement) return;
    cardElement.classList.remove('animate-award');
    // Trigger reflow
    void cardElement.offsetWidth;
    cardElement.classList.add('animate-award');
  }

  // ── Review/Feedback Mock Data ──
  function getReviewSummary(supplierId) {
    const supplier = getSupplier(supplierId);
    if (!supplier) return null;
    const r = supplier.rating || 4.0;
    return {
      average: r,
      total: Math.floor(Math.random() * 80) + 20,
      distribution: {
        5: Math.round(r >= 4.5 ? 55 : r >= 4 ? 40 : 25),
        4: Math.round(r >= 4 ? 25 : 30),
        3: Math.round(10),
        2: Math.round(r < 4 ? 10 : 5),
        1: Math.round(r < 3.5 ? 10 : 5),
      },
    };
  }

  function getRecentReviews(supplierId) {
    const names = ['Sarah Chen', 'Michael Torres', 'Priya Sharma', 'James Wilson', 'Fatima Al-Rashid'];
    const comments = [
      'Excellent quality products with great packaging. Will order again.',
      'Shipping was fast, but one item was slightly damaged. Good communication about replacement.',
      'Very professional supplier. Documentation and compliance are top-notch.',
      'Good pricing and consistent quality. Response time could be faster.',
      'Outstanding service from start to finish. Highly recommended.',
    ];
    return names.map((name, i) => ({
      name,
      initials: name.split(' ').map(n => n[0]).join(''),
      date: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      rating: Math.max(3, Math.min(5, 5 - Math.floor(i / 2))),
      comment: comments[i],
    }));
  }

  // ── Badge Type CRUD (Admin) ──
  function addBadgeType(badge) {
    const badges = getBadgeTypes();
    badge.id = badge.id || 'badge_' + Date.now();
    badges.push(badge);
    saveBadgeTypes(badges);
    return badge;
  }

  function updateBadgeType(id, updates) {
    const badges = getBadgeTypes();
    const idx = badges.findIndex(b => b.id === id);
    if (idx >= 0) {
      badges[idx] = { ...badges[idx], ...updates };
      saveBadgeTypes(badges);
    }
  }

  function deleteBadgeType(id) {
    let badges = getBadgeTypes();
    badges = badges.filter(b => b.id !== id);
    saveBadgeTypes(badges);
  }

  // ── Badge Statistics ──
  function getBadgeStats() {
    const awards = getAwards();
    const badges = getBadgeTypes();
    return badges.map(b => ({
      ...b,
      count: Object.values(awards).filter(a => a.includes(b.id)).length,
    }));
  }

  // ── Public API ──
  return {
    init,
    getSuppliers,
    getSupplier,
    getBadgeTypes,
    getAwards,
    getHistory,
    calculateOverall,
    getTier,
    getScoreClass,
    getCategoryAverages,
    checkEligibility,
    refreshAwards,
    awardBadge,
    revokeBadge,
    getRankings,
    renderTrendChart,
    renderRadarChart,
    renderComparisonBar,
    animateBadgeAward,
    getReviewSummary,
    getRecentReviews,
    addBadgeType,
    updateBadgeType,
    deleteBadgeType,
    getBadgeStats,
    saveSuppliers,
    saveBadgeTypes,
    saveAwards,
    computeAllAwards,
  };
})();

// Auto-init on load
SupplierScorecard.init();
