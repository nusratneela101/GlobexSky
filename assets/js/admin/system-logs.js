/**
 * Globex Sky — assets/js/admin/system-logs.js
 * System Logs & Monitoring: tabs, filtering, pagination, auto-refresh,
 * health gauges, JSON diff viewer, export, alert thresholds.
 */

(function () {
  'use strict';

  /* ─── Config ────────────────────────────────────────────────────────────── */
  const REFRESH_INTERVAL_MS = 30_000;
  const API_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';

  /* ─── State ─────────────────────────────────────────────────────────────── */
  let _refreshTimer = null;
  let _countdown    = REFRESH_INTERVAL_MS / 1000;
  let _activeTab    = 'health';

  const _state = {
    errors:   { page: 1, limit: 50, level: 'all', search: '', dateFrom: '', dateTo: '' },
    activity: { page: 1, limit: 50, action: '', search: '', dateFrom: '', dateTo: '' },
    audit:    { page: 1, limit: 50, entity: '', search: '', dateFrom: '', dateTo: '' },
    perf:     {},
  };

  /* ─── Init ──────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    _initTabs();
    _initSidebar();
    _loadHealth();
    _startAutoRefresh();
    _initFilterListeners();
  });

  /* ─── Auth helpers ──────────────────────────────────────────────────────── */
  function _headers() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  async function _get(path, params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)),
    );
    const url = `${API_BASE}${path}${qs.toString() ? '?' + qs : ''}`;
    const res = await fetch(url, { headers: _headers() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  /* ─── Tab navigation ────────────────────────────────────────────────────── */
  function _initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        _switchTab(tab);
      });
    });
  }

  function _switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tab));

    switch (tab) {
      case 'health':   _loadHealth();   break;
      case 'errors':   _loadErrors();   break;
      case 'activity': _loadActivity(); break;
      case 'audit':    _loadAudit();    break;
      case 'perf':     _loadPerf();     break;
    }
  }

  /* ─── Sidebar collapse ──────────────────────────────────────────────────── */
  function _initSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('adminSidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
  }

  /* ─── Auto-refresh ──────────────────────────────────────────────────────── */
  function _startAutoRefresh() {
    _countdown = REFRESH_INTERVAL_MS / 1000;
    _refreshTimer = setInterval(() => {
      _countdown--;
      _updateCountdown();
      if (_countdown <= 0) {
        _countdown = REFRESH_INTERVAL_MS / 1000;
        _refreshCurrentTab();
      }
    }, 1000);
  }

  function _updateCountdown() {
    const el = document.getElementById('refreshCountdown');
    if (el) el.textContent = `Auto-refresh in ${_countdown}s`;
  }

  function _refreshCurrentTab() {
    _switchTab(_activeTab);
  }

  /* ─── Filter listeners ──────────────────────────────────────────────────── */
  function _initFilterListeners() {
    // Error filters
    _on('errorSearch',   'input',  () => { _state.errors.search  = _val('errorSearch');   _state.errors.page = 1; _loadErrors(); });
    _on('errorDateFrom', 'change', () => { _state.errors.dateFrom = _val('errorDateFrom'); _state.errors.page = 1; _loadErrors(); });
    _on('errorDateTo',   'change', () => { _state.errors.dateTo   = _val('errorDateTo');   _state.errors.page = 1; _loadErrors(); });

    // Severity filter buttons
    document.querySelectorAll('.sev-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sev = btn.dataset.sev;
        document.querySelectorAll('.sev-btn').forEach(b => {
          b.classList.remove('active', 'critical-active', 'error-active', 'warning-active', 'info-active');
        });
        if (sev === 'all') btn.classList.add('active');
        else               btn.classList.add(`${sev}-active`);
        _state.errors.level = sev;
        _state.errors.page  = 1;
        _loadErrors();
      });
    });

    // Activity filters
    _on('activitySearch',   'input',  () => { _state.activity.search   = _val('activitySearch');   _state.activity.page = 1; _loadActivity(); });
    _on('activityAction',   'change', () => { _state.activity.action   = _val('activityAction');   _state.activity.page = 1; _loadActivity(); });
    _on('activityDateFrom', 'change', () => { _state.activity.dateFrom = _val('activityDateFrom'); _state.activity.page = 1; _loadActivity(); });
    _on('activityDateTo',   'change', () => { _state.activity.dateTo   = _val('activityDateTo');   _state.activity.page = 1; _loadActivity(); });

    // Audit filters
    _on('auditSearch',   'input',  () => { _state.audit.search   = _val('auditSearch');   _state.audit.page = 1; _loadAudit(); });
    _on('auditEntity',   'change', () => { _state.audit.entity   = _val('auditEntity');   _state.audit.page = 1; _loadAudit(); });
    _on('auditDateFrom', 'change', () => { _state.audit.dateFrom = _val('auditDateFrom'); _state.audit.page = 1; _loadAudit(); });
    _on('auditDateTo',   'change', () => { _state.audit.dateTo   = _val('auditDateTo');   _state.audit.page = 1; _loadAudit(); });
  }

  /* ─── Load: Health ──────────────────────────────────────────────────────── */
  async function _loadHealth() {
    try {
      const res = await _get('/admin/system/health');
      _renderHealth(res.data, res.alerts || []);
    } catch (err) {
      _renderHealthError(err.message);
    }
  }

  function _renderHealth(h, alerts) {
    // Alerts
    const alertsEl = document.getElementById('healthAlerts');
    if (alertsEl) {
      alertsEl.innerHTML = alerts.length === 0 ? '' : alerts.map(a =>
        `<div class="alert-banner ${a.level}"><i class="fas fa-exclamation-triangle"></i><span>${a.message}</span></div>`,
      ).join('');
    }

    // Server status
    _setText('serverStatus',    h.server?.status || 'online');
    _setText('serverOs',        `${h.server?.os || ''} ${h.server?.arch || ''}`);
    _setText('nodeVersion',     h.nodeVersion || '');
    _setText('dbStatus',        h.database?.status || 'unknown');
    _setText('dbLatency',       h.database?.latencyMs !== null ? `${h.database?.latencyMs}ms` : 'N/A');

    // Status dots
    _setStatusDot('serverStatusDot', h.server?.status || 'online');
    _setStatusDot('dbStatusDot', h.database?.status || 'unknown');

    // Memory
    const memPct = h.memory?.usagePct || 0;
    _setText('memUsed',  `${h.memory?.usedMb || 0} MB`);
    _setText('memTotal', `${h.memory?.totalMb || 0} MB`);
    _setText('memPct',   `${memPct}%`);
    _setProgress('memBar', memPct);

    // CPU
    const cpuPct = h.cpu?.usagePct || 0;
    _setText('cpuPct',   `${cpuPct}%`);
    _setText('cpuCores', h.cpu?.cores || 0);
    _setProgress('cpuBar', cpuPct);

    // Heap
    _setText('heapUsed',  `${h.heap?.usedMb || 0} MB`);
    _setText('heapTotal', `${h.heap?.totalMb || 0} MB`);
    const heapPct = h.heap?.totalMb ? Math.round((h.heap.usedMb / h.heap.totalMb) * 100) : 0;
    _setProgress('heapBar', heapPct);
    _setText('heapPct', `${heapPct}%`);

    // Uptime
    if (h.uptime) {
      _setText('uptimeDisplay', _formatUptime(h.uptime.appMs));
    }
  }

  function _renderHealthError(msg) {
    const alertsEl = document.getElementById('healthAlerts');
    if (alertsEl) {
      alertsEl.innerHTML = `<div class="alert-banner critical"><i class="fas fa-times-circle"></i><span>Failed to load health data: ${msg}</span></div>`;
    }
  }

  /* ─── Load: Error Logs ──────────────────────────────────────────────────── */
  async function _loadErrors() {
    _setLoading('errorTableBody', 6);
    try {
      const s = _state.errors;
      const res = await _get('/admin/logs/errors', {
        level:     s.level === 'all' ? '' : s.level,
        search:    s.search,
        date_from: s.dateFrom,
        date_to:   s.dateTo,
        page:      s.page,
        limit:     s.limit,
      });
      _renderErrors(res.data || [], res.total || 0);
      _renderPagination('errorPagination', res.total, s.page, s.limit, p => { _state.errors.page = p; _loadErrors(); });
    } catch (err) {
      _setError('errorTableBody', 6, err.message);
    }
  }

  function _renderErrors(rows, total) {
    const tbody = document.getElementById('errorTableBody');
    if (!tbody) return;

    _setText('errorCount', total);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-check-circle"></i><p>No error logs found.</p></td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const badgeClass = r.level === 'critical' ? 'badge-critical' : r.level === 'error' ? 'badge-error' : r.level === 'warning' ? 'badge-warning' : 'badge-info';
      return `<tr data-sev="${r.level}">
        <td>${_fmtDate(r.ts)}</td>
        <td><span class="badge-pill ${badgeClass}">${_esc(r.level)}</span></td>
        <td>${_esc(r.component || '')}</td>
        <td class="log-msg" title="${_esc(r.message)}">${_esc(r.message)}</td>
        <td class="log-file">${_esc(r.file || '')}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="window.SysLogs.showStackTrace(${JSON.stringify(_esc(r.stack || 'No stack trace.'))})"><i class="fas fa-search"></i></button></td>
      </tr>`;
    }).join('');
  }

  /* ─── Load: Activity Logs ───────────────────────────────────────────────── */
  async function _loadActivity() {
    _setLoading('activityTableBody', 6);
    try {
      const s = _state.activity;
      const res = await _get('/admin/logs/activity', {
        action:    s.action,
        search:    s.search,
        date_from: s.dateFrom,
        date_to:   s.dateTo,
        page:      s.page,
        limit:     s.limit,
      });
      _renderActivity(res.data || [], res.total || 0);
      _renderPagination('activityPagination', res.total, s.page, s.limit, p => { _state.activity.page = p; _loadActivity(); });
    } catch (err) {
      _setError('activityTableBody', 6, err.message);
    }
  }

  function _renderActivity(rows, total) {
    const tbody = document.getElementById('activityTableBody');
    if (!tbody) return;

    _setText('activityCount', total);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-stream"></i><p>No activity logs found.</p></td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `<tr>
      <td>${_fmtDate(r.ts)}</td>
      <td>${_esc(r.userEmail || 'system')}</td>
      <td><span class="badge-pill badge-info">${_esc(r.action || '')}</span></td>
      <td>${_esc(r.entity || '')}</td>
      <td>${_esc(r.entityId || '')}</td>
      <td>${_esc(r.ip || '')}</td>
    </tr>`).join('');
  }

  /* ─── Load: Audit Trail ─────────────────────────────────────────────────── */
  async function _loadAudit() {
    _setLoading('auditTableBody', 7);
    try {
      const s = _state.audit;
      const res = await _get('/admin/logs/audit', {
        entity:    s.entity,
        search:    s.search,
        date_from: s.dateFrom,
        date_to:   s.dateTo,
        page:      s.page,
        limit:     s.limit,
      });
      _renderAudit(res.data || [], res.total || 0);
      _renderPagination('auditPagination', res.total, s.page, s.limit, p => { _state.audit.page = p; _loadAudit(); });
    } catch (err) {
      _setError('auditTableBody', 7, err.message);
    }
  }

  function _renderAudit(rows, total) {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    _setText('auditCount', total);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-shield-alt"></i><p>No audit records found.</p></td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `<tr>
      <td>${_fmtDate(r.ts)}</td>
      <td>${_esc(r.adminEmail || 'system')}</td>
      <td><span class="badge-pill badge-info">${_esc(r.action || '')}</span></td>
      <td>${_esc(r.entity || '')}</td>
      <td>${_esc(r.entityId || '')}</td>
      <td><button class="btn btn-sm btn-secondary" onclick="window.SysLogs.showDiff(${JSON.stringify(r.before)}, ${JSON.stringify(r.after)})"><i class="fas fa-code-branch"></i> Diff</button></td>
    </tr>`).join('');
  }

  /* ─── Load: Performance ─────────────────────────────────────────────────── */
  async function _loadPerf() {
    try {
      const res = await _get('/admin/system/performance');
      _renderPerf(res.data || {});
    } catch (err) {
      const el = document.getElementById('perfContent');
      if (el) el.innerHTML = `<div class="alert-banner critical"><i class="fas fa-times-circle"></i><span>Failed to load metrics: ${err.message}</span></div>`;
    }
  }

  function _renderPerf(d) {
    _setText('avgResponseMs', d.avgResponseMs !== undefined ? `${d.avgResponseMs}ms` : 'N/A');
    _setText('p95Ms',         d.p95Ms !== undefined ? `${d.p95Ms}ms` : 'N/A');
    _setText('slowQueryCount', d.slowQueries ? d.slowQueries.length : 0);

    // Route stats table
    const routeTbody = document.getElementById('routeStatsBody');
    if (routeTbody) {
      if (!d.routeStats || d.routeStats.length === 0) {
        routeTbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-tachometer-alt"></i><p>No API timing data yet.</p></td></tr>`;
      } else {
        routeTbody.innerHTML = d.routeStats.map(r => {
          const avgClass = r.avgMs >= 1000 ? 'badge-error' : r.avgMs >= 500 ? 'badge-warning' : 'badge-success';
          return `<tr>
            <td><span class="badge-pill badge-gray">${_esc(r.method)}</span></td>
            <td class="log-file">${_esc(r.path)}</td>
            <td>${r.count}</td>
            <td><span class="badge-pill ${avgClass}">${r.avgMs}ms</span></td>
            <td>${r.maxMs}ms</td>
          </tr>`;
        }).join('');
      }
    }

    // Slow queries table
    const slowTbody = document.getElementById('slowQueriesBody');
    if (slowTbody) {
      if (!d.slowQueries || d.slowQueries.length === 0) {
        slowTbody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="fas fa-check-circle"></i><p>No slow queries detected.</p></td></tr>`;
      } else {
        slowTbody.innerHTML = d.slowQueries.map(q => `<tr>
          <td>${_fmtDate(q.ts)}</td>
          <td><span class="badge-pill badge-gray">${_esc(q.method)}</span></td>
          <td class="log-file">${_esc(q.path)}</td>
          <td><span class="badge-pill badge-error">${q.durationMs}ms</span></td>
        </tr>`).join('');
      }
    }
  }

  /* ─── JSON Diff Viewer ──────────────────────────────────────────────────── */
  function _showDiff(before, after) {
    const modal = document.getElementById('diffModal');
    const container = document.getElementById('diffContent');
    if (!modal || !container) return;

    const bStr = before ? JSON.stringify(before, null, 2) : '(none)';
    const aStr = after  ? JSON.stringify(after,  null, 2) : '(none)';

    const bLines = bStr.split('\n');
    const aLines = aStr.split('\n');

    let html = '<div class="diff-viewer">';

    // Simple line-by-line diff (before vs after side-by-side)
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0">';

    html += '<div style="border-right:1px solid #e2e8f0">';
    html += '<div class="diff-line" style="background:#fee2e2;font-weight:600;padding:6px 12px">Before</div>';
    bLines.forEach(line => {
      const inAfter = aLines.includes(line);
      html += `<div class="diff-line ${inAfter ? 'neutral' : 'removed'}">${_esc(line)}</div>`;
    });
    html += '</div>';

    html += '<div>';
    html += '<div class="diff-line" style="background:#d1fae5;font-weight:600;padding:6px 12px">After</div>';
    aLines.forEach(line => {
      const inBefore = bLines.includes(line);
      html += `<div class="diff-line ${inBefore ? 'neutral' : 'added'}">${_esc(line)}</div>`;
    });
    html += '</div>';

    html += '</div></div>';

    container.innerHTML = html;
    modal.classList.add('open');
  }

  function _showStackTrace(stack) {
    const modal = document.getElementById('stackModal');
    const container = document.getElementById('stackContent');
    if (!modal || !container) return;
    container.innerHTML = `<pre class="log-stack" style="white-space:pre-wrap;padding:16px">${_esc(stack)}</pre>`;
    modal.classList.add('open');
  }

  /* ─── Export ────────────────────────────────────────────────────────────── */
  async function _exportLogs(type, format) {
    try {
      const qs = new URLSearchParams({ type, format });
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      const url = `${API_BASE}/admin/logs/export?${qs}`;
      const res = await fetch(url, { headers: _headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${type}_logs_${_isoDate()}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  }

  /* ─── Pagination helper ─────────────────────────────────────────────────── */
  function _renderPagination(containerId, total, currentPage, limit, onPageChange) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const totalPages = Math.ceil(total / limit) || 1;
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const pages = _getPageRange(currentPage, totalPages);
    let html = `<span class="page-info">Page ${currentPage} of ${totalPages} (${total} total)</span>`;

    html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-p="${currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;

    pages.forEach(p => {
      if (p === '...') {
        html += `<span class="page-btn" style="cursor:default">…</span>`;
      } else {
        html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-p="${p}">${p}</button>`;
      }
    });

    html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-p="${currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;

    el.innerHTML = html;
    el.querySelectorAll('button[data-p]').forEach(btn => {
      btn.addEventListener('click', () => onPageChange(+btn.dataset.p));
    });
  }

  function _getPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  /* ─── UI helpers ────────────────────────────────────────────────────────── */
  function _setLoading(tbodyId, cols) {
    const el = document.getElementById(tbodyId);
    if (el) el.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:#64748b"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>Loading…</td></tr>`;
  }

  function _setError(tbodyId, cols, msg) {
    const el = document.getElementById(tbodyId);
    if (el) el.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:#ef4444"><i class="fas fa-exclamation-circle" style="margin-right:8px"></i>${_esc(msg)}</td></tr>`;
  }

  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function _val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _on(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  }

  function _setProgress(barId, pct) {
    const el = document.getElementById(barId);
    if (!el) return;
    const clamped = Math.max(0, Math.min(100, pct));
    el.style.width = `${clamped}%`;
    el.className = 'progress-bar ' + (clamped >= 90 ? 'red' : clamped >= 70 ? 'yellow' : 'green');
  }

  function _setStatusDot(dotId, status) {
    const el = document.getElementById(dotId);
    if (!el) return;
    el.className = `status-dot ${status} ${status === 'online' ? 'pulse' : ''}`;
  }

  function _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return iso; }
  }

  function _isoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function _formatUptime(ms) {
    const s  = Math.floor(ms / 1000);
    const m  = Math.floor(s / 60);
    const h  = Math.floor(m / 60);
    const d  = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  /* ─── Public API ────────────────────────────────────────────────────────── */
  window.SysLogs = {
    showDiff:       _showDiff,
    showStackTrace: _showStackTrace,
    exportLogs:     _exportLogs,
    refresh:        _refreshCurrentTab,
    switchTab:      _switchTab,
    closeModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    },
  };
})();
