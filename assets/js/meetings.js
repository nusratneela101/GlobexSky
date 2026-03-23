/**
 * Globex Sky - meetings.js
 * Meetings: schedule meeting with calendar/date picker, meeting list, video room.
 */

const MeetingsAPI = {
  BASE: '/api/v1/meetings',
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
   MEETINGS LIST
───────────────────────────────────────────── */
async function initMeetingsList() {
  const container  = document.querySelector('.meetings-list, [data-meetings-list]');
  const tabBtns    = document.querySelectorAll('[data-meeting-tab]');
  if (!container) return;

  let all = [];

  const render = (filter) => {
    const now  = Date.now();
    let list   = [...all];
    if (filter === 'upcoming') list = list.filter((m) => new Date(m.scheduled_at) > now);
    if (filter === 'past')     list = list.filter((m) => new Date(m.scheduled_at) <= now);

    container.innerHTML = list.length
      ? list.map((m) => {
          const dt     = new Date(m.scheduled_at);
          const past   = dt < new Date();
          return `
          <div class="card meeting-card mb-3">
            <div class="card-body">
              <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
                <div>
                  <h6 class="mb-1">${m.title}</h6>
                  <p class="text-muted small mb-1">
                    <i class="fas fa-user me-1"></i>${m.attendee || m.with || '—'}
                    &nbsp;|&nbsp;
                    <i class="fas fa-calendar me-1"></i>${dt.toLocaleDateString()}
                    &nbsp;
                    <i class="fas fa-clock me-1"></i>${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  ${m.description ? `<p class="text-muted small">${m.description}</p>` : ''}
                </div>
                <div class="d-flex gap-2">
                  ${!past
                    ? `<a href="/pages/meetings/room.html?room=${m.room_id || m.id}" class="btn btn-primary btn-sm">
                        <i class="fas fa-video me-1"></i>Join
                       </a>`
                    : '<span class="badge bg-secondary">Ended</span>'
                  }
                  <button class="btn btn-outline-danger btn-sm" data-cancel-meeting="${m.id}">Cancel</button>
                </div>
              </div>
            </div>
          </div>`;
        }).join('')
      : '<p class="text-muted text-center py-4">No meetings found.</p>';

    container.querySelectorAll('[data-cancel-meeting]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this meeting?')) return;
        try {
          await MeetingsAPI.del(`/${btn.dataset.cancelMeeting}`);
          if (typeof showToast === 'function') showToast('Meeting cancelled.', 'info');
          loadMeetings();
        } catch (_) {
          if (typeof showToast === 'function') showToast('Failed to cancel meeting.', 'error');
        }
      });
    });
  };

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.meetingTab);
    });
  });

  const loadMeetings = async () => {
    try {
      const data = await MeetingsAPI.get('');
      all = data.data || data || [];
      render('upcoming');
    } catch (_) {
      container.innerHTML = '<p class="text-danger">Failed to load meetings.</p>';
    }
  };

  await loadMeetings();
}

/* ─────────────────────────────────────────────
   SCHEDULE MEETING
───────────────────────────────────────────── */
function initScheduleMeeting() {
  const form = document.querySelector('#scheduleMeetingForm, [data-schedule-meeting]');
  if (!form) return;

  // Pre-fill from URL (e.g., when scheduling with a supplier)
  const params = new URLSearchParams(window.location.search);
  const withUser = params.get('with');
  const withName = params.get('name');
  if (withUser) {
    const field = form.querySelector('[name="attendee_id"]');
    if (field) field.value = withUser;
  }
  if (withName) {
    const nameDisplay = document.querySelector('[data-meeting-with]');
    if (nameDisplay) nameDisplay.textContent = withName;
  }

  // Set minimum date to today
  const dateInput = form.querySelector('[name="date"], [type="date"]');
  if (dateInput) {
    dateInput.min = new Date().toISOString().slice(0, 10);
  }

  // Duration auto-calculate end time
  const startTime = form.querySelector('[name="start_time"]');
  const duration  = form.querySelector('[name="duration"]');
  const endTime   = form.querySelector('[name="end_time"]');

  const calcEndTime = () => {
    if (!startTime?.value || !duration?.value || !endTime) return;
    const [h, m] = startTime.value.split(':').map(Number);
    const mins   = h * 60 + m + parseInt(duration.value, 10);
    endTime.value = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  };
  startTime?.addEventListener('change', calcEndTime);
  duration?.addEventListener('change', calcEndTime);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Scheduling…'; }

    try {
      const data    = Object.fromEntries(new FormData(form));
      const json    = await MeetingsAPI.post('', data);
      const meeting = json.data || json;

      if (typeof showToast === 'function') showToast('Meeting scheduled! Invites sent to attendees.', 'success');
      form.reset();

      // Redirect to room if immediate
      if (data.type === 'now' || params.get('immediate')) {
        window.location.href = `/pages/meetings/room.html?room=${meeting.room_id || meeting.id}`;
      } else {
        const successMsg = document.querySelector('[data-schedule-success]');
        if (successMsg) {
          const d = new Date(`${data.date}T${data.start_time}`);
          successMsg.innerHTML = `<div class="alert alert-success mt-3"><i class="fas fa-check-circle me-2"></i>Meeting scheduled for <strong>${d.toLocaleString()}</strong>. <a href="/pages/meetings/index.html">View meetings</a></div>`;
        }
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Failed to schedule meeting.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   MEETING ROOM
───────────────────────────────────────────── */
function initMeetingRoom() {
  const roomEl = document.querySelector('.meeting-room-container, [data-meeting-room]');
  if (!roomEl) return;

  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room') || roomEl.dataset.roomId;
  const user   = JSON.parse(localStorage.getItem('globexUser') || '{}');
  const name   = user.name || user.full_name || 'Guest';

  if (!roomId) {
    roomEl.innerHTML = '<div class="alert alert-warning">No room ID provided.</div>';
    return;
  }

  // Try Jitsi
  if (typeof JitsiMeetExternalAPI !== 'undefined') {
    const jitsiOpts = {
      roomName: `globexsky-${roomId}`,
      parentNode: roomEl,
      userInfo: { displayName: name },
      configOverwrite: { startWithAudioMuted: true },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: ['microphone', 'camera', 'chat', 'hangup', 'fullscreen', 'tileview'],
      },
    };
    try {
      const api = new JitsiMeetExternalAPI('meet.jit.si', jitsiOpts);
      api.addEventListener('readyToClose', () => { window.location.href = '/pages/meetings/index.html'; });
      return;
    } catch (_) {}
  }

  // Fallback
  roomEl.innerHTML = `
    <div class="text-center py-5">
      <i class="fas fa-video text-primary" style="font-size:4rem"></i>
      <h4 class="mt-3">Meeting Room: ${roomId}</h4>
      <p class="text-muted">Your video conferencing library hasn't loaded yet.</p>
      <div class="d-flex justify-content-center gap-3 flex-wrap">
        <a href="https://meet.jit.si/globexsky-${roomId}" target="_blank" rel="noopener" class="btn btn-primary">
          <i class="fas fa-external-link-alt me-2"></i>Open in Jitsi Meet
        </a>
        <a href="/pages/meetings/index.html" class="btn btn-outline-secondary">Back to Meetings</a>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function validateForm(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    field.classList.remove('is-invalid');
    if (!field.value.trim()) { field.classList.add('is-invalid'); valid = false; }
  });
  if (!valid && typeof showToast === 'function') showToast('Please fill in all required fields.', 'error');
  return valid;
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initMeetingsList();
  initScheduleMeeting();
  initMeetingRoom();
});
