/**
 * sourcing-board.js — Globex Sky Sourcing Board
 * Handles posting sourcing requests, browsing/filtering, and submitting bids.
 */

(function () {
  'use strict';

  const API_BASE = (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || '/api/v1';

  // ─── Demo Data ───────────────────────────────────────────────────────────────

  const DEMO_REQUESTS = [
    {
      id: 'SR-001', title: '5,000 Custom Logo Tote Bags', category: 'Apparel & Textiles',
      description: 'Looking for a supplier of eco-friendly non-woven tote bags, custom printed with our company logo in 3 colors. Must be BSCI certified.',
      quantity: '5,000 pcs', budgetMin: 8000, budgetMax: 15000,
      deadline: '2026-05-15', bids: 7, status: 'open',
      buyer: 'Ahmed K.', postedAt: Date.now() - 1000 * 3600 * 24 * 2,
    },
    {
      id: 'SR-002', title: 'Bulk Order — Stainless Steel Insulated Bottles',
      category: 'Home & Garden', description: '10,000 units of 500ml stainless steel vacuum bottles with custom color. BPA-free, FDA approved. Need samples first.',
      quantity: '10,000 units', budgetMin: 60000, budgetMax: 90000,
      deadline: '2026-04-30', bids: 12, status: 'progress',
      buyer: 'Maria S.', postedAt: Date.now() - 1000 * 3600 * 24 * 5,
    },
    {
      id: 'SR-003', title: 'Wireless Earbuds OEM — 2,000 pcs',
      category: 'Electronics', description: 'Seeking OEM supplier for TWS earbuds, Bluetooth 5.0, 24h battery life, custom packaging. CE and FCC certification required.',
      quantity: '2,000 pcs', budgetMin: 30000, budgetMax: 50000,
      deadline: '2026-06-01', bids: 5, status: 'open',
      buyer: 'John T.', postedAt: Date.now() - 1000 * 3600 * 24 * 1,
    },
    {
      id: 'SR-004', title: 'Industrial Safety Gloves — Monthly Contract',
      category: 'Industrial', description: 'Need a reliable supplier for cut-resistant safety gloves, Level 5, EN388 certified. Monthly delivery of 500 pairs.',
      quantity: '500 pairs/month', budgetMin: 3000, budgetMax: 5000,
      deadline: '2026-04-15', bids: 9, status: 'open',
      buyer: 'Priya M.', postedAt: Date.now() - 1000 * 3600 * 24 * 3,
    },
    {
      id: 'SR-005', title: 'Organic Green Tea — 5 Tons',
      category: 'Food & Beverages', description: 'Looking for certified organic green tea supplier, loose leaf, food-grade packaging. ISO 22000 required. FOB Guangzhou.',
      quantity: '5,000 kg', budgetMin: 20000, budgetMax: 35000,
      deadline: '2026-05-01', bids: 4, status: 'closed',
      buyer: 'Li W.', postedAt: Date.now() - 1000 * 3600 * 24 * 14,
    },
  ];

  let allRequests = [...DEMO_REQUESTS];
  let currentView = 'buyer'; // 'buyer' | 'supplier'
  let activeBidRequestId = null;

  // ─── Rendering ──────────────────────────────────────────────────────────────

  function renderRequests(requests) {
    const grid = document.getElementById('requests-grid');
    if (!grid) return;

    if (!requests || !requests.length) {
      grid.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b">No sourcing requests found matching your filters.</div>';
      return;
    }

    grid.innerHTML = requests.map(r => `
      <div class="request-card" id="req-${r.id}">
        <div class="req-header">
          <div>
            <div class="req-title">${r.title}</div>
            <div class="req-meta">
              <span class="meta-tag tag-category">${r.category}</span>
              <span class="meta-tag ${statusClass(r.status)}">${statusLabel(r.status)}</span>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:.75rem;color:#64748b">${timeAgo(r.postedAt)}</div>
            <div style="font-size:.82rem;color:#374151;margin-top:2px">by <strong>${r.buyer}</strong></div>
          </div>
        </div>
        <div class="req-desc">${r.description}</div>
        <div class="req-details">
          <div class="req-detail"><i class="fas fa-layer-group" style="color:#0052CC"></i> <span>Qty: </span><strong>${r.quantity}</strong></div>
          <div class="req-detail"><i class="fas fa-dollar-sign" style="color:#059669"></i> <span>Budget: </span><strong>$${r.budgetMin.toLocaleString()}–$${r.budgetMax.toLocaleString()}</strong></div>
          <div class="req-detail"><i class="fas fa-calendar-alt" style="color:#dc2626"></i> <span>Deadline: </span><strong>${r.deadline}</strong></div>
        </div>
        <div class="req-actions">
          ${currentView === 'supplier' && r.status === 'open' ? `
            <button class="btn btn-primary btn-sm" onclick="openBidModal('${r.id}')"><i class="fas fa-gavel"></i> Submit Bid</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="viewRequestDetail('${r.id}')"><i class="fas fa-eye"></i> View Details</button>
          <span class="bids-count"><i class="fas fa-comments" style="color:#0052CC"></i> ${r.bids} bid${r.bids !== 1 ? 's' : ''}</span>
        </div>
      </div>`).join('');
  }

  function statusClass(status) {
    return { open: 'tag-open', progress: 'tag-progress', closed: 'tag-closed' }[status] || 'tag-closed';
  }

  function statusLabel(status) {
    return { open: 'Open', progress: 'In Progress', closed: 'Closed' }[status] || status;
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  // ─── Filtering ───────────────────────────────────────────────────────────────

  function applyFilters() {
    const selects = document.querySelectorAll('.filter-select');
    let filtered = [...allRequests];

    if (selects[0] && selects[0].value) {
      filtered = filtered.filter(r => r.category === selects[0].value);
    }
    if (selects[1] && selects[1].value) {
      const budgetMap = {
        'Under $5,000': [0, 5000],
        '$5,000–$50,000': [5000, 50000],
        '$50,000–$200,000': [50000, 200000],
        '$200,000+': [200000, Infinity],
      };
      const range = budgetMap[selects[1].value];
      if (range) filtered = filtered.filter(r => r.budgetMin <= range[1] && r.budgetMax >= range[0]);
    }
    if (selects[2] && selects[2].value) {
      const sv = selects[2].value.toLowerCase().replace(' ', '');
      filtered = filtered.filter(r => {
        if (sv === 'open') return r.status === 'open';
        if (sv === 'inprogress') return r.status === 'progress';
        if (sv === 'closed') return r.status === 'closed';
        return true;
      });
    }

    renderRequests(filtered);
  }

  // ─── View Switching ──────────────────────────────────────────────────────────

  function switchView(view, btnEl) {
    currentView = view;
    document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const postBtn = document.getElementById('post-request-btn');
    if (postBtn) {
      postBtn.style.display = view === 'buyer' ? 'inline-flex' : 'none';
    }
    renderRequests(allRequests);
  }

  // ─── Post New Request ─────────────────────────────────────────────────────────

  function togglePostForm() {
    const form = document.getElementById('post-form');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  function submitRequest() {
    const title = (document.getElementById('req-title') || {}).value?.trim();
    const category = (document.getElementById('req-category') || {}).value;
    const quantity = (document.getElementById('req-quantity') || {}).value?.trim();
    const budgetMin = parseFloat((document.getElementById('req-budget-min') || {}).value);
    const budgetMax = parseFloat((document.getElementById('req-budget-max') || {}).value);
    const deadline = (document.getElementById('req-deadline') || {}).value;
    const desc = (document.getElementById('req-desc') || {}).value?.trim();

    if (!title || !category || !quantity || !deadline || !desc) {
      alert('Please fill in all required fields.'); return;
    }
    if (!budgetMin || !budgetMax || budgetMin > budgetMax) {
      alert('Please enter a valid budget range.'); return;
    }

    const token = localStorage.getItem('globexsky_token');
    if (!token) { alert('Please log in to post a sourcing request.'); return; }

    const newReq = {
      id: 'SR-' + String(Date.now()).slice(-6),
      title, category, description: desc, quantity,
      budgetMin, budgetMax, deadline, bids: 0, status: 'open',
      buyer: 'You', postedAt: Date.now(),
    };

    // Try API
    fetch(API_BASE + '/rfq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ title, category, quantity, budget_min: budgetMin, budget_max: budgetMax, deadline, description: desc }),
    })
      .catch(() => { /* API not available — add locally */ })
      .finally(() => {
        allRequests.unshift(newReq);
        renderRequests(allRequests);
        togglePostForm();
        alert('Sourcing request posted! Suppliers will start bidding shortly.');
      });
  }

  // ─── Bid Modal ───────────────────────────────────────────────────────────────

  function openBidModal(requestId) {
    const token = localStorage.getItem('globexsky_token');
    if (!token) { alert('Please log in as a supplier to submit a bid.'); return; }
    activeBidRequestId = requestId;
    const modal = document.getElementById('bid-modal');
    if (modal) modal.style.display = 'flex';
  }

  function closeBidModal(event) {
    const modal = document.getElementById('bid-modal');
    if (event && event.target !== modal) return;
    if (modal) modal.style.display = 'none';
    activeBidRequestId = null;
  }

  function submitBid() {
    const price = (document.getElementById('bid-price') || {}).value;
    const leadTime = (document.getElementById('bid-lead') || {}).value?.trim();
    const notes = (document.getElementById('bid-notes') || {}).value?.trim();

    if (!price || parseFloat(price) <= 0) { alert('Please enter a valid bid price.'); return; }
    if (!leadTime) { alert('Please enter an estimated lead time.'); return; }

    const token = localStorage.getItem('globexsky_token');
    fetch(API_BASE + '/rfq/' + activeBidRequestId + '/bids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ price: parseFloat(price), lead_time: leadTime, notes }),
    })
      .catch(() => { /* API not available — update locally */ })
      .finally(() => {
        // Update bid count in demo data
        const req = allRequests.find(r => r.id === activeBidRequestId);
        if (req) req.bids++;
        document.getElementById('bid-modal').style.display = 'none';
        activeBidRequestId = null;
        renderRequests(allRequests);
        alert('Bid submitted successfully! The buyer will review your bid.');
      });
  }

  function viewRequestDetail(requestId) {
    const req = allRequests.find(r => r.id === requestId);
    if (!req) return;
    alert(`Request: ${req.title}\n\nCategory: ${req.category}\nQuantity: ${req.quantity}\nBudget: $${req.budgetMin.toLocaleString()}–$${req.budgetMax.toLocaleString()}\nDeadline: ${req.deadline}\nBids: ${req.bids}\n\nDescription:\n${req.description}`);
  }

  // ─── Global Exposure ─────────────────────────────────────────────────────────

  window.sourcingBoard = {
    render: renderRequests,
    switchView,
    togglePostForm,
    submitRequest,
    applyFilters,
    openBidModal,
    closeBidModal,
    submitBid,
  };

  // Page-level helpers for inline onclick handlers
  window.switchView = switchView;
  window.togglePostForm = togglePostForm;
  window.submitRequest = submitRequest;
  window.applyFilters = applyFilters;
  window.openBidModal = openBidModal;
  window.closeBidModal = closeBidModal;
  window.submitBid = submitBid;
  window.viewRequestDetail = viewRequestDetail;

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('requests-grid')) {
      renderRequests(allRequests);
    }
  });

})();
