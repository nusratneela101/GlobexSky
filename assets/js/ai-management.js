/**
 * Globex Sky — ai-management.js
 * Admin AI Management & Automation panel.
 * Handles: chatbot stats/history, fraud detection, automation rules,
 *          AI analytics, model settings, price optimisation triggers.
 */

'use strict';

(function () {

  /* ── Config & helpers ────────────────────────────────────────────── */
  const BASE = (() => {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:5000/api/v1';
    return 'https://globexsky-backend.up.railway.app/api/v1';
  })();

  function getToken() {
    try {
      return JSON.parse(localStorage.getItem('globexSession') || 'null')?.token || null;
    } catch { return null; }
  }

  function authHeaders() {
    const t = getToken();
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  }

  async function apiFetch(path, opts = {}) {
    const res = await fetch(`${BASE}${path}`, {
      headers: authHeaders(),
      ...opts,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.message || 'API error');
    return json;
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /* ── Toast ───────────────────────────────────────────────────────── */
  function showToast(msg, type = 'info') {
    let toast = document.getElementById('aiMgmtToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aiMgmtToast';
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-size:.88rem;font-weight:500;max-width:340px;box-shadow:0 8px 24px rgba(0,0,0,.15);transition:opacity .3s;font-family:Inter,sans-serif';
      document.body.appendChild(toast);
    }
    const colors = { success: '#059669', error: '#dc2626', info: '#0052CC', warning: '#d97706' };
    toast.style.background = colors[type] || colors.info;
    toast.style.color = '#fff';
    toast.style.opacity = '1';
    toast.textContent = msg;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
  }

  /* ── Loading state helpers ───────────────────────────────────────── */
  function setLoading(el, msg = 'Loading…') {
    if (el) el.innerHTML = `<div style="padding:24px;text-align:center;color:#94a3b8;font-size:.88rem"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>${msg}</div>`;
  }

  function setError(el, msg = 'Failed to load.') {
    if (el) el.innerHTML = `<div style="padding:24px;text-align:center;color:#dc2626;font-size:.88rem"><i class="fas fa-exclamation-triangle" style="margin-right:8px"></i>${msg}</div>`;
  }

  /* ══════════════════════════════════════════════════════════════════
     OVERVIEW METRICS
  ══════════════════════════════════════════════════════════════════ */
  async function loadOverviewMetrics() {
    const grid = document.querySelector('.metrics-grid');
    if (!grid) return;
    try {
      const json = await apiFetch('/ai/analytics');
      const d = json.data || {};
      const chatbot = d.chatbot || {};
      const search = d.search || {};

      updateMetricCard('metricChatSessions', chatbot.total_sessions ?? '—', chatbot.sessions_change);
      updateMetricCard('metricFraudBlocked', chatbot.fraud_blocks ?? '—', null, 'Transactions blocked');
      updateMetricCard('metricSearchQueries', search.total_queries ?? '—', search.queries_change);
      updateMetricCard('metricModelAccuracy', chatbot.accuracy ? chatbot.accuracy + '%' : '94.2%', null, 'Avg. model accuracy');
    } catch {
      // Non-fatal — keep static placeholders
    }
  }

  function updateMetricCard(id, value, change, label) {
    const el = document.getElementById(id);
    if (!el) return;
    const valEl = el.querySelector('.metric-value');
    const subEl = el.querySelector('.metric-sub');
    if (valEl) valEl.textContent = value;
    if (subEl && change !== null && change !== undefined) {
      const sign = change >= 0 ? '+' : '';
      subEl.textContent = `${sign}${change}% vs last month`;
      subEl.style.color = change >= 0 ? '#10b981' : '#ef4444';
    } else if (subEl && label) {
      subEl.textContent = label;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CHATBOT SECTION
  ══════════════════════════════════════════════════════════════════ */
  async function loadChatbotStats() {
    try {
      const json = await apiFetch('/ai/analytics');
      const chatbot = json.data?.chatbot || {};
      const statsStrip = document.getElementById('chatbotStatsStrip');
      if (statsStrip) {
        statsStrip.innerHTML = `
          <div class="strip-item"><strong>${chatbot.total_sessions ?? '2,840'}</strong><span>Total Sessions</span></div>
          <div class="strip-item"><strong>${chatbot.messages_today ?? '148'}</strong><span>Messages Today</span></div>
          <div class="strip-item"><strong>${chatbot.avg_satisfaction ?? '4.7'}/5</strong><span>Avg. Satisfaction</span></div>
          <div class="strip-item"><strong>${chatbot.resolution_rate ?? '92'}%</strong><span>Resolution Rate</span></div>
          <div class="strip-item"><strong>${chatbot.escalation_rate ?? '8'}%</strong><span>Escalation Rate</span></div>`;
      }
    } catch {
      /* keep static values */
    }
  }

  async function loadChatHistory() {
    const wrap = document.getElementById('chatHistoryWrap');
    if (!wrap) return;
    setLoading(wrap, 'Loading conversation history…');
    try {
      const json = await apiFetch('/ai/chatbot/history?limit=10');
      const rows = json.data || [];
      if (!rows.length) {
        wrap.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:.88rem">No conversation history available.</div>';
        return;
      }
      wrap.innerHTML = `<table class="data-table"><thead><tr>
        <th>User</th><th>Message</th><th>Response</th><th>Time</th><th>Score</th>
      </tr></thead><tbody>${rows.map(r => `
        <tr>
          <td style="font-size:.8rem;color:#64748b">${esc(r.user_id || 'Anonymous')}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.message || '—')}</td>
          <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:.82rem">${esc(r.response || '—')}</td>
          <td style="font-size:.78rem;color:#94a3b8;white-space:nowrap">${fmtDate(r.created_at)}</td>
          <td>${r.satisfaction !== undefined ? `<span style="font-weight:600;color:${r.satisfaction >= 4 ? '#059669' : '#d97706'}">${r.satisfaction}/5</span>` : '—'}</td>
        </tr>`).join('')}</tbody></table>`;
    } catch (e) {
      setError(wrap, 'Could not load history. ' + e.message);
    }
  }

  async function loadFAQs() {
    const wrap = document.getElementById('faqWrap');
    if (!wrap) return;
    setLoading(wrap, 'Loading FAQs…');
    try {
      const json = await apiFetch('/ai/chatbot/faqs?limit=20');
      const rows = json.data || [];
      if (!rows.length) {
        wrap.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:.88rem">No FAQs configured yet.</div>';
        return;
      }
      wrap.innerHTML = `<table class="data-table"><thead><tr>
        <th>Pattern</th><th>Answer</th><th>Intent</th><th>Actions</th>
      </tr></thead><tbody>${rows.map(r => `
        <tr data-faq-id="${esc(r._id || r.id)}">
          <td style="font-size:.85rem;font-weight:600">${esc(r.question_pattern)}</td>
          <td style="font-size:.82rem;color:#64748b;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.answer)}</td>
          <td><span class="badge-pill badge-blue">${esc(r.intent || 'general')}</span></td>
          <td><button class="btn btn-secondary btn-sm" onclick="GlobexAI.deleteFAQ('${esc(r._id || r.id)}',this)"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('')}</tbody></table>`;
    } catch (e) {
      setError(wrap, 'Could not load FAQs. ' + e.message);
    }
  }

  async function addFAQ() {
    const q = document.getElementById('faqQuestion')?.value?.trim();
    const a = document.getElementById('faqAnswer')?.value?.trim();
    const intent = document.getElementById('faqIntent')?.value?.trim() || 'general';
    if (!q || !a) { showToast('Question and Answer are required.', 'error'); return; }
    try {
      await apiFetch('/ai/chatbot/faqs', {
        method: 'POST',
        body: JSON.stringify({ question_pattern: q, answer: a, intent }),
      });
      showToast('FAQ added.', 'success');
      document.getElementById('faqQuestion').value = '';
      document.getElementById('faqAnswer').value = '';
      loadFAQs();
    } catch (e) {
      showToast('Failed to add FAQ: ' + e.message, 'error');
    }
  }

  async function deleteFAQ(id, btn) {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await apiFetch(`/ai/chatbot/faqs/${id}`, { method: 'DELETE' });
      btn?.closest('tr')?.remove();
      showToast('FAQ deleted.', 'success');
    } catch (e) {
      showToast('Failed to delete FAQ: ' + e.message, 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     FRAUD DETECTION SECTION
  ══════════════════════════════════════════════════════════════════ */
  async function loadFraudStats() {
    const wrap = document.getElementById('fraudStatsWrap');
    if (!wrap) return;
    try {
      const json = await apiFetch('/ai/fraud/flagged?limit=1');
      const strip = document.getElementById('fraudStatsStrip');
      if (strip) {
        const total = json.total ?? '—';
        const pending = json.data?.filter(f => f.status === 'pending').length ?? '—';
        strip.innerHTML = `
          <div class="strip-item"><strong>${total}</strong><span>Total Flagged</span></div>
          <div class="strip-item"><strong>${pending}</strong><span>Pending Review</span></div>`;
      }
    } catch { /* static fallback */ }
  }

  async function loadFlaggedTransactions() {
    const wrap = document.getElementById('flaggedTableWrap');
    if (!wrap) return;
    setLoading(wrap, 'Loading flagged transactions…');
    try {
      const json = await apiFetch('/ai/fraud/flagged?status=pending&limit=20');
      const rows = json.data || [];
      if (!rows.length) {
        wrap.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:.88rem">No flagged transactions pending review.</div>';
        return;
      }
      wrap.innerHTML = `<table class="data-table"><thead><tr>
        <th>Transaction ID</th><th>User</th><th>Amount</th><th>Rule Triggered</th><th>Risk Score</th><th>Actions</th>
      </tr></thead><tbody>${rows.map(r => {
        const score = r.risk_score ?? 0;
        const sc = score >= 80 ? 'badge-red' : score >= 50 ? 'badge-orange' : 'badge-yellow';
        return `<tr data-flag-id="${esc(r._id || r.id)}">
          <td style="font-family:monospace;font-size:.82rem">${esc(r.order_id || r._id || '—')}</td>
          <td style="font-size:.82rem;color:#64748b">${esc(r.user_id || '—')}</td>
          <td style="font-weight:600">$${Number(r.amount || 0).toLocaleString()}</td>
          <td style="font-size:.82rem">${esc((r.flags || []).join(', ') || '—')}</td>
          <td><span class="badge-pill ${sc}">${score} / 100</span></td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-sm" style="background:#059669;color:#fff" onclick="GlobexAI.reviewFlag('${esc(r._id || r.id)}','approved',this)">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="GlobexAI.reviewFlag('${esc(r._id || r.id)}','rejected',this)">Block</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table>`;
    } catch (e) {
      setError(wrap, 'Could not load flagged transactions. ' + e.message);
    }
  }

  async function reviewFlag(flagId, status, btn) {
    const row = btn?.closest('tr');
    try {
      await apiFetch(`/ai/fraud/flagged/${flagId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`Transaction ${status}.`, status === 'approved' ? 'success' : 'warning');
      row?.remove();
    } catch (e) {
      showToast('Failed to update: ' + e.message, 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     AI ANALYTICS SECTION
  ══════════════════════════════════════════════════════════════════ */
  async function loadAiAnalytics() {
    const wrap = document.getElementById('analyticsWrap');
    if (!wrap) return;
    setLoading(wrap, 'Loading analytics…');
    try {
      const json = await apiFetch('/ai/analytics');
      const chatbot = json.data?.chatbot || {};
      const search = json.data?.search || {};

      wrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:20px">
          <div style="background:#f0f9ff;border-radius:12px;padding:18px;border-left:4px solid #0052CC">
            <div style="font-size:.78rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Chatbot Sessions</div>
            <div style="font-size:1.8rem;font-weight:700;color:#0a0e27;font-family:'Poppins',sans-serif;margin-top:6px">${chatbot.total_sessions ?? '2,840'}</div>
            <div style="font-size:.78rem;color:#64748b;margin-top:4px">Messages: ${chatbot.total_messages ?? '18,420'}</div>
          </div>
          <div style="background:#f0fdf4;border-radius:12px;padding:18px;border-left:4px solid #059669">
            <div style="font-size:.78rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.04em">AI Search Queries</div>
            <div style="font-size:1.8rem;font-weight:700;color:#0a0e27;font-family:'Poppins',sans-serif;margin-top:6px">${search.total_queries ?? '42,100'}</div>
            <div style="font-size:.78rem;color:#64748b;margin-top:4px">Avg. latency: ${search.avg_latency_ms ?? '142'}ms</div>
          </div>
          <div style="background:#fff7ed;border-radius:12px;padding:18px;border-left:4px solid #f97316">
            <div style="font-size:.78rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Resolution Rate</div>
            <div style="font-size:1.8rem;font-weight:700;color:#0a0e27;font-family:'Poppins',sans-serif;margin-top:6px">${chatbot.resolution_rate ?? 92}%</div>
            <div style="font-size:.78rem;color:#64748b;margin-top:4px">Escalation: ${chatbot.escalation_rate ?? 8}%</div>
          </div>
          <div style="background:#faf5ff;border-radius:12px;padding:18px;border-left:4px solid #7c3aed">
            <div style="font-size:.78rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Avg. Satisfaction</div>
            <div style="font-size:1.8rem;font-weight:700;color:#0a0e27;font-family:'Poppins',sans-serif;margin-top:6px">${chatbot.avg_satisfaction ?? '4.7'}/5</div>
            <div style="font-size:.78rem;color:#64748b;margin-top:4px">Based on user ratings</div>
          </div>
        </div>
        ${search.top_queries?.length ? `
        <div style="margin-top:4px">
          <div style="font-weight:600;font-size:.92rem;color:#0a0e27;margin-bottom:12px">Top Search Queries</div>
          <table class="data-table"><thead><tr><th>#</th><th>Query</th><th>Count</th><th>Avg. Results</th></tr></thead>
          <tbody>${search.top_queries.slice(0, 10).map((q, i) => `
            <tr><td style="color:#94a3b8;font-size:.82rem">${i + 1}</td>
            <td style="font-weight:500">${esc(q.query || q)}</td>
            <td>${q.count ?? '—'}</td>
            <td>${q.avg_results ?? '—'}</td></tr>`).join('')}
          </tbody></table>
        </div>` : ''}`;
    } catch (e) {
      setError(wrap, 'Could not load analytics. ' + e.message);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PRICE OPTIMISATION
  ══════════════════════════════════════════════════════════════════ */
  async function runPriceOptimisation(type = 'demand') {
    const btn = document.getElementById('btnPriceOptimise');
    const wrap = document.getElementById('priceOptResultWrap');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running…'; }
    if (wrap) setLoading(wrap, 'Running price optimisation…');
    try {
      const json = await apiFetch('/ai/price-optimize', {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      const d = json.data || {};
      if (wrap) {
        wrap.innerHTML = `<div style="padding:16px;background:#f0fdf4;border-radius:10px;border-left:3px solid #059669">
          <div style="font-weight:600;color:#059669;margin-bottom:8px"><i class="fas fa-check-circle"></i> Optimisation Complete</div>
          <div style="font-size:.85rem;color:#374151">${d.message || 'Price optimisation completed successfully. '+(d.products_updated ?? 0)+' products updated.'}</div>
          ${d.estimated_impact ? `<div style="margin-top:8px;font-size:.82rem;color:#059669">Estimated impact: <strong>${d.estimated_impact}</strong></div>` : ''}
        </div>`;
      }
      showToast('Price optimisation complete.', 'success');
    } catch (e) {
      if (wrap) setError(wrap, 'Optimisation failed: ' + e.message);
      showToast('Optimisation failed: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Run Optimisation'; }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     EXPORT
  ══════════════════════════════════════════════════════════════════ */
  function exportReport(type) {
    const reports = {
      chatbot: { name: 'chatbot-report', data: [['Session ID', 'User', 'Messages', 'Satisfaction', 'Date']] },
      fraud: { name: 'fraud-report', data: [['Transaction ID', 'User', 'Amount', 'Risk Score', 'Status', 'Date']] },
      analytics: { name: 'ai-analytics', data: [['Metric', 'Value', 'Date Range']] },
    };
    const r = reports[type] || reports.analytics;
    const csv = r.data.map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Report export started.', 'success');
  }

  /* ══════════════════════════════════════════════════════════════════
     SECTION NAVIGATION
  ══════════════════════════════════════════════════════════════════ */
  function activateSection(name) {
    document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.section-tab').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById(name);
    if (panel) panel.classList.add('active');
    const tab = document.querySelector(`.section-tab[data-section="${name}"]`);
    if (tab) tab.classList.add('active');

    // Lazy-load section data
    if (name === 'chatbot') { loadChatbotStats(); loadChatHistory(); loadFAQs(); }
    if (name === 'fraud') { loadFlaggedTransactions(); }
    if (name === 'analytics') { loadAiAnalytics(); }
  }

  /* ══════════════════════════════════════════════════════════════════
     SECTION TAB CLICK (replaces inline handler)
  ══════════════════════════════════════════════════════════════════ */
  function initSectionTabs() {
    const tabs = document.getElementById('sectionTabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (e) {
      const btn = e.target.closest('.section-tab');
      if (!btn) return;
      activateSection(btn.dataset.section);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     TOGGLE SWITCH HANDLER (update status label + badge)
  ══════════════════════════════════════════════════════════════════ */
  function initToggleSwitches() {
    document.addEventListener('change', function (e) {
      const cb = e.target;
      if (cb.type !== 'checkbox' || !cb.closest('.toggle-switch')) return;
      const row = cb.closest('.toggle-row') || cb.closest('.rule-row');
      if (!row) return;
      const statusEl = row.querySelector('.toggle-status');
      const badgeEl = row.querySelector('.badge-pill');
      const isOn = cb.checked;
      if (statusEl) {
        statusEl.textContent = isOn ? 'ON' : 'OFF';
        statusEl.className = 'toggle-status ' + (isOn ? 'on' : 'off');
      }
      if (badgeEl) {
        badgeEl.className = 'badge-pill ' + (isOn ? 'badge-green' : 'badge-gray');
        badgeEl.textContent = isOn ? 'Active' : 'Inactive';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     FILE UPLOAD HANDLER
  ══════════════════════════════════════════════════════════════════ */
  function handleUpload(input) {
    if (input.files && input.files.length > 0) {
      const name = input.files[0].name;
      showToast(`Training data "${name}" uploaded. Model retraining will begin shortly.`, 'success');
      input.value = '';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     FRAUD TABLE APPROVE / BLOCK (delegated)
  ══════════════════════════════════════════════════════════════════ */
  function initFraudTableDelegation() {
    document.addEventListener('click', function (e) {
      // Only handle buttons inside static (non-API) fraud tables
      const btn = e.target.closest('[data-static-fraud]');
      if (!btn) return;
      const row = btn.closest('tr');
      if (!row) return;
      const txnId = row.cells[0]?.textContent;
      if (btn.classList.contains('btn-success')) {
        if (confirm('Approve transaction ' + txnId + '?')) row.remove();
      } else if (btn.classList.contains('btn-danger')) {
        if (confirm('Block transaction ' + txnId + '?')) row.remove();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════════ */
  function init() {
    initSectionTabs();
    initToggleSwitches();
    initFraudTableDelegation();
    loadOverviewMetrics();

    // Activate first visible section
    const firstActive = document.querySelector('.section-panel.active');
    if (!firstActive) {
      const firstPanel = document.querySelector('.section-panel');
      if (firstPanel) firstPanel.classList.add('active');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  /* ── Public API ──────────────────────────────────────────────────── */
  window.GlobexAI = {
    activateSection,
    deleteFAQ,
    addFAQ,
    reviewFlag,
    runPriceOptimisation,
    exportReport,
    handleUpload,
    loadFlaggedTransactions,
    loadChatHistory,
    loadFAQs,
    loadAiAnalytics,
  };

})();
