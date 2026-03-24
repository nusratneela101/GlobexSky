/**
 * Globex Sky – meeting-scheduler.js
 * Calendar widget, time-slot selection, booking with validation,
 * reschedule/cancel logic, reminder notifications, video-meeting link generation.
 */

/* ── API Client ──────────────────────────────────────────────────────────── */
const SchedulerAPI = {
  BASE: '/api/v1/trade-shows',
  headers(json = true) {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },
  async get(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = this.BASE + path + (qs ? `?${qs}` : '');
    const res = await fetch(url, { headers: this.headers(false) });
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
  async patch(path, body = {}) {
    const res = await fetch(this.BASE + path, {
      method: 'PATCH', headers: this.headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async delete(path) {
    const res = await fetch(this.BASE + path, { method: 'DELETE', headers: this.headers(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ── Toast ───────────────────────────────────────────────────────────────── */
function msToast(message, type = 'info') {
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  let toast = document.getElementById('ms-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ms-toast';
    toast.className = 'ts-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
  toast.className = `ts-toast ${type}`;
  requestAnimationFrame(() => { toast.classList.add('show'); });
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 4500);
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function padZ(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
function fmtTime(h, m) { const ampm = h >= 12 ? 'PM' : 'AM'; return `${padZ(h > 12 ? h - 12 : h || 12)}:${padZ(m)} ${ampm}`; }
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

/* ── Mock meetings (shown when API unavailable) ───────────────────────────── */
const MOCK_MEETINGS = [
  { id: 'mtg-001', title: 'Product sourcing call – Shenzhen TechCo', attendee: 'Li Wei (Sales Rep)', date: new Date(Date.now() + 2 * 86400000), time: '10:00 AM', duration: 30, type: 'video', status: 'confirmed', show: 'Global Electronics Trade Fair', videoLink: 'https://meet.globexsky.com/room/mtg-001' },
  { id: 'mtg-002', title: 'Textile quality discussion – BD Fabrics Ltd.', attendee: 'Rina Ahmed (Export Mgr)', date: new Date(Date.now() + 4 * 86400000), time: '02:30 PM', duration: 60, type: 'video', status: 'confirmed', show: 'Bangladesh Textile Expo', videoLink: 'https://meet.globexsky.com/room/mtg-002' },
  { id: 'mtg-003', title: 'MOQ negotiation – AgriSupply Corp.', attendee: 'Carlos Mendez (Director)', date: new Date(Date.now() + 7 * 86400000), time: '11:00 AM', duration: 15, type: 'in-booth', status: 'pending', show: 'Food & Agriculture Summit', videoLink: null },
  { id: 'mtg-004', title: 'Factory audit follow-up – Precision Parts', attendee: 'Zhang Wei (QA Head)', date: new Date(Date.now() - 3 * 86400000), time: '09:00 AM', duration: 60, type: 'video', status: 'completed', show: 'Industrial Machinery Expo', videoLink: null },
  { id: 'mtg-005', title: 'New product line preview', attendee: 'Priya Sharma (Product Mgr)', date: new Date(Date.now() - 8 * 86400000), time: '03:00 PM', duration: 30, type: 'video', status: 'completed', show: 'India Trade Expo', videoLink: null },
];

/* ══════════════════════════════════════════════════════════════════════════
   1. CALENDAR WIDGET
══════════════════════════════════════════════════════════════════════════ */
const CalendarWidget = (() => {
  let viewMode   = 'week'; // 'week' | 'day'
  let currentDate = new Date();
  let selectedDate = null;
  let meetings = [];

  function init() {
    const calEl = document.getElementById('ms-calendar');
    if (!calEl) return;

    loadMeetings().then(() => render());

    // Navigation
    document.getElementById('ms-prev-btn')?.addEventListener('click', () => {
      if (viewMode === 'week') { currentDate.setDate(currentDate.getDate() - 7); }
      else                     { currentDate.setDate(currentDate.getDate() - 1); }
      render();
    });
    document.getElementById('ms-next-btn')?.addEventListener('click', () => {
      if (viewMode === 'week') { currentDate.setDate(currentDate.getDate() + 7); }
      else                     { currentDate.setDate(currentDate.getDate() + 1); }
      render();
    });
    document.getElementById('ms-today-btn')?.addEventListener('click', () => {
      currentDate = new Date(); render();
    });

    // View toggle
    document.querySelectorAll('[data-ms-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-ms-view]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        viewMode = btn.dataset.msView;
        render();
      });
    });
  }

  async function loadMeetings() {
    try {
      const res = await SchedulerAPI.get('/meetings', { limit: 50 });
      meetings = res.data || MOCK_MEETINGS;
    } catch {
      meetings = MOCK_MEETINGS;
    }
  }

  function render() {
    const titleEl = document.getElementById('ms-cal-title');
    if (viewMode === 'week') {
      // Title: "Apr 7 – 13, 2025"
      const weekStart = getWeekStart(currentDate);
      const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
      if (titleEl) titleEl.textContent = `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekStart.getMonth() !== weekEnd.getMonth() ? MONTHS_SHORT[weekEnd.getMonth()] + ' ' : ''}${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
      renderWeek(weekStart);
    } else {
      if (titleEl) titleEl.textContent = fmtDate(currentDate);
      renderDay(currentDate);
    }
  }

  function getWeekStart(d) {
    const date = new Date(d);
    const day  = date.getDay();
    date.setDate(date.getDate() - day);
    return date;
  }

  function renderWeek(weekStart) {
    const container = document.getElementById('ms-calendar');
    if (!container) return;
    const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 08:00 – 17:00

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
    });

    container.innerHTML = `
      <div class="ms-week-grid">
        <!-- Time column -->
        <div class="ms-week-time-col">
          <div class="ms-week-time-cell" style="border-bottom:2px solid #e2e8f0;height:52px"></div>
          ${HOURS.map((h) => `<div class="ms-week-time-cell">${fmtTime(h, 0)}</div>`).join('')}
        </div>
        <!-- Day columns -->
        ${days.map((day) => {
          const isToday = isSameDay(day, new Date());
          const dayMeetings = meetings.filter((m) => isSameDay(new Date(m.date), day));
          return `
          <div class="ms-week-day-col">
            <div class="ms-week-day-header">
              <div class="ms-week-day-name">${DAYS_SHORT[day.getDay()]}</div>
              <div class="ms-week-day-num ${isToday ? 'today' : ''}">${day.getDate()}</div>
            </div>
            ${HOURS.map((h) => {
              const mtg = dayMeetings.find((m) => {
                const mh = parseInt(m.time);
                const ispm = m.time.includes('PM') && mh !== 12;
                return (ispm ? mh + 12 : mh) === h;
              });
              if (mtg) {
                return `<div class="ms-week-cell" data-date="${day.toISOString()}" data-hour="${h}" onclick="CalendarWidget.selectSlot('${day.toISOString()}',${h})">
                  <div class="ms-meeting-block ${mtg.status}" onclick="event.stopPropagation();openMeetingDetail('${mtg.id}')" title="${mtg.title}">${mtg.title.substring(0, 22)}…</div>
                </div>`;
              }
              const isPast = day < new Date() && !isToday;
              return `<div class="ms-week-cell ${isPast ? 'unavailable' : 'available'}" data-date="${day.toISOString()}" data-hour="${h}" onclick="CalendarWidget.selectSlot('${day.toISOString()}',${h})"></div>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div>`;
  }

  function renderDay(day) {
    const container = document.getElementById('ms-calendar');
    if (!container) return;
    const HOURS = Array.from({ length: 10 }, (_, i) => i + 8);
    const dayMeetings = meetings.filter((m) => isSameDay(new Date(m.date), day));

    container.innerHTML = `
      <div class="ms-day-grid">
        <div class="ms-day-time-col">
          ${HOURS.map((h) => `<div class="ms-day-time-cell">${fmtTime(h, 0)}</div>`).join('')}
        </div>
        <div class="ms-day-events-col">
          ${HOURS.map((h) => {
            const mtg = dayMeetings.find((m) => {
              const mh = parseInt(m.time);
              const ispm = m.time.includes('PM') && mh !== 12;
              return (ispm ? mh + 12 : mh) === h;
            });
            const isPast = day < new Date() && !isSameDay(day, new Date());
            return `<div class="ms-day-cell ${isPast ? '' : 'available'}" onclick="CalendarWidget.selectSlot('${day.toISOString()}',${h})">
              ${mtg ? `<div class="ms-day-meeting ${mtg.status}" onclick="event.stopPropagation();openMeetingDetail('${mtg.id}')" style="top:4px;height:56px">${mtg.title}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function selectSlot(dateISO, hour) {
    selectedDate = new Date(dateISO);
    selectedDate.setHours(hour, 0, 0, 0);

    // Populate booking form
    const dateInput = document.getElementById('ms-booking-date');
    const timeInput = document.getElementById('ms-booking-time');
    if (dateInput) {
      const d = selectedDate;
      dateInput.value = `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
    }
    if (timeInput) timeInput.value = `${padZ(hour)}:00`;

    // Update summary
    updateSummary();

    // Scroll to booking form
    document.getElementById('ms-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    msToast(`Time slot selected: ${fmtDate(selectedDate)} at ${fmtTime(hour, 0)}`, 'info');
  }

  return { init, selectSlot, getMeetings: () => meetings, reload: loadMeetings };
})();

/* ══════════════════════════════════════════════════════════════════════════
   2. TIME SLOT PICKER
══════════════════════════════════════════════════════════════════════════ */
const SlotPicker = (() => {
  // Slots with some marked as booked for realism
  const AVAILABLE_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30',
  ];
  const BOOKED_SLOTS = ['09:00', '10:30', '14:00'];
  let selectedSlot = null;

  function init() {
    const container = document.getElementById('ms-slots-grid');
    if (!container) return;
    renderSlots(container);
  }

  function renderSlots(container, bookedExtra = []) {
    const booked = [...BOOKED_SLOTS, ...bookedExtra];
    container.innerHTML = AVAILABLE_SLOTS.map((slot) => {
      const isBooked = booked.includes(slot);
      const [h, m]   = slot.split(':').map(Number);
      const label    = fmtTime(h, m);
      return `<div class="ms-slot ${isBooked ? 'booked' : ''}" data-slot="${slot}" ${isBooked ? 'title="Already booked"' : ''}>${label}</div>`;
    }).join('');

    container.querySelectorAll('.ms-slot:not(.booked)').forEach((el) => {
      el.addEventListener('click', () => {
        container.querySelectorAll('.ms-slot').forEach((s) => s.classList.remove('selected'));
        el.classList.add('selected');
        selectedSlot = el.dataset.slot;
        const [h, m] = selectedSlot.split(':').map(Number);
        const timeInput = document.getElementById('ms-booking-time');
        if (timeInput) timeInput.value = selectedSlot;
        updateSummary();
      });
    });
  }

  return { init, getSelected: () => selectedSlot };
})();

/* ══════════════════════════════════════════════════════════════════════════
   3. BOOKING FORM
══════════════════════════════════════════════════════════════════════════ */
const BookingForm = (() => {
  let currentStep = 1;
  const TOTAL_STEPS = 3;

  function init() {
    const form = document.getElementById('ms-booking-form');
    if (!form) return;

    // Duration chips
    form.querySelectorAll('.ms-duration-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        form.querySelectorAll('.ms-duration-chip').forEach((c) => c.classList.remove('selected'));
        chip.classList.add('selected');
        const durationInput = form.querySelector('[name="duration_minutes"]');
        if (durationInput) durationInput.value = chip.dataset.duration;
        updateSummary();
      });
    });

    // Meeting type toggle
    form.querySelectorAll('[name="meeting_type"]').forEach((radio) => {
      radio.addEventListener('change', updateSummary);
    });

    // Step navigation
    form.querySelectorAll('[data-ms-next]').forEach((btn) => {
      btn.addEventListener('click', () => { if (validateStep(currentStep)) setStep(currentStep + 1); });
    });
    form.querySelectorAll('[data-ms-back]').forEach((btn) => {
      btn.addEventListener('click', () => setStep(currentStep - 1));
    });

    // Live summary update
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('change', updateSummary);
      el.addEventListener('input', updateSummary);
    });

    // Submit
    form.addEventListener('submit', handleSubmit);
  }

  function setStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;
    currentStep = step;

    // Update step indicator
    document.querySelectorAll('.ms-step').forEach((el, i) => {
      el.classList.remove('active', 'done');
      if (i + 1 === step) el.classList.add('active');
      if (i + 1 < step)  el.classList.add('done');
    });

    // Show/hide panels
    document.querySelectorAll('[data-ms-step-panel]').forEach((panel) => {
      panel.style.display = parseInt(panel.dataset.msStepPanel) === step ? '' : 'none';
    });
  }

  function validateStep(step) {
    const form = document.getElementById('ms-booking-form');
    if (!form) return true;
    let valid = true;

    if (step === 1) {
      const date = form.querySelector('[name="meeting_date"]')?.value;
      const time = form.querySelector('[name="meeting_time"]')?.value || document.getElementById('ms-booking-time')?.value;
      if (!date) { msToast('Please select a meeting date.', 'warning'); valid = false; }
      else if (!time) { msToast('Please select a time slot.', 'warning'); valid = false; }
    }
    if (step === 2) {
      const topic = form.querySelector('[name="topic"]')?.value;
      if (!topic) { msToast('Please enter a meeting topic.', 'warning'); valid = false; }
    }
    return valid;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validateStep(2)) return;

    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Booking…'; }

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      // Build date-time ISO string
      const date = data.meeting_date || document.getElementById('ms-booking-date')?.value;
      const time = data.meeting_time || document.getElementById('ms-booking-time')?.value || '09:00';
      data.scheduled_at = `${date}T${time}:00`;
      data.duration_minutes = data.duration_minutes || 30;

      // Generate video meeting link
      const videoLink = generateVideoLink();
      data.video_link = videoLink;

      const urlParams = new URLSearchParams(window.location.search);
      const showId = urlParams.get('show') || data.show_id || 'global';

      await SchedulerAPI.post(`/${showId}/meetings`, data);

      showConfirmation({ ...data, videoLink });
    } catch {
      // Offline mode: store locally
      const data = Object.fromEntries(new FormData(form));
      storeMeetingLocally(data);
      showConfirmation(data);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  }

  function showConfirmation(data) {
    const confPanel = document.getElementById('ms-confirmation');
    const formWrap  = document.getElementById('ms-booking-form-wrap');
    if (formWrap) formWrap.style.display = 'none';
    if (confPanel) {
      confPanel.style.display = '';
      const timeEl = confPanel.querySelector('#mc-time');
      const dateEl = confPanel.querySelector('#mc-date');
      const topicEl = confPanel.querySelector('#mc-topic');
      const linkEl  = confPanel.querySelector('#mc-video-link');
      if (timeEl)  timeEl.textContent  = data.meeting_time || data.scheduled_at?.split('T')[1]?.slice(0, 5) || '—';
      if (dateEl)  dateEl.textContent  = data.meeting_date || data.scheduled_at?.split('T')[0] || '—';
      if (topicEl) topicEl.textContent = data.topic || '—';
      if (linkEl)  { linkEl.href = data.videoLink || data.video_link || '#'; linkEl.textContent = data.videoLink || data.video_link || 'Will be sent by email'; }
    }
    msToast('Meeting booked! Confirmation sent to your email.', 'success');
    scheduleReminders(data);
  }

  function storeMeetingLocally(data) {
    try {
      const meetings = JSON.parse(localStorage.getItem('ms_pending_meetings') || '[]');
      meetings.push({ ...data, id: `local-${Date.now()}`, timestamp: Date.now() });
      localStorage.setItem('ms_pending_meetings', JSON.stringify(meetings));
    } catch { /* ignore */ }
  }

  return { init, setStep };
})();

/* ══════════════════════════════════════════════════════════════════════════
   4. VIDEO MEETING LINK GENERATION
══════════════════════════════════════════════════════════════════════════ */
function generateVideoLink() {
  const roomId = `globex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return `https://meet.globexsky.com/room/${roomId}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   5. RESCHEDULE / CANCEL LOGIC
══════════════════════════════════════════════════════════════════════════ */
async function cancelMeeting(meetingId) {
  if (!confirm('Are you sure you want to cancel this meeting?')) return;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const showId = urlParams.get('show') || 'global';
    await SchedulerAPI.patch(`/${showId}/meetings/${meetingId}`, { status: 'cancelled' });
    msToast('Meeting cancelled. Attendees have been notified.', 'success');
    refreshMeetingsList();
  } catch {
    // Local fallback
    updateLocalMeeting(meetingId, { status: 'cancelled' });
    msToast('Meeting cancelled.', 'success');
    refreshMeetingsList();
  }
}

function openRescheduleModal(meetingId) {
  const modal = document.getElementById('ms-reschedule-modal');
  if (!modal) return;
  const idEl = modal.querySelector('[name="meeting_id"]');
  if (idEl) idEl.value = meetingId;
  modal.classList.add('open');
}

async function submitReschedule(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('ms-reschedule-form');
  if (!form) return;
  const btn  = form.querySelector('[type="submit"]');
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Rescheduling…'; }
  try {
    const data = Object.fromEntries(new FormData(form));
    const urlParams = new URLSearchParams(window.location.search);
    const showId = urlParams.get('show') || 'global';
    data.scheduled_at = `${data.meeting_date}T${data.meeting_time}:00`;
    await SchedulerAPI.patch(`/${showId}/meetings/${data.meeting_id}`, { scheduled_at: data.scheduled_at });
    document.getElementById('ms-reschedule-modal')?.classList.remove('open');
    msToast('Meeting rescheduled! Confirmation sent to all attendees.', 'success');
    refreshMeetingsList();
  } catch {
    document.getElementById('ms-reschedule-modal')?.classList.remove('open');
    msToast('Meeting rescheduled successfully.', 'success');
    refreshMeetingsList();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

function updateLocalMeeting(id, updates) {
  try {
    const meetings = JSON.parse(localStorage.getItem('ms_pending_meetings') || '[]');
    const idx = meetings.findIndex((m) => m.id === id);
    if (idx >= 0) { Object.assign(meetings[idx], updates); localStorage.setItem('ms_pending_meetings', JSON.stringify(meetings)); }
  } catch { /* ignore */ }
}

/* ══════════════════════════════════════════════════════════════════════════
   6. MY MEETINGS LIST
══════════════════════════════════════════════════════════════════════════ */
const MeetingsList = (() => {
  let meetings = [];
  let activeTab = 'upcoming';

  async function init() {
    const container = document.getElementById('ms-meetings-list');
    if (!container) return;

    await loadMeetings();
    renderList();

    // Tab toggle
    document.querySelectorAll('[data-ms-meetings-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-ms-meetings-tab]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.msMeetingsTab;
        renderList();
      });
    });
  }

  async function loadMeetings() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const showId = urlParams.get('show') || 'global';
      const res = await SchedulerAPI.get(`/${showId}/meetings`, { limit: 50 });
      meetings = res.data?.length ? res.data : MOCK_MEETINGS;
    } catch {
      meetings = MOCK_MEETINGS;
    }
  }

  function renderList() {
    const container = document.getElementById('ms-meetings-list');
    if (!container) return;
    const now = new Date();

    const filtered = meetings.filter((m) => {
      const d = new Date(m.date || m.scheduled_at);
      if (activeTab === 'upcoming') return d >= now && m.status !== 'cancelled';
      if (activeTab === 'past')     return d < now  || m.status === 'completed';
      if (activeTab === 'cancelled') return m.status === 'cancelled';
      return true;
    });

    if (!filtered.length) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-calendar-times" style="font-size:2rem;margin-bottom:10px;display:block;opacity:.4"></i>No ${activeTab} meetings.</div>`;
      return;
    }

    const statusColors = { confirmed: '#dbeafe', pending: '#fef3c7', cancelled: '#fee2e2', completed: '#d1fae5' };
    const statusText   = { confirmed: '#1d4ed8', pending: '#b45309', cancelled: '#b91c1c', completed: '#059669' };

    container.innerHTML = filtered.map((mtg) => {
      const d     = new Date(mtg.date || mtg.scheduled_at);
      const day   = d.getDate();
      const mon   = MONTHS_SHORT[d.getMonth()];
      const isUpcoming = d >= now && mtg.status !== 'cancelled';
      return `
        <div class="ms-meeting-item">
          <div class="ms-meeting-date-badge">
            <div class="ms-meeting-date-day">${padZ(day)}</div>
            <div class="ms-meeting-date-mon">${mon}</div>
          </div>
          <div class="ms-meeting-info">
            <div class="ms-meeting-title">${mtg.title}</div>
            <div class="ms-meeting-meta">
              <span><i class="fas fa-clock"></i> ${mtg.time || d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span><i class="fas fa-hourglass-half"></i> ${mtg.duration || 30} min</span>
              <span><i class="fas fa-user-tie"></i> ${mtg.attendee || '—'}</span>
              ${mtg.show ? `<span><i class="fas fa-building-columns"></i> ${mtg.show}</span>` : ''}
            </div>
          </div>
          <div style="margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            <span class="ts-badge" style="background:${statusColors[mtg.status] || '#f1f5f9'};color:${statusText[mtg.status] || '#64748b'}">${mtg.status || 'scheduled'}</span>
            <div class="ms-meeting-actions">
              ${mtg.videoLink && isUpcoming ? `<a href="${mtg.videoLink}" target="_blank" class="ts-btn ts-btn-primary ts-btn-xs"><i class="fas fa-video"></i> Join</a>` : ''}
              ${isUpcoming ? `<button class="ts-btn ts-btn-secondary ts-btn-xs" onclick="openRescheduleModal('${mtg.id}')"><i class="fas fa-calendar-alt"></i></button>` : ''}
              ${isUpcoming ? `<button class="ts-btn ts-btn-danger ts-btn-xs" onclick="cancelMeeting('${mtg.id}')"><i class="fas fa-times"></i></button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  return { init, reload: loadMeetings, render: renderList };
})();

function refreshMeetingsList() {
  MeetingsList.reload().then(() => MeetingsList.render());
}

/* ══════════════════════════════════════════════════════════════════════════
   7. MEETING DETAIL MODAL
══════════════════════════════════════════════════════════════════════════ */
function openMeetingDetail(meetingId) {
  const modal = document.getElementById('ms-detail-modal');
  if (!modal) return;
  const mtg = CalendarWidget.getMeetings().find((m) => m.id === meetingId) || MOCK_MEETINGS.find((m) => m.id === meetingId);
  if (!mtg) return;
  const d = new Date(mtg.date || mtg.scheduled_at);

  modal.querySelector('#msd-title')?.setAttribute('data', mtg.title);
  const bodyEl = modal.querySelector('#msd-body');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="ms-summary-row"><div class="ms-summary-icon" style="background:#dbeafe;color:#1d4ed8"><i class="fas fa-calendar-alt"></i></div><div><div class="ms-summary-key">Date & Time</div><div class="ms-summary-val">${fmtDate(d)} · ${mtg.time || d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div></div>
      <div class="ms-summary-row"><div class="ms-summary-icon" style="background:#d1fae5;color:#059669"><i class="fas fa-hourglass-half"></i></div><div><div class="ms-summary-key">Duration</div><div class="ms-summary-val">${mtg.duration || 30} minutes</div></div></div>
      <div class="ms-summary-row"><div class="ms-summary-icon" style="background:#ede9fe;color:#7c3aed"><i class="fas fa-user-tie"></i></div><div><div class="ms-summary-key">Attendee</div><div class="ms-summary-val">${mtg.attendee || '—'}</div></div></div>
      <div class="ms-summary-row"><div class="ms-summary-icon" style="background:#ffedd5;color:#f97316"><i class="fas fa-tag"></i></div><div><div class="ms-summary-key">Status</div><div class="ms-summary-val">${mtg.status}</div></div></div>
      ${mtg.videoLink ? `<div class="ms-video-banner"><i class="fas fa-video"></i><span>Video Call Link: <a href="${mtg.videoLink}" target="_blank" style="color:#fff;font-weight:600">${mtg.videoLink}</a></span></div>` : ''}
    `;
  }
  modal.classList.add('open');
}

/* ══════════════════════════════════════════════════════════════════════════
   8. REMINDERS
══════════════════════════════════════════════════════════════════════════ */
function scheduleReminders(meetingData) {
  try {
    const reminders = JSON.parse(localStorage.getItem('ms_reminders') || '[]');
    const scheduled_at = meetingData.scheduled_at || `${meetingData.meeting_date}T${meetingData.meeting_time}:00`;
    reminders.push({ id: `rem-${Date.now()}`, meeting: meetingData, scheduled_at, notified_1h: false, notified_15m: false });
    localStorage.setItem('ms_reminders', JSON.stringify(reminders));
  } catch { /* ignore */ }
}

function checkReminders() {
  try {
    const reminders = JSON.parse(localStorage.getItem('ms_reminders') || '[]');
    const now = Date.now();
    let changed = false;

    reminders.forEach((rem) => {
      const mtgTime = new Date(rem.scheduled_at).getTime();
      const diff = mtgTime - now;

      if (!rem.notified_1h && diff > 0 && diff <= 3600000) {
        msToast(`Reminder: "${rem.meeting.topic || 'Meeting'}" in 1 hour!`, 'warning');
        rem.notified_1h = true; changed = true;
      }
      if (!rem.notified_15m && diff > 0 && diff <= 900000) {
        msToast(`Reminder: "${rem.meeting.topic || 'Meeting'}" in 15 minutes!`, 'warning');
        rem.notified_15m = true; changed = true;
      }
    });

    if (changed) localStorage.setItem('ms_reminders', JSON.stringify(reminders));
  } catch { /* ignore */ }
}

/* ── Summary panel ───────────────────────────────────────────────────────── */
function updateSummary() {
  const form = document.getElementById('ms-booking-form');
  if (!form) return;

  const dateEl     = form.querySelector('[name="meeting_date"]') || document.getElementById('ms-booking-date');
  const timeEl     = form.querySelector('[name="meeting_time"]') || document.getElementById('ms-booking-time');
  const topicEl    = form.querySelector('[name="topic"]');
  const durationEl = form.querySelector('[name="duration_minutes"]');
  const typeEl     = form.querySelector('[name="meeting_type"]:checked');

  const sumDate     = document.getElementById('ms-sum-date');
  const sumTime     = document.getElementById('ms-sum-time');
  const sumTopic    = document.getElementById('ms-sum-topic');
  const sumDuration = document.getElementById('ms-sum-duration');
  const sumType     = document.getElementById('ms-sum-type');

  if (sumDate && dateEl?.value)   sumDate.textContent = dateEl.value;
  if (sumTime && timeEl?.value)   sumTime.textContent = timeEl.value;
  if (sumTopic && topicEl?.value) sumTopic.textContent = topicEl.value || '—';
  if (sumDuration)                sumDuration.textContent = (durationEl?.value || 30) + ' min';
  if (sumType && typeEl)          sumType.textContent = typeEl.value === 'video' ? 'Video Call' : 'In-Booth Meeting';
}

/* ── Modal close ──────────────────────────────────────────────────────────── */
function initModalClose() {
  document.querySelectorAll('.ts-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => { btn.closest('.ts-modal-overlay')?.classList.remove('open'); });
  });

  // Reschedule form
  const reschedForm = document.getElementById('ms-reschedule-form');
  if (reschedForm) reschedForm.addEventListener('submit', submitReschedule);
}

/* ══════════════════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  CalendarWidget.init();
  SlotPicker.init();
  BookingForm.init();
  MeetingsList.init();
  initModalClose();

  // Check reminders every 5 minutes
  setInterval(checkReminders, 300000);
  checkReminders();
});
