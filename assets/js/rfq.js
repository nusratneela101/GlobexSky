/**
 * rfq.js - RFQ (Request for Quotation) Frontend Logic
 * Globex Sky Platform
 */

const RFQAPI = {
  BASE_URL: '/api/v1/rfq',

  getHeaders(json = true) {
    const token = localStorage.getItem('auth_token');
    const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  },

  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${this.BASE_URL}?${query}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`Failed to load RFQs: ${res.status}`);
    return res.json();
  },

  async get(id) {
    const res = await fetch(`${this.BASE_URL}/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`RFQ not found: ${res.status}`);
    return res.json();
  },

  async create(data) {
    const res = await fetch(this.BASE_URL, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Failed to create RFQ');
    }
    return res.json();
  },

  async update(id, data) {
    const res = await fetch(`${this.BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update RFQ');
    return res.json();
  },

  async close(id) {
    return this.update(id, { status: 'closed' });
  },

  async getQuotations(rfqId) {
    const res = await fetch(`${this.BASE_URL}/${rfqId}/quotations`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`Failed to load quotations: ${res.status}`);
    return res.json();
  },

  async submitQuotation(rfqId, data) {
    const res = await fetch(`${this.BASE_URL}/${rfqId}/quotations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Failed to submit quotation');
    }
    return res.json();
  },

  async selectQuotation(rfqId, quotationId) {
    const res = await fetch(`${this.BASE_URL}/${rfqId}/select/${quotationId}`, {
      method: 'PUT',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to select quotation');
    return res.json();
  },

  async convertToOrder(rfqId, quotationId) {
    const res = await fetch(`${this.BASE_URL}/${rfqId}/convert-to-order`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ quotation_id: quotationId })
    });
    if (!res.ok) throw new Error('Failed to convert RFQ to order');
    return res.json();
  },

  async sendMessage(rfqId, quotationId, message) {
    const res = await fetch(`${this.BASE_URL}/${rfqId}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ quotation_id: quotationId, message })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  }
};

/**
 * Format RFQ status for display
 */
function formatRFQStatus(status) {
  const statuses = {
    draft: { label: 'Draft', class: 'badge-warning', icon: 'fa-edit' },
    open: { label: 'Open', class: 'badge-info', icon: 'fa-door-open' },
    closed: { label: 'Closed', class: 'badge-secondary', icon: 'fa-door-closed' },
    awarded: { label: 'Awarded', class: 'badge-success', icon: 'fa-trophy' },
    cancelled: { label: 'Cancelled', class: 'badge-danger', icon: 'fa-ban' }
  };
  return statuses[status] || { label: status, class: 'badge-secondary', icon: 'fa-question' };
}

/**
 * Format quotation status for display
 */
function formatQuotationStatus(status) {
  const statuses = {
    submitted: { label: 'New', class: 'badge-info' },
    under_review: { label: 'Under Review', class: 'badge-warning' },
    accepted: { label: 'Accepted', class: 'badge-success' },
    rejected: { label: 'Rejected', class: 'badge-danger' },
    negotiating: { label: 'Negotiating', class: 'badge-warning' }
  };
  return statuses[status] || { label: status, class: 'badge-secondary' };
}

/**
 * Calculate total price
 */
function calcQuotationTotal(unitPrice, quantity) {
  return (parseFloat(unitPrice) * parseInt(quantity)).toFixed(2);
}

/**
 * Render RFQ card for list view
 */
function renderRFQCard(rfq) {
  const statusInfo = formatRFQStatus(rfq.status);
  const daysLeft = rfq.deadline
    ? Math.max(0, Math.ceil((new Date(rfq.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  return `
    <a href="detail.html?id=${rfq.id}" class="rfq-card status-${rfq.status}">
      <div class="rfq-header">
        <div>
          <div class="rfq-title">${rfq.title}</div>
          <div class="rfq-category"><i class="fas fa-tag"></i> ${rfq.category}</div>
        </div>
        <span class="badge ${statusInfo.class}"><i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}</span>
      </div>
      <div class="rfq-meta">
        <span class="rfq-meta-item"><i class="fas fa-boxes"></i> <strong>${rfq.quantity?.toLocaleString()}</strong> ${rfq.unit || 'pieces'}</span>
        ${rfq.target_price ? `<span class="rfq-meta-item"><i class="fas fa-dollar-sign"></i> Target: <strong>$${rfq.target_price}/unit</strong></span>` : ''}
        ${rfq.deadline ? `<span class="rfq-meta-item"><i class="fas fa-calendar-alt"></i> Deadline: <strong>${new Date(rfq.deadline).toLocaleDateString()}</strong></span>` : ''}
        ${daysLeft !== null && rfq.status === 'open' ? `<span class="rfq-meta-item" style="color:${daysLeft < 3 ? '#ef4444' : '#f97316'}"><i class="fas fa-clock"></i> <strong>${daysLeft} days left</strong></span>` : ''}
      </div>
      <div class="rfq-footer">
        <div class="quotations-count"><i class="fas fa-file-invoice"></i> ${rfq.quotation_count || 0} Quotations</div>
      </div>
    </a>
  `;
}

/**
 * Render quotation card for detail view
 */
function renderQuotationCard(quotation, rfqQuantity, isBestValue = false) {
  const total = calcQuotationTotal(quotation.unit_price, rfqQuantity);
  return `
    <div class="quote-card ${isBestValue ? 'best-value' : ''}">
      ${isBestValue ? '<div class="best-value-badge">⭐ Best Value</div>' : ''}
      <div class="quote-header">
        <div class="supplier-info">
          <div class="supplier-avatar">${quotation.supplier_name?.substring(0, 2).toUpperCase() || 'SP'}</div>
          <div>
            <div class="supplier-name">${quotation.supplier_name || 'Supplier'}</div>
            <div class="supplier-rating">★ ${quotation.supplier_rating || 4.5} · ${quotation.supplier_orders || 0} orders</div>
          </div>
        </div>
      </div>
      <div class="quote-meta">
        <div class="quote-meta-item">
          <div class="quote-meta-label">Unit Price</div>
          <div class="quote-meta-value ${isBestValue ? 'compare-best' : ''}">$${parseFloat(quotation.unit_price).toFixed(2)}</div>
        </div>
        <div class="quote-meta-item">
          <div class="quote-meta-label">Total (${rfqQuantity?.toLocaleString()} pcs)</div>
          <div class="quote-meta-value">$${parseFloat(total).toLocaleString()}</div>
        </div>
        <div class="quote-meta-item">
          <div class="quote-meta-label">MOQ</div>
          <div class="quote-meta-value">${quotation.moq?.toLocaleString()} pcs</div>
        </div>
        <div class="quote-meta-item">
          <div class="quote-meta-label">Lead Time</div>
          <div class="quote-meta-value">${quotation.lead_time} days</div>
        </div>
      </div>
      ${quotation.notes ? `<div class="quote-note">${quotation.notes}</div>` : ''}
      <div class="quote-actions">
        <button class="btn btn-secondary btn-sm" onclick="openNegotiation('${quotation.id}')">
          <i class="fas fa-comments"></i> Negotiate
        </button>
        <button class="btn btn-primary btn-sm" onclick="selectQuotation('${quotation.id}', ${total})">
          <i class="fas fa-check-circle"></i> Select
        </button>
      </div>
    </div>
  `;
}

/**
 * Compare quotations and find best value
 */
function findBestValueQuotation(quotations) {
  if (!quotations || quotations.length === 0) return null;
  // Score based on: lowest price (40%), fastest delivery (30%), highest rating (30%)
  const scored = quotations.map(q => ({
    ...q,
    score: (1 / q.unit_price) * 0.4 + (1 / q.lead_time) * 0.3 + (q.supplier_rating / 5) * 0.3
  }));
  return scored.sort((a, b) => b.score - a.score)[0];
}

/**
 * Save RFQ draft to localStorage
 */
function saveRFQDraft(data) {
  localStorage.setItem('rfq_draft', JSON.stringify({ ...data, saved_at: new Date().toISOString() }));
}

/**
 * Load RFQ draft from localStorage
 */
function loadRFQDraft() {
  try {
    const draft = localStorage.getItem('rfq_draft');
    return draft ? JSON.parse(draft) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Clear saved RFQ draft
 */
function clearRFQDraft() {
  localStorage.removeItem('rfq_draft');
}

// Export for use in pages
window.RFQAPI = RFQAPI;
window.formatRFQStatus = formatRFQStatus;
window.formatQuotationStatus = formatQuotationStatus;
window.calcQuotationTotal = calcQuotationTotal;
window.renderRFQCard = renderRFQCard;
window.renderQuotationCard = renderQuotationCard;
window.findBestValueQuotation = findBestValueQuotation;
window.saveRFQDraft = saveRFQDraft;
window.loadRFQDraft = loadRFQDraft;
window.clearRFQDraft = clearRFQDraft;
