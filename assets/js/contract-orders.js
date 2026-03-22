/**
 * contract-orders.js — Globex Sky Contract Orders Management
 * Handles listing, creating, filtering, and managing contract orders.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'globexsky_contracts';
  const API_BASE = (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || '/api/v1';

  // ─── Demo Data ───────────────────────────────────────────────────────────────

  const DEMO_CONTRACTS = [
    {
      id: 'CTR-2026-001', name: 'Annual Cotton T-Shirt Supply',
      supplier: 'Guangzhou Apparel Co.', products: 'Premium Cotton T-Shirts (5 colors)',
      agreedPrice: 7.00, totalValue: 42000, duration: '12 months',
      startDate: '2026-01-01', endDate: '2026-12-31',
      deliverySchedule: 'Monthly', paymentTerms: '30% deposit, 70% before shipment',
      terms: 'Exclusivity clause for Bangladesh market. Penalty 2% per week for late delivery.',
      status: 'active', createdAt: Date.now() - 1000 * 3600 * 24 * 90,
    },
    {
      id: 'CTR-2026-002', name: 'Q2 Electronics Bulk Order',
      supplier: 'Dongguan Electronics Ltd.', products: 'Wireless Earbuds TWS BT5.0',
      agreedPrice: 18.50, totalValue: 37000, duration: '6 months',
      startDate: '2026-04-01', endDate: '2026-09-30',
      deliverySchedule: 'Bi-monthly', paymentTerms: 'Net 30',
      terms: 'CE + FCC certification required. Quality inspection before shipment.',
      status: 'pending', createdAt: Date.now() - 1000 * 3600 * 24 * 5,
    },
    {
      id: 'CTR-2025-008', name: 'Home Goods Seasonal Contract',
      supplier: 'Zhejiang Home Goods', products: 'Bamboo Cutting Board Set',
      agreedPrice: 11.00, totalValue: 22000, duration: '6 months',
      startDate: '2025-07-01', endDate: '2025-12-31',
      deliverySchedule: 'Monthly', paymentTerms: 'T/T in advance',
      terms: 'Standard quality agreement.',
      status: 'completed', createdAt: Date.now() - 1000 * 3600 * 24 * 200,
    },
    {
      id: 'CTR-2026-003', name: 'Industrial Safety Equipment',
      supplier: 'Shenzhen Safety Co.', products: 'Safety Gloves Level 5, Hard Hats',
      agreedPrice: 4.50, totalValue: 18000, duration: '12 months',
      startDate: '2026-03-01', endDate: '2027-02-28',
      deliverySchedule: 'Monthly', paymentTerms: 'Net 60',
      terms: 'EN388 certification mandatory. ISO 9001 supplier.',
      status: 'draft', createdAt: Date.now() - 1000 * 3600 * 24 * 2,
    },
  ];

  let allContracts = loadContractsFromStorage();
  let currentFilter = 'all';

  // ─── Storage ─────────────────────────────────────────────────────────────────

  function loadContractsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored = raw ? JSON.parse(raw) : [];
      // Merge demo data with stored user contracts
      const ids = new Set(stored.map(c => c.id));
      return [...stored, ...DEMO_CONTRACTS.filter(c => !ids.has(c.id))];
    } catch (e) {
      return [...DEMO_CONTRACTS];
    }
  }

  function saveContracts() {
    try {
      // Only save user-created contracts (those not in demo data)
      const demoIds = new Set(DEMO_CONTRACTS.map(c => c.id));
      const userContracts = allContracts.filter(c => !demoIds.has(c.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userContracts));
    } catch (e) { /* quota — fail silently */ }
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  function updateStats() {
    const active = allContracts.filter(c => c.status === 'active').length;
    const pending = allContracts.filter(c => c.status === 'pending').length;
    const completed = allContracts.filter(c => c.status === 'completed').length;
    const totalVal = allContracts.reduce((sum, c) => sum + (c.totalValue || 0), 0);

    setEl('stat-active', active);
    setEl('stat-pending', pending);
    setEl('stat-completed', completed);
    setEl('stat-total-val', '$' + (totalVal / 1000).toFixed(0) + 'K');
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  function renderContracts(contracts) {
    const list = document.getElementById('contract-list');
    const emptyState = document.getElementById('empty-state');
    if (!list) return;

    if (!contracts || !contracts.length) {
      list.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    list.innerHTML = contracts.map(c => `
      <div class="contract-card" id="c-${c.id}">
        <div class="contract-header">
          <div>
            <div class="contract-id">${c.id}</div>
            <div class="contract-title">${c.name}</div>
          </div>
          <span class="status-badge status-${c.status}">${statusLabel(c.status)}</span>
        </div>
        <div class="contract-details">
          <div class="detail-item"><div class="detail-label">Supplier</div><div class="detail-val">${c.supplier}</div></div>
          <div class="detail-item"><div class="detail-label">Products</div><div class="detail-val">${c.products}</div></div>
          <div class="detail-item"><div class="detail-label">Unit Price</div><div class="detail-val">$${parseFloat(c.agreedPrice).toFixed(2)}</div></div>
          <div class="detail-item"><div class="detail-label">Total Value</div><div class="detail-val">$${c.totalValue.toLocaleString()}</div></div>
          <div class="detail-item"><div class="detail-label">Duration</div><div class="detail-val">${c.duration}</div></div>
          <div class="detail-item"><div class="detail-label">Start → End</div><div class="detail-val">${c.startDate} → ${c.endDate}</div></div>
          <div class="detail-item"><div class="detail-label">Delivery</div><div class="detail-val">${c.deliverySchedule}</div></div>
          <div class="detail-item"><div class="detail-label">Payment</div><div class="detail-val">${c.paymentTerms}</div></div>
        </div>
        ${c.terms ? `<div style="font-size:.8rem;color:#64748b;margin-bottom:12px;padding:10px;background:#f8faff;border-radius:8px"><i class="fas fa-info-circle" style="color:#0052CC;margin-right:5px"></i>${c.terms}</div>` : ''}
        <div class="contract-actions">
          <button class="btn btn-outline btn-sm" onclick="contractManager.viewDetails('${c.id}')"><i class="fas fa-eye"></i> View</button>
          ${c.status === 'draft' ? `<button class="btn btn-primary btn-sm" onclick="contractManager.submitForApproval('${c.id}')"><i class="fas fa-paper-plane"></i> Submit for Approval</button>` : ''}
          ${c.status === 'completed' ? `<button class="btn btn-outline btn-sm" onclick="contractManager.renew('${c.id}')"><i class="fas fa-redo"></i> Renew</button>` : ''}
          ${c.status !== 'cancelled' && c.status !== 'completed' ? `<button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:none;border-radius:8px;cursor:pointer;font-size:.78rem;font-weight:600;padding:6px 14px;display:inline-flex;align-items:center;gap:5px" onclick="contractManager.cancel('${c.id}')"><i class="fas fa-times"></i> Cancel</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="contractManager.downloadPDF('${c.id}')"><i class="fas fa-file-pdf"></i> Download PDF</button>
        </div>
      </div>`).join('');
  }

  function statusLabel(status) {
    return {
      draft: '📝 Draft', pending: '⏳ Pending Approval',
      active: '✅ Active', completed: '🏁 Completed', cancelled: '❌ Cancelled',
    }[status] || status;
  }

  // ─── Filtering ───────────────────────────────────────────────────────────────

  function filterContracts(status, btnEl) {
    currentFilter = status;
    document.querySelectorAll('.status-tab').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    const filtered = status === 'all' ? allContracts : allContracts.filter(c => c.status === status);
    renderContracts(filtered);
  }

  // ─── Create Contract ──────────────────────────────────────────────────────────

  function toggleCreateForm() {
    const form = document.getElementById('create-form');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  function createContract() {
    const name = (document.getElementById('c-name') || {}).value?.trim();
    const supplier = (document.getElementById('c-supplier') || {}).value;
    const products = (document.getElementById('c-products') || {}).value?.trim();
    const price = parseFloat((document.getElementById('c-price') || {}).value);
    const start = (document.getElementById('c-start') || {}).value;
    const end = (document.getElementById('c-end') || {}).value;
    const delivery = (document.getElementById('c-delivery') || {}).value;
    const payment = (document.getElementById('c-payment') || {}).value;
    const terms = (document.getElementById('c-terms') || {}).value?.trim();

    if (!name || !supplier || !products || !price || !start || !end) {
      alert('Please fill in all required fields.'); return;
    }
    if (new Date(start) >= new Date(end)) {
      alert('End date must be after start date.'); return;
    }

    const token = localStorage.getItem('globexsky_token');
    if (!token) { alert('Please log in to create a contract.'); return; }

    const newContract = {
      id: 'CTR-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4),
      name, supplier, products, agreedPrice: price,
      totalValue: 0, duration: 'Custom',
      startDate: start, endDate: end, deliverySchedule: delivery,
      paymentTerms: payment, terms, status: 'draft', createdAt: Date.now(),
    };

    // Try API
    fetch(API_BASE + '/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(newContract),
    })
      .catch(() => { /* API not available — save locally */ })
      .finally(() => {
        allContracts.unshift(newContract);
        saveContracts();
        updateStats();
        toggleCreateForm();
        filterContracts(currentFilter);
        alert('Contract created as Draft. Review and submit for approval when ready.');
      });
  }

  // ─── Contract Actions ─────────────────────────────────────────────────────────

  function viewDetails(contractId) {
    const c = allContracts.find(x => x.id === contractId);
    if (!c) return;
    alert(
      `Contract: ${c.name}\nID: ${c.id}\nSupplier: ${c.supplier}\nProducts: ${c.products}\n` +
      `Unit Price: $${c.agreedPrice}\nTotal Value: $${c.totalValue.toLocaleString()}\n` +
      `Period: ${c.startDate} → ${c.endDate}\nDelivery: ${c.deliverySchedule}\n` +
      `Payment: ${c.paymentTerms}\nStatus: ${c.status.toUpperCase()}\n\nTerms:\n${c.terms || 'Standard'}`
    );
  }

  function submitForApproval(contractId) {
    const c = allContracts.find(x => x.id === contractId);
    if (!c || c.status !== 'draft') return;
    c.status = 'pending';
    saveContracts();
    filterContracts(currentFilter);
    updateStats();
    alert('Contract submitted for approval. The supplier will review and confirm within 48 hours.');
  }

  function renew(contractId) {
    const c = allContracts.find(x => x.id === contractId);
    if (!c) return;
    const newContract = {
      ...c,
      id: 'CTR-' + new Date().getFullYear() + '-R' + String(Date.now()).slice(-4),
      status: 'draft',
      startDate: c.endDate,
      endDate: '',
      createdAt: Date.now(),
      name: c.name + ' (Renewal)',
    };
    allContracts.unshift(newContract);
    saveContracts();
    filterContracts(currentFilter);
    updateStats();
    alert('Renewal contract created as Draft. Please update the dates and submit for approval.');
  }

  function cancel(contractId) {
    if (!confirm('Are you sure you want to cancel this contract?')) return;
    const c = allContracts.find(x => x.id === contractId);
    if (!c) return;
    c.status = 'cancelled';
    saveContracts();
    filterContracts(currentFilter);
    updateStats();
  }

  function downloadPDF(contractId) {
    const c = allContracts.find(x => x.id === contractId);
    if (!c) return;
    // Generate a simple text-based PDF using window.print approach
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to download the contract.'); return; }
    win.document.write(`
      <html><head><title>Contract ${c.id}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a2e}h1{color:#0052CC}table{width:100%;border-collapse:collapse;margin:20px 0}td{padding:8px 12px;border:1px solid #e2e8f0}td:first-child{font-weight:bold;background:#f8faff;width:35%}</style>
      </head><body>
      <h1>Contract Order: ${c.id}</h1>
      <p><strong>Globex International Trade Co., Ltd.</strong></p>
      <table>
        <tr><td>Contract Name</td><td>${c.name}</td></tr>
        <tr><td>Supplier</td><td>${c.supplier}</td></tr>
        <tr><td>Products</td><td>${c.products}</td></tr>
        <tr><td>Agreed Unit Price</td><td>$${c.agreedPrice}</td></tr>
        <tr><td>Total Value</td><td>$${c.totalValue.toLocaleString()}</td></tr>
        <tr><td>Start Date</td><td>${c.startDate}</td></tr>
        <tr><td>End Date</td><td>${c.endDate}</td></tr>
        <tr><td>Delivery Schedule</td><td>${c.deliverySchedule}</td></tr>
        <tr><td>Payment Terms</td><td>${c.paymentTerms}</td></tr>
        <tr><td>Status</td><td>${c.status.toUpperCase()}</td></tr>
        <tr><td>Terms & Conditions</td><td>${c.terms || 'Standard terms apply.'}</td></tr>
      </table>
      <p style="margin-top:40px;color:#64748b;font-size:.85rem">Generated by Globex Sky on ${new Date().toLocaleDateString()}</p>
      <script>window.print();window.close();<\/script>
      </body></html>`);
    win.document.close();
  }

  // ─── Global Exposure ─────────────────────────────────────────────────────────

  window.contractManager = {
    render: renderContracts,
    filter: filterContracts,
    toggleCreateForm,
    create: createContract,
    viewDetails,
    submitForApproval,
    renew,
    cancel: cancel,
    downloadPDF,
    getAll: () => allContracts,
  };

  // Page-level helpers for inline onclick handlers
  window.filterContracts = filterContracts;
  window.toggleCreateForm = toggleCreateForm;
  window.createContract = createContract;

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('contract-list')) {
      updateStats();
      renderContracts(allContracts);
    }
  });

})();
