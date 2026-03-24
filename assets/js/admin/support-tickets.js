/**
 * Globex Sky — Admin Support Tickets JS
 * Handles: ticket list, filters, detail modal, KB CRUD, FAQ drag-and-drop
 */

/* ─── API helper ─────────────────────────────────────────────────────────── */
const API = window.GlobexConfig?.API_BASE_URL || '/api/v1';

const Http = {
  _headers(json = true) {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token') || '';
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },
  async get(path) {
    const r = await fetch(API + path, { headers: this._headers(false) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  },
  async post(path, body) {
    const r = await fetch(API + path, { method: 'POST', headers: this._headers(), body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  },
  async put(path, body) {
    const r = await fetch(API + path, { method: 'PUT', headers: this._headers(), body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  },
  async del(path) {
    const r = await fetch(API + path, { method: 'DELETE', headers: this._headers(false) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  },
};

/* ─── Toast ──────────────────────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const el = document.getElementById('toastMsg');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast-msg toast-${type} show`;
  clearTimeout(el._tid);
  el._tid = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   TICKET LIST
═══════════════════════════════════════════════════════════════════════════ */
const Tickets = {
  page: 1,
  limit: 20,
  filters: { status: '', priority: '', assigned_to: '', search: '', date_from: '', date_to: '' },
  selected: new Set(),
  _debounceTimer: null,

  async init() {
    await this.loadStats();
    await this.load();
    this._bindEvents();
  },

  async loadStats() {
    try {
      const { data } = await Http.get('/admin/tickets/stats');
      const map = { open: 'statOpen', pending: 'statPending', in_progress: 'statInProgress', resolved: 'statResolved', closed: 'statClosed' };
      Object.entries(map).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = data[k] ?? 0;
      });
    } catch (_) {}
  },

  async load() {
    const tbody = document.getElementById('ticketsTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><span class="spinner"></span> Loading tickets…</td></tr>';

    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    Object.entries(this.filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    try {
      const { data, meta } = await Http.get(`/admin/tickets?${params}`);
      this._render(data, tbody);
      this._renderPagination(meta);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:32px">${e.message}</td></tr>`;
    }
  },

  _render(tickets, tbody) {
    if (!tickets?.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-ticket-alt"></i><h3>No tickets found</h3><p>Try adjusting your filters.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = tickets.map(t => `
      <tr data-id="${t.id}">
        <td><input type="checkbox" class="row-check" data-id="${t.id}" ${this.selected.has(t.id) ? 'checked' : ''}></td>
        <td>
          <div class="ticket-subject" onclick="TicketDetail.open('${t.id}')">${_esc(t.subject)}</div>
          <div class="ticket-id">#${t.id.slice(0, 8)}</div>
        </td>
        <td>
          <div class="user-cell">
            <span class="user-name">${_esc(t.user?.full_name || '—')}</span>
            <span class="user-email">${_esc(t.user?.email || '')}</span>
          </div>
        </td>
        <td>${_priorityBadge(t.priority)}</td>
        <td>${_statusBadge(t.status)}</td>
        <td>${_esc(t.assigned?.full_name || '—')}</td>
        <td>${_fmtDate(t.created_at)}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-primary btn-xs" onclick="TicketDetail.open('${t.id}')"><i class="fas fa-eye"></i></button>
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('.row-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        cb.checked ? this.selected.add(id) : this.selected.delete(id);
        this._updateBulkBar();
      });
    });
  },

  _renderPagination(meta) {
    const wrap = document.getElementById('pagination');
    if (!wrap || !meta) return;
    const { page, total_pages } = meta;
    let html = `<button class="page-btn" onclick="Tickets.goPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    const start = Math.max(1, page - 2);
    const end   = Math.min(total_pages, page + 2);
    for (let i = start; i <= end; i++) html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="Tickets.goPage(${i})">${i}</button>`;
    html += `<button class="page-btn" onclick="Tickets.goPage(${page + 1})" ${page >= total_pages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    html += `<span class="page-info">Page ${page} of ${total_pages} (${meta.total} tickets)</span>`;
    wrap.innerHTML = html;
  },

  goPage(p) { this.page = p; this.load(); },

  applyFilter(key, val) {
    this.filters[key] = val;
    this.page = 1;
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this.load(), 300);
  },

  _updateBulkBar() {
    const bar = document.getElementById('bulkBar');
    if (!bar) return;
    if (this.selected.size > 0) {
      bar.classList.add('visible');
      const cnt = bar.querySelector('.bulk-count');
      if (cnt) cnt.textContent = `${this.selected.size} selected`;
    } else {
      bar.classList.remove('visible');
    }
  },

  clearSelection() {
    this.selected.clear();
    document.querySelectorAll('.row-check').forEach(cb => { cb.checked = false; });
    this._updateBulkBar();
  },

  async bulkAction(action) {
    if (!this.selected.size) return;
    const ids = [...this.selected];
    try {
      if (action === 'close') {
        await Promise.all(ids.map(id => Http.put(`/admin/tickets/${id}/status`, { status: 'closed' })));
        toast(`${ids.length} ticket(s) closed.`);
      } else if (action.startsWith('priority:')) {
        const priority = action.split(':')[1];
        await Promise.all(ids.map(id => Http.put(`/admin/tickets/${id}/priority`, { priority })));
        toast(`Priority updated for ${ids.length} ticket(s).`);
      }
      this.clearSelection();
      this.load();
    } catch (e) { toast(e.message, 'error'); }
  },

  _bindEvents() {
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        document.querySelectorAll('.row-check').forEach(cb => {
          cb.checked = selectAll.checked;
          selectAll.checked ? this.selected.add(cb.dataset.id) : this.selected.delete(cb.dataset.id);
        });
        this._updateBulkBar();
      });
    }
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   TICKET DETAIL MODAL
═══════════════════════════════════════════════════════════════════════════ */
const TicketDetail = {
  current: null,

  async open(id) {
    this.current = id;
    const overlay = document.getElementById('ticketModal');
    if (!overlay) return;
    overlay.classList.add('open');
    document.getElementById('modalBody').innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
    document.getElementById('modalNotes').innerHTML = '';

    try {
      const { data } = await Http.get(`/admin/tickets/${id}`);
      this._render(data);
    } catch (e) {
      document.getElementById('modalBody').innerHTML = `<p style="color:#ef4444">${e.message}</p>`;
    }
  },

  close() {
    const overlay = document.getElementById('ticketModal');
    if (overlay) overlay.classList.remove('open');
    this.current = null;
  },

  _render(t) {
    // Header
    document.getElementById('modalTicketId').textContent  = `#${t.id.slice(0, 8)}`;
    document.getElementById('modalSubject').textContent   = t.subject;
    document.getElementById('modalPriority').innerHTML    = _priorityBadge(t.priority);
    document.getElementById('modalStatus').innerHTML      = _statusBadge(t.status);
    document.getElementById('modalUser').innerHTML        = `<strong>${_esc(t.user?.full_name || '—')}</strong> &lt;${_esc(t.user?.email || '')}&gt;`;
    document.getElementById('modalAssigned').textContent  = t.assigned?.full_name || 'Unassigned';
    document.getElementById('modalCreated').textContent   = _fmtDate(t.created_at);

    // User quick card
    const qv = document.getElementById('modalUserCard');
    if (qv && t.user) {
      const initials = (t.user.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      qv.innerHTML = `
        <div class="user-quick-avatar">${initials}</div>
        <div class="user-quick-info">
          <div class="user-quick-name">${_esc(t.user.full_name || '—')}</div>
          <div class="user-quick-email">${_esc(t.user.email || '')}</div>
          <div class="user-quick-stats">
            <div class="user-quick-stat"><strong>${_fmtDate(t.user.created_at)}</strong>Joined</div>
          </div>
        </div>`;
    }

    // Conversation
    const msgs = (t.messages || []).filter(m => !m.is_internal);
    document.getElementById('modalBody').innerHTML = this._renderThread(msgs);

    // Internal notes
    const notes = (t.messages || []).filter(m => m.is_internal);
    document.getElementById('modalNotes').innerHTML = notes.length
      ? this._renderNotes(notes)
      : '<p style="color:#94a3b8;font-size:.83rem">No internal notes yet.</p>';

    // History / Timeline
    const history = t.history || [];
    document.getElementById('modalTimeline').innerHTML = history.length
      ? this._renderTimeline(history)
      : '<p style="color:#94a3b8;font-size:.83rem">No history recorded.</p>';

    // Populate dropdowns
    const prioSel   = document.getElementById('replyPriority');
    const statusSel = document.getElementById('replyStatus');
    if (prioSel)   prioSel.value   = t.priority || 'medium';
    if (statusSel) statusSel.value = t.status   || 'open';
  },

  _renderThread(msgs) {
    if (!msgs.length) return '<div class="empty-state"><i class="fas fa-comments"></i><h3>No messages yet</h3></div>';
    return `<div class="conv-thread">${msgs.map(m => {
      const isAdmin = m.sender?.role?.role === 'admin';
      const cls     = isAdmin ? 'admin-msg' : 'user-msg';
      const initials = (m.sender?.full_name || '?').split(' ').map(c => c[0]).join('').slice(0, 2).toUpperCase();
      const avatarCls = isAdmin ? 'admin' : 'user';
      return `
        <div class="msg-bubble ${cls}">
          <div class="msg-avatar-row">
            <div class="msg-avatar ${avatarCls}">${initials}</div>
            <span>${_esc(m.sender?.full_name || 'User')}</span>
          </div>
          <div class="msg-body">${_esc(m.body)}</div>
          ${m.attachments?.length ? `<div class="attachments-row">${m.attachments.map(a => `<a href="${a.url}" class="attachment-file" target="_blank"><i class="fas fa-paperclip"></i>${_esc(a.name || 'File')}</a>`).join('')}</div>` : ''}
          <span class="msg-time">${_fmtDate(m.created_at, true)}</span>
        </div>`;
    }).join('')}</div>`;
  },

  _renderNotes(notes) {
    return `<div class="conv-thread">${notes.map(n => `
      <div class="msg-bubble note-msg">
        <div class="note-label"><i class="fas fa-lock"></i> Internal Note</div>
        <div class="msg-body">${_esc(n.body)}</div>
        <span class="msg-time">${_esc(n.sender?.full_name || 'Admin')} · ${_fmtDate(n.created_at, true)}</span>
      </div>`).join('')}</div>`;
  },

  _renderTimeline(history) {
    return `<div class="timeline">${history.map(h => `
      <div class="timeline-item">
        <div class="timeline-action">${_esc(_historyLabel(h.action))}</div>
        <div class="timeline-who">by ${_esc(h.actor?.full_name || 'System')}</div>
        ${h.old_value ? `<div class="timeline-who" style="font-size:.73rem;color:#94a3b8">${_esc(h.old_value)} → ${_esc(h.new_value || '')}</div>` : ''}
        <div class="timeline-when">${_fmtDate(h.created_at, true)}</div>
      </div>`).join('')}</div>`;
  },

  switchTab(tab) {
    document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab${_cap(tab)}`));
  },

  async sendReply() {
    const textarea = document.getElementById('replyText');
    const body     = textarea?.value?.trim();
    if (!body || !this.current) return;

    const priority = document.getElementById('replyPriority')?.value;
    const status   = document.getElementById('replyStatus')?.value;
    const btn      = document.getElementById('sendReplyBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      await Http.post(`/admin/tickets/${this.current}/reply`, { body });

      if (priority) await Http.put(`/admin/tickets/${this.current}/priority`, { priority });
      if (status)   await Http.put(`/admin/tickets/${this.current}/status`,   { status });

      textarea.value = '';
      toast('Reply sent successfully.');
      await this.open(this.current);
      Tickets.load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reply'; }
    }
  },

  async addNote() {
    const textarea = document.getElementById('noteText');
    const body     = textarea?.value?.trim();
    if (!body || !this.current) return;

    const btn = document.getElementById('addNoteBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      await Http.post(`/admin/tickets/${this.current}/notes`, { body });
      textarea.value = '';
      toast('Note added.');
      await this.open(this.current);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sticky-note"></i> Add Note'; }
    }
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════════════════ */
const KB = {
  articles: [],
  categories: [],
  editId: null,
  articleTags: [],

  async init() {
    await Promise.all([this.loadCategories(), this.loadArticles()]);
  },

  async loadCategories() {
    try {
      const { data } = await Http.get('/admin/kb/categories');
      this.categories = data || [];
      this._renderCategoryList();
      this._populateCategorySelects();
    } catch (e) { toast(e.message, 'error'); }
  },

  async loadArticles(params = {}) {
    const grid = document.getElementById('kbGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';

    const qs = new URLSearchParams(params).toString();
    try {
      const { data } = await Http.get(`/admin/kb/articles${qs ? '?' + qs : ''}`);
      this.articles = data || [];
      this._renderArticles();
    } catch (e) {
      grid.innerHTML = `<p style="color:#ef4444">${e.message}</p>`;
    }
  },

  _renderArticles() {
    const grid = document.getElementById('kbGrid');
    if (!grid) return;
    if (!this.articles.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>No articles yet</h3><p>Create your first knowledge base article.</p></div>';
      return;
    }
    grid.innerHTML = this.articles.map(a => `
      <div class="kb-card">
        <div class="kb-card-title">${_esc(a.title)}</div>
        <div class="kb-card-meta">
          <span><i class="fas fa-folder"></i> ${_esc(a.category || 'Uncategorized')}</span>
          <span>${_statusBadge(a.status === 'published' ? 'resolved' : 'pending', a.status)}</span>
        </div>
        <div class="kb-card-meta">
          <span><i class="fas fa-eye"></i> ${a.views || 0} views</span>
          <span>${_fmtDate(a.updated_at || a.created_at)}</span>
        </div>
        <div class="kb-card-actions">
          <button class="btn btn-secondary btn-xs" onclick="KB.openEdit('${a.id}')"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-danger btn-xs" onclick="KB.deleteArticle('${a.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('');
  },

  _renderCategoryList() {
    const list = document.getElementById('catList');
    if (!list) return;
    if (!this.categories.length) {
      list.innerHTML = '<p style="color:#94a3b8;font-size:.83rem;padding:8px">No categories yet.</p>';
      return;
    }
    list.innerHTML = this.categories.map(c => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f1f5f9">
        <span style="flex:1;font-size:.85rem;font-weight:500">${_esc(c.name)}</span>
        <button class="btn btn-secondary btn-xs" onclick="KB.editCategory('${c.id}','${_esc(c.name)}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-xs" onclick="KB.deleteCategory('${c.id}')"><i class="fas fa-trash"></i></button>
      </div>`).join('');
  },

  _populateCategorySelects() {
    ['articleCategory', 'kbCategoryFilter'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const current = sel.value;
      const opts = this.categories.map(c => `<option value="${_esc(c.name)}" ${c.name === current ? 'selected' : ''}>${_esc(c.name)}</option>`).join('');
      if (id === 'kbCategoryFilter') sel.innerHTML = `<option value="">All Categories</option>${opts}`;
      else sel.innerHTML = `<option value="">Select category…</option>${opts}`;
    });
  },

  openNew() {
    this.editId = null;
    this.articleTags = [];
    document.getElementById('articleModalTitle').textContent = 'New Article';
    document.getElementById('articleForm')?.reset();
    document.getElementById('articleTagsDisplay').innerHTML = '';
    document.getElementById('articleModal')?.classList.add('open');
  },

  async openEdit(id) {
    this.editId = id;
    document.getElementById('articleModalTitle').textContent = 'Edit Article';
    try {
      const { data } = await Http.get(`/admin/kb/articles/${id}`);
      document.getElementById('articleTitle').value   = data.title || '';
      document.getElementById('articleContent').value = data.content || '';
      document.getElementById('articleCategory').value = data.category || '';
      document.getElementById('articleStatus').value  = data.status || 'draft';
      this.articleTags = data.tags || [];
      this._renderTags();
      document.getElementById('articleModal')?.classList.add('open');
    } catch (e) { toast(e.message, 'error'); }
  },

  closeModal() {
    document.getElementById('articleModal')?.classList.remove('open');
    this.editId = null;
  },

  _renderTags() {
    const wrap = document.getElementById('articleTagsDisplay');
    if (!wrap) return;
    wrap.innerHTML = this.articleTags.map((t, i) => `
      <span class="tag-chip">${_esc(t)}<button onclick="KB.removeTag(${i})">×</button></span>`).join('');
  },

  addTag(e) {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const val = e.target.value.trim().replace(/,/g, '');
    if (val && !this.articleTags.includes(val)) {
      this.articleTags.push(val);
      this._renderTags();
    }
    e.target.value = '';
  },

  removeTag(i) {
    this.articleTags.splice(i, 1);
    this._renderTags();
  },

  async saveArticle(e) {
    e.preventDefault();
    const btn = document.getElementById('saveArticleBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const payload = {
      title:    document.getElementById('articleTitle').value.trim(),
      content:  document.getElementById('articleContent').value,
      category: document.getElementById('articleCategory').value,
      status:   document.getElementById('articleStatus').value,
      tags:     this.articleTags,
    };

    try {
      if (this.editId) {
        await Http.put(`/admin/kb/articles/${this.editId}`, payload);
        toast('Article updated.');
      } else {
        await Http.post('/admin/kb/articles', payload);
        toast('Article created.');
      }
      this.closeModal();
      this.loadArticles();
    } catch (e2) {
      toast(e2.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Article'; }
    }
  },

  async deleteArticle(id) {
    if (!confirm('Delete this article? This cannot be undone.')) return;
    try {
      await Http.del(`/admin/kb/articles/${id}`);
      toast('Article deleted.');
      this.loadArticles();
    } catch (e) { toast(e.message, 'error'); }
  },

  async addCategory() {
    const input = document.getElementById('newCatName');
    const name  = input?.value?.trim();
    if (!name) return;
    try {
      await Http.post('/admin/kb/categories', { name });
      input.value = '';
      toast('Category added.');
      await this.loadCategories();
    } catch (e) { toast(e.message, 'error'); }
  },

  editCategory(id, name) {
    const newName = prompt('Edit category name:', name);
    if (!newName || newName === name) return;
    Http.put(`/admin/kb/categories/${id}`, { name: newName })
      .then(() => { toast('Category updated.'); this.loadCategories(); })
      .catch(e => toast(e.message, 'error'));
  },

  async deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
      await Http.del(`/admin/kb/categories/${id}`);
      toast('Category deleted.');
      this.loadCategories();
    } catch (e) { toast(e.message, 'error'); }
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   FAQ MANAGEMENT (with drag-and-drop reorder)
═══════════════════════════════════════════════════════════════════════════ */
const FAQs = {
  items: [],
  editId: null,
  dragSrc: null,

  async init() {
    await this.load();
  },

  async load(search = '') {
    const list = document.getElementById('faqList');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';

    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    try {
      const { data } = await Http.get(`/admin/kb/faqs${qs}`);
      this.items = data || [];
      this._render();
    } catch (e) {
      list.innerHTML = `<p style="color:#ef4444">${e.message}</p>`;
    }
  },

  _render() {
    const list = document.getElementById('faqList');
    if (!list) return;
    if (!this.items.length) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-question-circle"></i><h3>No FAQs yet</h3><p>Add your first FAQ entry.</p></div>';
      return;
    }
    list.innerHTML = this.items.map((f, i) => `
      <div class="faq-item" draggable="true" data-id="${f.id}" data-index="${i}">
        <div class="faq-header" onclick="FAQs.toggle(this.closest('.faq-item'))">
          <span class="faq-drag-handle"><i class="fas fa-grip-vertical"></i></span>
          <span class="faq-question">${_esc(f.question)}</span>
          ${f.is_visible === false ? '<span class="badge-pill badge-closed" style="flex-shrink:0">Hidden</span>' : ''}
          <i class="fas fa-chevron-down faq-toggle-icon"></i>
        </div>
        <div class="faq-answer">${_esc(f.answer)}</div>
        <div class="faq-footer">
          <span>${_esc(f.category || 'General')}</span>
          <button class="btn btn-secondary btn-xs" onclick="FAQs.openEdit('${f.id}')"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-danger btn-xs" onclick="FAQs.delete('${f.id}')"><i class="fas fa-trash"></i></button>
          <label class="toggle-switch" title="${f.is_visible !== false ? 'Published' : 'Hidden'}">
            <input type="checkbox" ${f.is_visible !== false ? 'checked' : ''} onchange="FAQs.toggleVisible('${f.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>`).join('');

    this._bindDragDrop();
  },

  toggle(item) {
    item.classList.toggle('open');
  },

  _bindDragDrop() {
    const list = document.getElementById('faqList');
    if (!list) return;

    list.querySelectorAll('.faq-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        this.dragSrc = item;
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('is-dragging');
        this._saveOrder();
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this.dragSrc && item !== this.dragSrc) {
          const rect = item.getBoundingClientRect();
          const mid  = rect.top + rect.height / 2;
          e.clientY < mid ? list.insertBefore(this.dragSrc, item) : list.insertBefore(this.dragSrc, item.nextSibling);
        }
      });
    });
  },

  async _saveOrder() {
    const items = [...document.querySelectorAll('#faqList .faq-item')].map((el, i) => ({
      id: el.dataset.id,
      sort_order: i,
    }));
    try {
      await Http.put('/admin/kb/faqs/reorder', { items });
    } catch (e) { toast('Failed to save order: ' + e.message, 'error'); }
  },

  openNew() {
    this.editId = null;
    document.getElementById('faqModalTitle').textContent = 'New FAQ';
    document.getElementById('faqForm')?.reset();
    document.getElementById('faqModal')?.classList.add('open');
  },

  async openEdit(id) {
    this.editId = id;
    const item = this.items.find(f => f.id === id);
    if (!item) return;
    document.getElementById('faqModalTitle').textContent = 'Edit FAQ';
    document.getElementById('faqQuestion').value  = item.question || '';
    document.getElementById('faqAnswer').value    = item.answer || '';
    document.getElementById('faqCategory').value  = item.category || 'General';
    document.getElementById('faqVisible').checked = item.is_visible !== false;
    document.getElementById('faqModal')?.classList.add('open');
  },

  closeFaqModal() {
    document.getElementById('faqModal')?.classList.remove('open');
    this.editId = null;
  },

  async save(e) {
    e.preventDefault();
    const btn = document.getElementById('saveFaqBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const payload = {
      question:   document.getElementById('faqQuestion').value.trim(),
      answer:     document.getElementById('faqAnswer').value.trim(),
      category:   document.getElementById('faqCategory').value || 'General',
      is_visible: document.getElementById('faqVisible').checked,
    };

    try {
      if (this.editId) {
        await Http.put(`/admin/kb/faqs/${this.editId}`, payload);
        toast('FAQ updated.');
      } else {
        await Http.post('/admin/kb/faqs', payload);
        toast('FAQ added.');
      }
      this.closeFaqModal();
      this.load();
    } catch (e2) {
      toast(e2.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save FAQ'; }
    }
  },

  async delete(id) {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await Http.del(`/admin/kb/faqs/${id}`);
      toast('FAQ deleted.');
      this.load();
    } catch (e) { toast(e.message, 'error'); }
  },

  async toggleVisible(id, visible) {
    try {
      await Http.put(`/admin/kb/faqs/${id}`, { is_visible: visible });
      toast(`FAQ ${visible ? 'published' : 'hidden'}.`);
    } catch (e) { toast(e.message, 'error'); }
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION TABS (Tickets / KB / FAQs)
═══════════════════════════════════════════════════════════════════════════ */
function switchSection(section) {
  document.querySelectorAll('.section-tab').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  document.querySelectorAll('.section-panel').forEach(p => p.classList.toggle('active', p.id === `section${_cap(section)}`));
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function _esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _priorityBadge(p) {
  const map = { urgent: 'badge-urgent', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
  return `<span class="badge-pill ${map[p] || 'badge-medium'}">${_esc(p || 'medium')}</span>`;
}

function _statusBadge(s, label) {
  const map = {
    open:        'badge-open',
    pending:     'badge-pending',
    in_progress: 'badge-progress',
    resolved:    'badge-resolved',
    closed:      'badge-closed',
    published:   'badge-resolved',
    draft:       'badge-pending',
  };
  return `<span class="badge-pill ${map[s] || 'badge-closed'}">${_esc(label || s || '—')}</span>`;
}

function _fmtDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function _cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function _historyLabel(action) {
  const map = {
    status_changed:   'Status changed',
    priority_changed: 'Priority changed',
    assigned:         'Ticket assigned',
    reply_sent:       'Reply sent',
    note_added:       'Note added',
  };
  return map[action] || action;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  Tickets.init();
  KB.init();
  FAQs.init();

  // Sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('adminSidebar')?.classList.toggle('collapsed');
  });

  // Ticket modal close on overlay click
  document.getElementById('ticketModal')?.addEventListener('click', e => {
    if (e.target.id === 'ticketModal') TicketDetail.close();
  });

  // Article modal close on overlay click
  document.getElementById('articleModal')?.addEventListener('click', e => {
    if (e.target.id === 'articleModal') KB.closeModal();
  });

  // FAQ modal close on overlay click
  document.getElementById('faqModal')?.addEventListener('click', e => {
    if (e.target.id === 'faqModal') FAQs.closeFaqModal();
  });

  // Expose to inline handlers
  window.Tickets      = Tickets;
  window.TicketDetail = TicketDetail;
  window.KB           = KB;
  window.FAQs         = FAQs;
  window.switchSection = switchSection;
});
