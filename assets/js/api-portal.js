/**
 * Globex Sky - api-portal.js
 * API developer portal: usage dashboard, key management,
 * webhook endpoints, documentation code-copy buttons.
 */

const ApiPortalAPI = {
  BASE: '/api/v1/developer',
  headers(json = true) {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },
  async get(path) {
    const res = await fetch(this.BASE + path, { headers: this.headers(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async post(path, body = {}) {
    const res = await fetch(this.BASE + path, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async del(path) {
    const res = await fetch(this.BASE + path, { method: 'DELETE', headers: this.headers(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   API USAGE DASHBOARD
───────────────────────────────────────────── */
async function initApiDashboard() {
  const section = document.querySelector('.api-dashboard, [data-api-dashboard]');
  if (!section) return;

  try {
    const data = await ApiPortalAPI.get('/dashboard');
    const d    = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-stat="requests-today"]', d.requestsToday   ? d.requestsToday.toLocaleString() : '—');
    set('[data-stat="requests-month"]', d.requestsMonth   ? d.requestsMonth.toLocaleString() : '—');
    set('[data-stat="success-rate"]',   d.successRate     ? d.successRate.toFixed(1) + '%' : '—');
    set('[data-stat="avg-latency"]',    d.avgLatency      ? d.avgLatency + 'ms' : '—');
    set('[data-stat="rate-limit"]',     d.rateLimit       ? d.rateLimit.toLocaleString() + '/hr' : '—');
    set('[data-stat="quota-used"]',     d.quotaUsedPercent ? d.quotaUsedPercent.toFixed(1) + '%' : '—');

    // Quota progress bar
    const bar = section.querySelector('.quota-bar, [data-quota-bar]');
    if (bar && d.quotaUsedPercent !== undefined) {
      bar.style.width = Math.min(100, d.quotaUsedPercent) + '%';
      bar.className = `progress-bar ${d.quotaUsedPercent >= 90 ? 'bg-danger' : d.quotaUsedPercent >= 70 ? 'bg-warning' : 'bg-success'}`;
    }

    // Usage chart
    const canvas = section.querySelector('#apiUsageChart, [data-api-usage-chart]');
    if (canvas && typeof Chart !== 'undefined' && d.chartData) {
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: d.chartData.labels || [],
          datasets: [{
            label: 'API Requests',
            data: d.chartData.requests || [],
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13,110,253,.1)',
            tension: 0.4,
            fill: true,
          }],
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } },
      });
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   API KEY MANAGEMENT
───────────────────────────────────────────── */
async function initApiKeys() {
  const container = document.querySelector('.api-keys-list, [data-api-keys]');
  const genBtn    = document.querySelector('[data-generate-key], #generateKeyBtn');
  if (!container) return;

  const load = async () => {
    try {
      const data = await ApiPortalAPI.get('/keys');
      const keys = data.data || data || [];

      container.innerHTML = keys.length
        ? keys.map((k) => `
          <div class="card mb-3 api-key-card">
            <div class="card-body">
              <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <h6 class="mb-0">${k.name || 'API Key'}</h6>
                  <small class="text-muted">${k.type || 'live'} · Created ${new Date(k.created_at).toLocaleDateString()}</small>
                </div>
                <div class="d-flex gap-2">
                  <span class="badge bg-${k.active ? 'success' : 'secondary'}">${k.active ? 'Active' : 'Revoked'}</span>
                </div>
              </div>
              <div class="d-flex align-items-center gap-2 mb-2">
                <code class="flex-grow-1 text-truncate bg-light px-2 py-1 rounded" id="key-${k.id}">
                  ${k.key_preview || k.key || '••••••••••••••••••••••••••••••••'}
                </code>
                <button class="btn btn-sm btn-outline-secondary" data-copy-key="${k.key_preview || k.key}" title="Copy">
                  <i class="fas fa-copy"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" data-toggle-key="${k.id}" data-key-visible="false" title="Toggle visibility">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
              <div class="d-flex gap-2">
                <small class="text-muted"><i class="fas fa-circle-check me-1"></i>Permissions: ${(k.permissions || ['read']).join(', ')}</small>
              </div>
              ${k.active ? `<button class="btn btn-sm btn-outline-danger mt-2" data-revoke-key="${k.id}">Revoke Key</button>` : ''}
            </div>
          </div>`).join('')
        : '<p class="text-muted">No API keys yet. Generate your first key.</p>';

      container.querySelectorAll('[data-copy-key]').forEach((btn) => {
        btn.addEventListener('click', () => {
          navigator.clipboard?.writeText(btn.dataset.copyKey).then(() => {
            if (typeof showToast === 'function') showToast('API key copied to clipboard!', 'success');
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
          });
        });
      });

      container.querySelectorAll('[data-revoke-key]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Revoke this API key? This action cannot be undone.')) return;
          try {
            await ApiPortalAPI.del(`/keys/${btn.dataset.revokeKey}`);
            if (typeof showToast === 'function') showToast('API key revoked.', 'success');
            load();
          } catch (_) { if (typeof showToast === 'function') showToast('Failed to revoke key.', 'error'); }
        });
      });
    } catch (_) {
      container.innerHTML = '<p class="text-danger">Failed to load API keys.</p>';
    }
  };

  if (genBtn) {
    genBtn.addEventListener('click', async () => {
      const name = prompt('Enter a name for this API key (e.g. "Production Server"):');
      if (!name) return;
      genBtn.disabled = true;
      try {
        const data = await ApiPortalAPI.post('/keys', { name, type: 'live', permissions: ['read', 'write'] });
        const key  = data.data?.key || data.key;
        if (key) {
          alert(`Your new API key (save it now — it won't be shown again):\n\n${key}`);
          navigator.clipboard?.writeText(key);
        }
        if (typeof showToast === 'function') showToast('API key generated!', 'success');
        load();
      } catch (_) {
        if (typeof showToast === 'function') showToast('Failed to generate key.', 'error');
      } finally {
        genBtn.disabled = false;
      }
    });
  }

  await load();
}

/* ─────────────────────────────────────────────
   WEBHOOK MANAGEMENT
───────────────────────────────────────────── */
async function initWebhooks() {
  const container   = document.querySelector('.webhooks-list, [data-webhooks-list]');
  const addForm     = document.querySelector('#addWebhookForm, [data-add-webhook]');
  if (!container) return;

  const load = async () => {
    try {
      const data     = await ApiPortalAPI.get('/webhooks');
      const webhooks = data.data || data || [];

      container.innerHTML = webhooks.length
        ? webhooks.map((w) => `
          <div class="card mb-3">
            <div class="card-body">
              <div class="d-flex flex-wrap justify-content-between gap-2">
                <div>
                  <code class="small">${w.url}</code>
                  <div class="mt-1">
                    ${(w.events || []).map((e) => `<span class="badge bg-light text-dark me-1 small">${e}</span>`).join('')}
                  </div>
                </div>
                <div class="d-flex gap-2 align-items-start">
                  <span class="badge bg-${w.active ? 'success' : 'secondary'}">${w.active ? 'Active' : 'Disabled'}</span>
                  <button class="btn btn-sm btn-outline-info" data-test-webhook="${w.id}">Test</button>
                  <button class="btn btn-sm btn-outline-danger" data-delete-webhook="${w.id}">Delete</button>
                </div>
              </div>
              ${w.last_delivery ? `<small class="text-muted mt-2 d-block">Last delivery: ${new Date(w.last_delivery).toLocaleString()} — <span class="${w.last_delivery_ok ? 'text-success' : 'text-danger'}">${w.last_delivery_ok ? '✓ 200 OK' : '✗ Failed'}</span></small>` : ''}
            </div>
          </div>`).join('')
        : '<p class="text-muted">No webhooks configured. Add one below.</p>';

      container.querySelectorAll('[data-test-webhook]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true; btn.textContent = 'Testing…';
          try {
            await ApiPortalAPI.post(`/webhooks/${btn.dataset.testWebhook}/test`);
            if (typeof showToast === 'function') showToast('Test payload sent!', 'success');
          } catch (_) { if (typeof showToast === 'function') showToast('Test failed.', 'error'); }
          finally { btn.disabled = false; btn.textContent = 'Test'; }
        });
      });

      container.querySelectorAll('[data-delete-webhook]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this webhook?')) return;
          try {
            await ApiPortalAPI.del(`/webhooks/${btn.dataset.deleteWebhook}`);
            if (typeof showToast === 'function') showToast('Webhook deleted.', 'success');
            load();
          } catch (_) { if (typeof showToast === 'function') showToast('Failed to delete.', 'error'); }
        });
      });
    } catch (_) {
      container.innerHTML = '<p class="text-danger">Failed to load webhooks.</p>';
    }
  };

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url    = addForm.querySelector('[name="url"]')?.value.trim();
      const events = Array.from(addForm.querySelectorAll('input[name="events"]:checked')).map((cb) => cb.value);
      if (!url) { if (typeof showToast === 'function') showToast('Please enter a webhook URL.', 'error'); return; }
      if (!events.length) { if (typeof showToast === 'function') showToast('Please select at least one event.', 'error'); return; }

      try {
        await ApiPortalAPI.post('/webhooks', { url, events });
        if (typeof showToast === 'function') showToast('Webhook added!', 'success');
        addForm.reset();
        load();
      } catch (_) { if (typeof showToast === 'function') showToast('Failed to add webhook.', 'error'); }
    });
  }

  await load();
}

/* ─────────────────────────────────────────────
   DOCUMENTATION CODE SNIPPETS
───────────────────────────────────────────── */
function initDocCodeSnippets() {
  // Copy button for code blocks
  document.querySelectorAll('pre code, [data-code-snippet]').forEach((codeEl) => {
    const pre = codeEl.closest('pre') || codeEl;
    if (pre.querySelector('.copy-btn')) return; // already added

    const btn = document.createElement('button');
    btn.className = 'copy-btn btn btn-sm btn-outline-secondary';
    btn.style.cssText = 'position:absolute;top:8px;right:8px;font-size:.7rem';
    btn.innerHTML = '<i class="fas fa-copy me-1"></i>Copy';
    btn.addEventListener('click', () => {
      const text = codeEl.textContent;
      navigator.clipboard?.writeText(text).then(() => {
        btn.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
        btn.classList.replace('btn-outline-secondary', 'btn-success');
        setTimeout(() => {
          btn.innerHTML = '<i class="fas fa-copy me-1"></i>Copy';
          btn.classList.replace('btn-success', 'btn-outline-secondary');
        }, 2000);
      });
    });

    if (pre.tagName === 'PRE') {
      pre.style.position = 'relative';
      pre.appendChild(btn);
    }
  });

  // Language tabs for code examples
  document.querySelectorAll('.code-tabs, [data-code-tabs]').forEach((tabsEl) => {
    const tabs    = tabsEl.querySelectorAll('[data-lang]');
    const panes   = tabsEl.querySelectorAll('[data-lang-pane]');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const lang = tab.dataset.lang;
        tabs.forEach((t) => t.classList.toggle('active', t.dataset.lang === lang));
        panes.forEach((p) => p.classList.toggle('d-none', p.dataset.langPane !== lang));
      });
    });

    // Show first tab by default
    if (tabs.length) tabs[0].click();
  });

  // Endpoint search
  const endpointSearch = document.querySelector('[data-endpoint-search], #endpointSearch');
  if (endpointSearch) {
    endpointSearch.addEventListener('input', () => {
      const q = endpointSearch.value.trim().toLowerCase();
      document.querySelectorAll('.endpoint-item, [data-endpoint]').forEach((el) => {
        const text = el.textContent.toLowerCase();
        el.style.display = !q || text.includes(q) ? '' : 'none';
      });
    });
  }
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initApiDashboard();
  initApiKeys();
  initWebhooks();
  initDocCodeSnippets();
});
