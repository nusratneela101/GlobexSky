/**
 * newsletter.js
 * Newsletter Subscription module for GlobexSky
 *
 * Responsibilities:
 *  - localStorage-based subscriber management (demo)
 *  - Subscription form validation (public page)
 *  - Unsubscribe with feedback (public page)
 *  - Admin: subscriber list with search/filter/pagination
 *  - Admin: bulk actions (delete, activate, deactivate)
 *  - Admin: CSV export
 *  - Admin: newsletter compose + preview
 *  - Admin: campaign history
 *  - Admin: mock analytics data
 */

'use strict';

/* ─── Constants ──────────────────────────────────────────── */
const NL_STORAGE_KEY       = 'globexsky_newsletter_subscribers';
const NL_CAMPAIGNS_KEY     = 'globexsky_newsletter_campaigns';
const NL_PAGE_SIZE         = 10;
const NL_MAX_PAGES_DISPLAY = 5;

/* Mock engagement rate ranges used when generating sent campaign analytics */
const NL_MOCK_OPEN_BASE    = 0.35;
const NL_MOCK_OPEN_RANGE   = 0.10;
const NL_MOCK_CLICK_BASE   = 0.08;
const NL_MOCK_CLICK_RANGE  = 0.05;

/* ─── Default sample subscribers ────────────────────────── */
const NL_SAMPLE_SUBSCRIBERS = [
  { id: 's001', email: 'anna.kovacs@eurotrade.hu',  name: 'Anna Kovacs',      date: '2025-04-12', status: 'active',       prefs: ['deals','products'],     freq: 'weekly' },
  { id: 's002', email: 'liam.osei@ghanatrade.gh',   name: 'Liam Osei',        date: '2025-04-18', status: 'active',       prefs: ['deals','logistics'],    freq: 'monthly' },
  { id: 's003', email: 'mei.zhang@sourcing.cn',     name: 'Mei Zhang',        date: '2025-05-01', status: 'active',       prefs: ['products','suppliers'], freq: 'weekly' },
  { id: 's004', email: 'carlos.reyes@importco.mx',  name: 'Carlos Reyes',     date: '2025-05-10', status: 'unsubscribed', prefs: ['deals'],                freq: 'daily' },
  { id: 's005', email: 'priya.nair@spiceexports.in',name: 'Priya Nair',       date: '2025-05-22', status: 'active',       prefs: ['products','deals'],     freq: 'weekly' },
  { id: 's006', email: 'omar.hassan@logisticsng.ng',name: 'Omar Hassan',      date: '2025-06-03', status: 'active',       prefs: ['logistics'],            freq: 'monthly' },
  { id: 's007', email: 'sophie.muller@de-export.de',name: 'Sophie Müller',    date: '2025-06-07', status: 'pending',      prefs: ['suppliers','products'], freq: 'weekly' },
  { id: 's008', email: 'jin.park@koreatrade.kr',    name: 'Jin Park',         date: '2025-06-11', status: 'active',       prefs: ['products'],             freq: 'daily' },
  { id: 's009', email: 'fatima.al-rashid@gulfb2b.ae', name: 'Fatima Al-Rashid', date: '2025-06-15', status: 'active', prefs: ['deals','logistics','suppliers'], freq: 'weekly' },
  { id: 's010', email: 'pierre.leclerc@frexport.fr',name: 'Pierre Leclerc',   date: '2025-06-20', status: 'active',       prefs: ['deals'],                freq: 'monthly' },
  { id: 's011', email: 'amara.diallo@westafricab2b.sn', name: 'Amara Diallo', date: '2025-06-22', status: 'active', prefs: ['products','deals'],          freq: 'weekly' },
  { id: 's012', email: 'riku.tanaka@japanexport.jp',name: 'Riku Tanaka',      date: '2025-06-25', status: 'unsubscribed', prefs: ['products'],             freq: 'monthly' },
  { id: 's013', email: 'elena.popescu@rotrade.ro',  name: 'Elena Popescu',    date: '2025-07-01', status: 'active',       prefs: ['suppliers','deals'],    freq: 'weekly' },
  { id: 's014', email: 'kwame.asante@afrob2b.gh',   name: 'Kwame Asante',     date: '2025-07-03', status: 'bounced',      prefs: ['logistics'],            freq: 'daily' },
  { id: 's015', email: 'isabella.rossi@italtrade.it',name: 'Isabella Rossi',  date: '2025-07-06', status: 'active',       prefs: ['products','suppliers'], freq: 'weekly' },
];

/* ─── Default sample campaigns ──────────────────────────── */
const NL_SAMPLE_CAMPAIGNS = [
  { id: 'c001', subject: 'Globex Sky July Deals – Exclusive B2B Offers',        sent: '2025-07-01', recipients: 1840, opens: 672, clicks: 134, status: 'sent' },
  { id: 'c002', subject: 'New Supplier Network Update – June 2025',              sent: '2025-06-15', recipients: 1760, opens: 614, clicks: 98,  status: 'sent' },
  { id: 'c003', subject: 'Platform Feature Update: Advanced RFQ Tools',         sent: '2025-06-01', recipients: 1695, opens: 580, clicks: 87,  status: 'sent' },
  { id: 'c004', subject: 'Trade Finance Webinar Invitation',                    sent: '2025-05-20', recipients: 1620, opens: 502, clicks: 75,  status: 'sent' },
  { id: 'c005', subject: 'August Newsletter – Draft',                           sent: null,         recipients: 0,    opens: 0,   clicks: 0,   status: 'draft' },
];

/* ─── Template bodies for newsletter composer ─────────────── */
const NL_TEMPLATES = {
  blank: '',
  promo: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0052CC,#00C9A7);padding:32px;text-align:center;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:1.6rem;margin:0">🌍 Exclusive Deals – Globex Sky</h1>
  </div>
  <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
    <p style="color:#374151;font-size:0.95rem;line-height:1.7">Dear {{name}},</p>
    <p style="color:#374151;font-size:0.95rem;line-height:1.7">We have exciting new deals and supplier offers for you this week on <strong>Globex Sky</strong>.</p>
    <div style="background:#f0f6ff;border-left:4px solid #0052CC;padding:16px;border-radius:0 8px 8px 0;margin:16px 0">
      <strong style="color:#0052CC">✨ This week's highlights</strong>
      <ul style="color:#374151;margin:8px 0 0;line-height:1.8">
        <li>Up to 25% off bulk electronics</li>
        <li>New verified textile suppliers from India</li>
        <li>Trade finance at 0% intro rate</li>
      </ul>
    </div>
    <a href="#" style="display:inline-block;background:#0052CC;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:12px">Browse Deals →</a>
  </div>
  <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;text-align:center;font-size:0.78rem;color:#94a3b8">
    You are receiving this because you subscribed to Globex Sky newsletters.<br>
    <a href="#" style="color:#0052CC">Unsubscribe</a> | <a href="#" style="color:#0052CC">Preferences</a>
  </div>
</div>`,
  update: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#0A0E27;padding:28px;text-align:center;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:1.4rem;margin:0">Platform Update – Globex Sky</h1>
  </div>
  <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
    <p style="color:#374151;font-size:0.95rem;line-height:1.7">Hi {{name}},</p>
    <p style="color:#374151;font-size:0.95rem;line-height:1.7">Here's what's new on the Globex Sky platform this month.</p>
    <h3 style="color:#0052CC;margin:16px 0 8px">🚀 New Features</h3>
    <ul style="color:#374151;line-height:1.8;margin:0 0 16px">
      <li>Advanced RFQ workflow with multi-supplier comparison</li>
      <li>Real-time shipment tracking integration</li>
      <li>Improved AI-powered product discovery</li>
    </ul>
    <a href="#" style="display:inline-block;background:#0052CC;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">See What's New →</a>
  </div>
  <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;text-align:center;font-size:0.78rem;color:#94a3b8">
    <a href="#" style="color:#0052CC">Unsubscribe</a>
  </div>
</div>`,
};

/* ═══════════════════════════════════════════════════════════
   STORAGE HELPERS
   ═══════════════════════════════════════════════════════════ */

function nlGetSubscribers() {
  try {
    const raw = localStorage.getItem(NL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function nlSaveSubscribers(list) {
  localStorage.setItem(NL_STORAGE_KEY, JSON.stringify(list));
}

function nlGetCampaigns() {
  try {
    const raw = localStorage.getItem(NL_CAMPAIGNS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function nlSaveCampaigns(list) {
  localStorage.setItem(NL_CAMPAIGNS_KEY, JSON.stringify(list));
}

function nlEnsureData() {
  if (!nlGetSubscribers()) nlSaveSubscribers(NL_SAMPLE_SUBSCRIBERS);
  if (!nlGetCampaigns())   nlSaveCampaigns(NL_SAMPLE_CAMPAIGNS);
}

function nlGenerateId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ═══════════════════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════════════════ */

function nlEscHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nlFormatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* Toast helper – works on both pages */
let _nlToastTimer = null;
function nlToast(msg, type = 'info') {
  const el = document.getElementById('nlToast');
  if (!el) return;
  clearTimeout(_nlToastTimer);
  const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  const icon  = icons[type] || 'info-circle';
  el.innerHTML = `<i class="fas fa-${icon}"></i> ${nlEscHtml(msg)}`;
  el.className = `nl-toast ${type}`;
  // force reflow
  void el.offsetWidth;
  el.classList.add('visible');
  _nlToastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC SUBSCRIBE PAGE  (pages/newsletter/subscribe.html)
   ═══════════════════════════════════════════════════════════ */

function nlInitSubscribePage() {
  nlEnsureData();

  const tabBtns   = document.querySelectorAll('.nl-tab');
  const tabPanes  = document.querySelectorAll('.nl-tab-pane');
  const subForm   = document.getElementById('nlSubForm');
  const unsubForm = document.getElementById('nlUnsubForm');
  const prefItems = document.querySelectorAll('.nl-pref-item');
  const freqOpts  = document.querySelectorAll('.nl-freq-option');

  /* ── Tabs ── */
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  /* ── Preference checkboxes ── */
  prefItems.forEach(item => {
    item.addEventListener('click', () => {
      const cb = item.querySelector('input[type="checkbox"]');
      if (cb) {
        cb.checked = !cb.checked;
        item.classList.toggle('checked', cb.checked);
      }
    });
  });

  /* ── Frequency options ── */
  freqOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      freqOpts.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const radio = opt.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  /* ── Subscribe form submit ── */
  if (subForm) {
    subForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!nlValidateSubForm(subForm)) return;

      const email  = subForm.querySelector('#nlEmail').value.trim().toLowerCase();
      const name   = subForm.querySelector('#nlName').value.trim();
      const freq   = subForm.querySelector('input[name="nlFreq"]:checked')?.value || 'weekly';
      const prefs  = Array.from(subForm.querySelectorAll('input[name="nlPref"]:checked')).map(cb => cb.value);

      const subscribers = nlGetSubscribers();
      const existing    = subscribers.find(s => s.email === email);

      if (existing) {
        if (existing.status === 'active') {
          nlToast('You are already subscribed with this email.', 'warning');
          return;
        }
        // Re-subscribe
        existing.status = 'active';
        existing.name   = name;
        existing.freq   = freq;
        existing.prefs  = prefs;
        existing.date   = new Date().toISOString().slice(0, 10);
      } else {
        subscribers.push({
          id:     nlGenerateId('s'),
          email,
          name,
          date:   new Date().toISOString().slice(0, 10),
          status: 'pending',
          prefs,
          freq,
        });
      }

      nlSaveSubscribers(subscribers);
      nlShowConfirmation();
    });
  }

  /* ── Unsubscribe form submit ── */
  if (unsubForm) {
    unsubForm.addEventListener('submit', e => {
      e.preventDefault();
      const emailInput = unsubForm.querySelector('#nlUnsubEmail');
      const email = emailInput?.value.trim().toLowerCase();
      if (!email || !nlValidateEmail(email)) {
        nlShowInputError(emailInput, 'Please enter a valid email address.');
        return;
      }

      const subscribers = nlGetSubscribers();
      const sub = subscribers.find(s => s.email === email);
      if (!sub) {
        nlToast('Email address not found in our subscriber list.', 'error');
        return;
      }
      if (sub.status === 'unsubscribed') {
        nlToast('This email is already unsubscribed.', 'info');
        return;
      }

      sub.status = 'unsubscribed';
      nlSaveSubscribers(subscribers);

      const confirmationDiv = document.getElementById('nlUnsubConfirmation');
      if (confirmationDiv) {
        confirmationDiv.style.display = 'block';
        unsubForm.style.display = 'none';
      } else {
        nlToast('You have been unsubscribed successfully.', 'success');
      }
    });
  }
}

function nlValidateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function nlShowInputError(input, msg) {
  if (!input) return;
  input.classList.add('error');
  const errEl = input.parentElement?.querySelector('.nl-input-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.add('visible');
  }
}

function nlClearInputError(input) {
  if (!input) return;
  input.classList.remove('error');
  const errEl = input.parentElement?.querySelector('.nl-input-error');
  if (errEl) errEl.classList.remove('visible');
}

function nlValidateSubForm(form) {
  let valid = true;

  const emailInput = form.querySelector('#nlEmail');
  const nameInput  = form.querySelector('#nlName');

  if (emailInput) {
    nlClearInputError(emailInput);
    if (!emailInput.value.trim() || !nlValidateEmail(emailInput.value.trim())) {
      nlShowInputError(emailInput, 'Please enter a valid email address.');
      valid = false;
    } else {
      emailInput.addEventListener('input', () => nlClearInputError(emailInput), { once: true });
    }
  }

  if (nameInput) {
    nlClearInputError(nameInput);
    if (!nameInput.value.trim()) {
      nlShowInputError(nameInput, 'Please enter your name.');
      valid = false;
    } else {
      nameInput.addEventListener('input', () => nlClearInputError(nameInput), { once: true });
    }
  }

  return valid;
}

function nlShowConfirmation() {
  const formWrap  = document.getElementById('nlSubFormWrap');
  const confWrap  = document.getElementById('nlSubConfirmation');
  if (formWrap) formWrap.style.display = 'none';
  if (confWrap) {
    confWrap.style.display = '';   // clear inline display:none
    confWrap.classList.add('visible');
  }
}

/* ═══════════════════════════════════════════════════════════
   ADMIN PAGE  (pages/admin/newsletter.html)
   ═══════════════════════════════════════════════════════════ */

/* ── State ── */
let _nlPage        = 1;
let _nlFilter      = { search: '', status: '', date: '' };
let _nlSelected    = new Set();
let _nlAdminTab    = 'subscribers';

function nlInitAdminPage() {
  nlEnsureData();
  nlRenderStats();
  nlRenderSubscriberTable();
  nlRenderCampaignHistory();
  nlRenderAnalytics();
  nlBindAdminEvents();
}

/* ── Stats cards ── */
function nlRenderStats() {
  const subs     = nlGetSubscribers();
  const campaigns = nlGetCampaigns();

  const total       = subs.length;
  const active      = subs.filter(s => s.status === 'active').length;
  const unsub       = subs.filter(s => s.status === 'unsubscribed').length;
  const sentCampaigns = campaigns.filter(c => c.status === 'sent');
  const totalSent   = sentCampaigns.length;
  const avgOpen     = totalSent
    ? Math.round(sentCampaigns.reduce((a, c) => a + (c.opens / (c.recipients || 1)), 0) / totalSent * 100)
    : 0;

  nlSetText('nlStatTotal',   total);
  nlSetText('nlStatActive',  active);
  nlSetText('nlStatUnsub',   unsub);
  nlSetText('nlStatCampaigns', totalSent);
  nlSetText('nlStatOpenRate', avgOpen + '%');
}

function nlSetText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── Subscriber table ── */
function nlGetFilteredSubs() {
  let subs = nlGetSubscribers();
  const { search, status, date } = _nlFilter;

  if (search) {
    const q = search.toLowerCase();
    subs = subs.filter(s =>
      s.email.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    );
  }
  if (status) {
    subs = subs.filter(s => s.status === status);
  }
  if (date) {
    subs = subs.filter(s => s.date >= date);
  }
  return subs;
}

function nlRenderSubscriberTable() {
  const filtered = nlGetFilteredSubs();
  const total    = filtered.length;
  const pages    = Math.max(1, Math.ceil(total / NL_PAGE_SIZE));

  if (_nlPage > pages) _nlPage = pages;

  const start = (_nlPage - 1) * NL_PAGE_SIZE;
  const page  = filtered.slice(start, start + NL_PAGE_SIZE);

  const tbody = document.getElementById('nlSubTableBody');
  if (!tbody) return;

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8">No subscribers found.</td></tr>`;
  } else {
    tbody.innerHTML = page.map(s => {
      const statusBadge = nlStatusBadge(s.status);
      const checked = _nlSelected.has(s.id) ? 'checked' : '';
      return `
        <tr>
          <td><input type="checkbox" class="nl-row-check" data-id="${nlEscHtml(s.id)}" ${checked}/></td>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:32px;height:32px;border-radius:50%;background:#dbeafe;color:#0052CC;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.78rem;flex-shrink:0">${nlEscHtml(nlInitials(s.name))}</div>
              <span style="font-weight:500">${nlEscHtml(s.name)}</span>
            </div>
          </td>
          <td>${nlEscHtml(s.email)}</td>
          <td>${statusBadge}</td>
          <td>${nlEscHtml(nlFormatDate(s.date))}</td>
          <td><span style="font-size:.8rem;color:#64748b">${nlEscHtml((s.prefs || []).join(', ') || '—')}</span></td>
          <td>
            <div style="display:flex;gap:6px">
              ${s.status !== 'active'
                ? `<button class="nl-btn nl-btn-sm nl-btn-outline" onclick="nlActivateSub('${nlEscHtml(s.id)}')" title="Activate"><i class="fas fa-check"></i></button>`
                : `<button class="nl-btn nl-btn-sm" style="background:#ffedd5;color:#f97316;border:none" onclick="nlDeactivateSub('${nlEscHtml(s.id)}')" title="Deactivate"><i class="fas fa-pause"></i></button>`
              }
              <button class="nl-btn nl-btn-sm" style="background:#fee2e2;color:#ef4444;border:none" onclick="nlDeleteSub('${nlEscHtml(s.id)}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  /* Pagination */
  nlRenderPagination('nlSubPagination', _nlPage, pages, total, start, page.length);

  /* Row checkboxes */
  tbody.querySelectorAll('.nl-row-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) _nlSelected.add(cb.dataset.id);
      else            _nlSelected.delete(cb.dataset.id);
      nlUpdateBulkBar();
    });
  });

  /* Select-all */
  const allCb = document.getElementById('nlSelectAll');
  if (allCb) {
    allCb.checked = page.length > 0 && page.every(s => _nlSelected.has(s.id));
    allCb.onchange = () => {
      page.forEach(s => {
        if (allCb.checked) _nlSelected.add(s.id);
        else               _nlSelected.delete(s.id);
      });
      nlRenderSubscriberTable();
    };
  }

  nlUpdateBulkBar();
}

function nlInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function nlStatusBadge(status) {
  const map = {
    active:       ['nl-badge-active',       'Active'],
    unsubscribed: ['nl-badge-unsubscribed',  'Unsubscribed'],
    pending:      ['nl-badge-pending',       'Pending'],
    bounced:      ['nl-badge-bounced',       'Bounced'],
  };
  const [cls, label] = map[status] || ['nl-badge-unsubscribed', status];
  return `<span class="nl-badge ${cls}">${nlEscHtml(label)}</span>`;
}

function nlRenderPagination(containerId, currentPage, totalPages, totalItems, start, pageLen) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const end = start + pageLen;
  const info = `<span>Showing ${totalItems === 0 ? 0 : start + 1}–${end} of ${totalItems}</span>`;

  let btns = `<div class="nl-page-btns">`;
  btns += `<button class="nl-page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-nlpage="${currentPage - 1}">← Prev</button>`;

  const half  = Math.floor(NL_MAX_PAGES_DISPLAY / 2);
  let startP  = Math.max(1, currentPage - half);
  let endP    = Math.min(totalPages, startP + NL_MAX_PAGES_DISPLAY - 1);
  if (endP - startP < NL_MAX_PAGES_DISPLAY - 1) startP = Math.max(1, endP - NL_MAX_PAGES_DISPLAY + 1);

  for (let i = startP; i <= endP; i++) {
    btns += `<button class="nl-page-btn${i === currentPage ? ' active' : ''}" data-nlpage="${i}">${i}</button>`;
  }

  btns += `<button class="nl-page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-nlpage="${currentPage + 1}">Next →</button>`;
  btns += `</div>`;

  container.innerHTML = info + btns;

  // Attach click handlers via event delegation
  container.querySelectorAll('button[data-nlpage]').forEach(btn => {
    if (!btn.disabled) {
      btn.addEventListener('click', () => {
        _nlPage = parseInt(btn.dataset.nlpage, 10);
        nlRenderSubscriberTable();
      });
    }
  });
}

/* ── Bulk bar ── */
function nlUpdateBulkBar() {
  const bar = document.getElementById('nlBulkBar');
  if (!bar) return;
  const count = _nlSelected.size;
  if (count > 0) {
    bar.classList.add('visible');
    const info = bar.querySelector('.nl-bulk-info');
    if (info) info.textContent = `${count} subscriber${count !== 1 ? 's' : ''} selected`;
  } else {
    bar.classList.remove('visible');
  }
}

/* ── Subscriber actions ── */
function nlActivateSub(id) {
  const subs = nlGetSubscribers();
  const sub  = subs.find(s => s.id === id);
  if (sub) { sub.status = 'active'; nlSaveSubscribers(subs); nlRenderSubscriberTable(); nlRenderStats(); nlToast('Subscriber activated.', 'success'); }
}

function nlDeactivateSub(id) {
  const subs = nlGetSubscribers();
  const sub  = subs.find(s => s.id === id);
  if (sub) { sub.status = 'unsubscribed'; nlSaveSubscribers(subs); nlRenderSubscriberTable(); nlRenderStats(); nlToast('Subscriber deactivated.', 'info'); }
}

function nlDeleteSub(id) {
  if (!confirm('Delete this subscriber?')) return;
  const subs = nlGetSubscribers().filter(s => s.id !== id);
  nlSaveSubscribers(subs);
  _nlSelected.delete(id);
  nlRenderSubscriberTable();
  nlRenderStats();
  nlToast('Subscriber deleted.', 'success');
}

/* ── Bulk actions ── */
function nlBulkActivate() {
  const subs = nlGetSubscribers();
  subs.forEach(s => { if (_nlSelected.has(s.id)) s.status = 'active'; });
  nlSaveSubscribers(subs);
  _nlSelected.clear();
  nlRenderSubscriberTable();
  nlRenderStats();
  nlToast('Selected subscribers activated.', 'success');
}

function nlBulkDeactivate() {
  const subs = nlGetSubscribers();
  subs.forEach(s => { if (_nlSelected.has(s.id)) s.status = 'unsubscribed'; });
  nlSaveSubscribers(subs);
  _nlSelected.clear();
  nlRenderSubscriberTable();
  nlRenderStats();
  nlToast('Selected subscribers deactivated.', 'info');
}

function nlBulkDelete() {
  if (!confirm(`Delete ${_nlSelected.size} subscriber(s)?`)) return;
  const ids  = new Set(_nlSelected);
  const subs = nlGetSubscribers().filter(s => !ids.has(s.id));
  nlSaveSubscribers(subs);
  _nlSelected.clear();
  nlRenderSubscriberTable();
  nlRenderStats();
  nlToast('Selected subscribers deleted.', 'success');
}

/* ── CSV Export ── */
function nlExportCSV() {
  const subs = nlGetFilteredSubs();
  if (subs.length === 0) { nlToast('No subscribers to export.', 'warning'); return; }

  const header = ['ID', 'Name', 'Email', 'Status', 'Subscribe Date', 'Preferences', 'Frequency'];
  const rows   = subs.map(s => [
    s.id,
    `"${s.name.replace(/"/g, '""')}"`,
    s.email,
    s.status,
    s.date,
    `"${(s.prefs || []).join('; ')}"`,
    s.freq || '',
  ]);

  const csv     = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `globexsky_subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  nlToast('CSV exported successfully.', 'success');
}

/* ── Campaign history ── */
function nlRenderCampaignHistory() {
  const tbody = document.getElementById('nlCampaignTableBody');
  if (!tbody) return;
  const campaigns = nlGetCampaigns();

  tbody.innerHTML = campaigns.map(c => {
    const openPct  = c.recipients ? Math.round(c.opens  / c.recipients * 100) : 0;
    const clickPct = c.recipients ? Math.round(c.clicks / c.recipients * 100) : 0;
    const statusMap = {
      sent:  ['nl-badge-active',   'Sent'],
      draft: ['nl-badge-pending',  'Draft'],
      sched: ['nl-badge-unsubscribed', 'Scheduled'],
    };
    const [cls, label] = statusMap[c.status] || ['nl-badge-unsubscribed', c.status];
    return `
      <tr>
        <td style="max-width:260px">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="nl-campaign-row-icon ${c.status}"><i class="fas fa-${c.status === 'sent' ? 'paper-plane' : c.status === 'draft' ? 'file-alt' : 'clock'}"></i></div>
            <span style="font-weight:500;font-size:.875rem">${nlEscHtml(c.subject)}</span>
          </div>
        </td>
        <td>${c.sent ? nlEscHtml(nlFormatDate(c.sent)) : '—'}</td>
        <td>${c.recipients.toLocaleString()}</td>
        <td>${c.opens.toLocaleString()} <span style="color:#94a3b8;font-size:.78rem">(${openPct}%)</span></td>
        <td>${c.clicks.toLocaleString()} <span style="color:#94a3b8;font-size:.78rem">(${clickPct}%)</span></td>
        <td><span class="nl-badge ${cls}">${nlEscHtml(label)}</span></td>
        <td>
          <div style="display:flex;gap:6px">
            ${c.status === 'draft'
              ? `<button class="nl-btn nl-btn-sm nl-btn-primary" onclick="nlOpenComposer('${nlEscHtml(c.id)}')"><i class="fas fa-edit"></i> Edit</button>`
              : `<button class="nl-btn nl-btn-sm nl-btn-outline"><i class="fas fa-eye"></i> View</button>`
            }
            <button class="nl-btn nl-btn-sm" style="background:#fee2e2;color:#ef4444;border:none" onclick="nlDeleteCampaign('${nlEscHtml(c.id)}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8">No campaigns yet.</td></tr>`;
}

function nlDeleteCampaign(id) {
  if (!confirm('Delete this campaign?')) return;
  const campaigns = nlGetCampaigns().filter(c => c.id !== id);
  nlSaveCampaigns(campaigns);
  nlRenderCampaignHistory();
  nlToast('Campaign deleted.', 'success');
}

function nlOpenComposer(campaignId) {
  nlSwitchAdminTab('compose');
  if (campaignId) {
    const campaigns = nlGetCampaigns();
    const c = campaigns.find(x => x.id === campaignId);
    if (c) {
      const subjInput = document.getElementById('nlComposeSubject');
      if (subjInput) subjInput.value = c.subject;
    }
  }
}

/* ── Analytics ── */
function nlRenderAnalytics() {
  const campaigns  = nlGetCampaigns().filter(c => c.status === 'sent');
  const totalSent  = campaigns.reduce((a, c) => a + c.recipients, 0);
  const totalOpens = campaigns.reduce((a, c) => a + c.opens, 0);
  const totalClicks= campaigns.reduce((a, c) => a + c.clicks, 0);

  const openRate  = totalSent ? Math.round(totalOpens  / totalSent * 100) : 0;
  const clickRate = totalSent ? Math.round(totalClicks / totalSent * 100) : 0;
  const unsubRate = 3; // mock

  const bars = [
    { label: 'Open Rate',  pct: openRate,  cls: 'blue' },
    { label: 'Click Rate', pct: clickRate, cls: 'green' },
    { label: 'Unsub Rate', pct: unsubRate, cls: 'orange' },
  ];

  const container = document.getElementById('nlAnalyticsRows');
  if (!container) return;

  container.innerHTML = bars.map(b => `
    <div class="nl-analytics-item">
      <span class="nl-analytics-label">${nlEscHtml(b.label)}</span>
      <div class="nl-analytics-bar-wrap">
        <div class="nl-analytics-bar ${b.cls}" style="width:${b.pct}%"></div>
      </div>
      <span class="nl-analytics-pct">${b.pct}%</span>
    </div>`).join('');

  nlSetText('nlAnalyticsSentTotal',  totalSent.toLocaleString());
  nlSetText('nlAnalyticsOpenRate',   openRate + '%');
  nlSetText('nlAnalyticsClickRate',  clickRate + '%');
  nlSetText('nlAnalyticsUnsubRate',  unsubRate + '%');
}

/* ── Newsletter composer ── */
function nlUpdatePreview() {
  const body     = document.getElementById('nlComposeBody');
  const preview  = document.getElementById('nlPreviewFrame');
  if (!body || !preview) return;
  preview.innerHTML = body.value || '<p style="color:#94a3b8;text-align:center;padding:40px 0">Preview will appear here…</p>';
}

function nlLoadTemplate(key) {
  const body = document.getElementById('nlComposeBody');
  if (!body) return;
  const html = NL_TEMPLATES[key] || '';
  body.value = html;
  nlUpdatePreview();
}

function nlSendNewsletter() {
  const subj   = document.getElementById('nlComposeSubject')?.value.trim();
  const body   = document.getElementById('nlComposeBody')?.value.trim();
  const recip  = document.getElementById('nlComposeRecipients')?.value;

  if (!subj) { nlToast('Please enter a subject line.', 'warning'); return; }
  if (!body) { nlToast('Please write the newsletter body.', 'warning'); return; }

  const subs     = nlGetSubscribers();
  const active   = subs.filter(s => s.status === 'active').length;
  const sendTo   = recip === 'all' ? subs.length : active;

  const campaigns = nlGetCampaigns();
  campaigns.unshift({
    id:         nlGenerateId('c'),
    subject:    subj,
    sent:       new Date().toISOString().slice(0, 10),
    recipients: sendTo,
    opens:      Math.floor(sendTo * NL_MOCK_OPEN_BASE  + Math.random() * sendTo * NL_MOCK_OPEN_RANGE),
    clicks:     Math.floor(sendTo * NL_MOCK_CLICK_BASE + Math.random() * sendTo * NL_MOCK_CLICK_RANGE),
    status:     'sent',
  });
  nlSaveCampaigns(campaigns);

  // Clear composer
  const subjectEl = document.getElementById('nlComposeSubject');
  const bodyEl    = document.getElementById('nlComposeBody');
  if (subjectEl) subjectEl.value = '';
  if (bodyEl)    bodyEl.value    = '';
  nlUpdatePreview();

  nlRenderCampaignHistory();
  nlRenderAnalytics();
  nlRenderStats();

  nlToast(`Newsletter sent to ${sendTo.toLocaleString()} subscriber(s)!`, 'success');
  nlSwitchAdminTab('campaigns');
}

function nlSaveDraft() {
  const subj  = document.getElementById('nlComposeSubject')?.value.trim();
  const body  = document.getElementById('nlComposeBody')?.value.trim();
  if (!subj)  { nlToast('Please enter a subject before saving.', 'warning'); return; }

  const campaigns = nlGetCampaigns();
  campaigns.unshift({
    id:         nlGenerateId('c'),
    subject:    subj,
    sent:       null,
    recipients: 0,
    opens:      0,
    clicks:     0,
    status:     'draft',
  });
  nlSaveCampaigns(campaigns);
  nlRenderCampaignHistory();
  nlToast('Draft saved.', 'info');
}

/* ── Admin tab switching ── */
function nlSwitchAdminTab(tabKey) {
  _nlAdminTab = tabKey;
  document.querySelectorAll('.nl-admin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });
  document.querySelectorAll('.nl-admin-pane').forEach(pane => {
    pane.style.display = pane.id === `nlPane_${tabKey}` ? '' : 'none';
  });
}

/* ── Bind admin events ── */
function nlBindAdminEvents() {
  /* Tab buttons */
  document.querySelectorAll('.nl-admin-tab').forEach(btn => {
    btn.addEventListener('click', () => nlSwitchAdminTab(btn.dataset.tab));
  });

  /* Search */
  const searchInput = document.getElementById('nlSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      _nlFilter.search = searchInput.value;
      _nlPage = 1;
      nlRenderSubscriberTable();
    });
  }

  /* Status filter */
  const statusFilter = document.getElementById('nlStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      _nlFilter.status = statusFilter.value;
      _nlPage = 1;
      nlRenderSubscriberTable();
    });
  }

  /* Date filter */
  const dateFilter = document.getElementById('nlDateFilter');
  if (dateFilter) {
    dateFilter.addEventListener('change', () => {
      _nlFilter.date = dateFilter.value;
      _nlPage = 1;
      nlRenderSubscriberTable();
    });
  }

  /* Export CSV */
  const exportBtn = document.getElementById('nlExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', nlExportCSV);

  /* Bulk action buttons */
  const bulkActivate   = document.getElementById('nlBulkActivate');
  const bulkDeactivate = document.getElementById('nlBulkDeactivate');
  const bulkDelete     = document.getElementById('nlBulkDelete');
  if (bulkActivate)   bulkActivate.addEventListener('click',   nlBulkActivate);
  if (bulkDeactivate) bulkDeactivate.addEventListener('click', nlBulkDeactivate);
  if (bulkDelete)     bulkDelete.addEventListener('click',     nlBulkDelete);

  /* Composer body live preview */
  const composeBody = document.getElementById('nlComposeBody');
  if (composeBody) composeBody.addEventListener('input', nlUpdatePreview);

  /* Template selector */
  const tplSelect = document.getElementById('nlTemplateSelect');
  if (tplSelect) tplSelect.addEventListener('change', () => nlLoadTemplate(tplSelect.value));

  /* Send / Save draft buttons */
  const sendBtn  = document.getElementById('nlSendBtn');
  const draftBtn = document.getElementById('nlSaveDraftBtn');
  if (sendBtn)  sendBtn.addEventListener('click',  nlSendNewsletter);
  if (draftBtn) draftBtn.addEventListener('click', nlSaveDraft);

  /* Init first pane */
  nlSwitchAdminTab('subscribers');
}

/* ═══════════════════════════════════════════════════════════
   AUTO-INIT
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('nlSubForm') || document.getElementById('nlUnsubForm')) {
    nlInitSubscribePage();
  }
  if (document.getElementById('nlSubTableBody')) {
    nlInitAdminPage();
  }
});

/* expose globals for inline onclick handlers */
window.nlActivateSub    = nlActivateSub;
window.nlDeactivateSub  = nlDeactivateSub;
window.nlDeleteSub      = nlDeleteSub;
window.nlDeleteCampaign = nlDeleteCampaign;
window.nlOpenComposer   = nlOpenComposer;
window.nlSwitchAdminTab = nlSwitchAdminTab;
window.nlExportCSV      = nlExportCSV;
window.nlBulkActivate   = nlBulkActivate;
window.nlBulkDeactivate = nlBulkDeactivate;
window.nlBulkDelete     = nlBulkDelete;
window.nlSendNewsletter = nlSendNewsletter;
window.nlSaveDraft      = nlSaveDraft;
window.nlLoadTemplate   = nlLoadTemplate;
window.nlUpdatePreview  = nlUpdatePreview;
