/**
 * inspection.js - Quality Inspection Frontend Logic
 * Globex Sky Platform
 */

const InspectionAPI = {
  BASE_URL: '/api/v1/inspections',

  getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${this.BASE_URL}?${query}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`Failed to load inspections: ${res.status}`);
    return res.json();
  },

  async get(id) {
    const res = await fetch(`${this.BASE_URL}/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`Inspection not found: ${res.status}`);
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
      throw new Error(err.error || 'Failed to create inspection');
    }
    return res.json();
  },

  async getReport(id) {
    const res = await fetch(`${this.BASE_URL}/${id}/report`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`Report not found: ${res.status}`);
    return res.json();
  },

  async schedule(id, date) {
    const res = await fetch(`${this.BASE_URL}/${id}/schedule`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ scheduled_date: date })
    });
    if (!res.ok) throw new Error('Failed to schedule inspection');
    return res.json();
  }
};

// Inspection type pricing configuration
const INSPECTION_PRICING = {
  pre_production: { price: 199, label: 'Pre-Production Inspection', duration: '1 day', report_time: '24 hours' },
  during_production: { price: 249, label: 'During Production', duration: '1-2 days', report_time: '24 hours' },
  pre_shipment: { price: 179, label: 'Pre-Shipment Inspection', duration: '1 day', report_time: '12 hours' },
  full_audit: { price: 499, label: 'Full Factory Audit', duration: '2-3 days', report_time: '48 hours' }
};

/**
 * Format inspection status for display
 */
function formatInspectionStatus(status) {
  const statuses = {
    pending: { label: 'Pending', class: 'badge-warning', icon: 'fa-clock' },
    payment_pending: { label: 'Payment Pending', class: 'badge-danger', icon: 'fa-credit-card' },
    scheduled: { label: 'Scheduled', class: 'badge-info', icon: 'fa-calendar' },
    in_progress: { label: 'In Progress', class: 'badge-info', icon: 'fa-search' },
    completed: { label: 'Completed', class: 'badge-success', icon: 'fa-check-circle' },
    cancelled: { label: 'Cancelled', class: 'badge-secondary', icon: 'fa-times-circle' }
  };
  return statuses[status] || { label: status, class: 'badge-secondary', icon: 'fa-question' };
}

/**
 * Format inspection result for display
 */
function formatInspectionResult(result) {
  const results = {
    pass: { label: 'PASSED', class: 'badge-success', icon: 'fa-check-circle' },
    fail: { label: 'FAILED', class: 'badge-danger', icon: 'fa-times-circle' },
    conditional_pass: { label: 'CONDITIONAL PASS', class: 'badge-warning', icon: 'fa-exclamation-circle' }
  };
  return results[result] || { label: result, class: 'badge-secondary', icon: 'fa-question' };
}

/**
 * Calculate inspection cost
 */
function getInspectionCost(type) {
  return INSPECTION_PRICING[type]?.price || 0;
}

/**
 * Render inspection card HTML
 */
function renderInspectionCard(inspection) {
  const statusInfo = formatInspectionStatus(inspection.status);
  const typeInfo = INSPECTION_PRICING[inspection.type] || { label: inspection.type };
  return `
    <div class="inspection-card" onclick="window.location.href='tracking.html?id=${inspection.id}'">
      <div class="inspection-header">
        <div class="inspection-product">${inspection.product_name}</div>
        <span class="badge ${statusInfo.class}">
          <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
        </span>
      </div>
      <div class="inspection-meta">
        <span><i class="fas fa-tag"></i> ${typeInfo.label}</span>
        <span><i class="fas fa-factory"></i> ${inspection.supplier_name}</span>
        <span><i class="fas fa-calendar"></i> ${inspection.scheduled_date || 'TBD'}</span>
        <span><i class="fas fa-dollar-sign"></i> $${inspection.amount}</span>
      </div>
    </div>
  `;
}

/**
 * Upload inspection files
 */
async function uploadInspectionFiles(files, inspectionId) {
  const formData = new FormData();
  Array.from(files).forEach(f => formData.append('files', f));
  const res = await fetch(`/api/v1/inspections/${inspectionId}/attachments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
    body: formData
  });
  return res.json();
}

/**
 * Poll for inspection updates (for tracking page)
 */
function startInspectionPolling(inspectionId, onUpdate, intervalMs = 30000) {
  const poll = async () => {
    try {
      const { data } = await InspectionAPI.get(inspectionId);
      if (data) onUpdate(data);
    } catch (e) {
      console.warn('Polling error:', e);
    }
  };
  poll();
  return setInterval(poll, intervalMs);
}

/**
 * Generate inspection request payload from form
 */
function buildInspectionPayload(form) {
  const fd = new FormData(form);
  return {
    type: fd.get('type') || document.getElementById('inspectionType')?.value,
    supplier_name: fd.get('supplier_name'),
    factory_address: fd.get('factory_address'),
    contact_person: fd.get('contact_person'),
    contact_phone: fd.get('contact_phone'),
    contact_email: fd.get('contact_email'),
    product_name: fd.get('product_name'),
    category: fd.get('category'),
    quantity: parseInt(fd.get('quantity')) || null,
    product_details: fd.get('product_details'),
    specifications: fd.get('specifications'),
    preferred_date: fd.get('preferred_date'),
    notes: fd.get('notes'),
    amount: getInspectionCost(fd.get('type') || document.getElementById('inspectionType')?.value)
  };
}

// Export for use in pages
window.InspectionAPI = InspectionAPI;
window.INSPECTION_PRICING = INSPECTION_PRICING;
window.formatInspectionStatus = formatInspectionStatus;
window.formatInspectionResult = formatInspectionResult;
window.getInspectionCost = getInspectionCost;
window.renderInspectionCard = renderInspectionCard;
window.startInspectionPolling = startInspectionPolling;
window.buildInspectionPayload = buildInspectionPayload;
