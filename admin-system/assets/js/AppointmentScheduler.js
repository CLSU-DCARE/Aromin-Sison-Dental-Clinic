/**
 * AppointmentScheduler – Week/Day/List appointment grid and data loader.
 *
 * Encapsulates the appointmentState, date utilities, grid rendering, and API fetching.
 * Replaces appointmentLocalDate, appointmentIsoDate, appointmentMonday, appointmentAddDays,
 * appointmentTimeLabel, appointmentDateLabel, appointmentStatusTag, appointmentActionControls,
 * renderAppointmentSchedule, renderAppointmentRequests, loadAppointmentWeek, renderApptMode.
 *
 * Usage:
 *   const scheduler = new AppointmentScheduler({ apiBase: '../backend/api/appointments' });
 *   scheduler.init();
 *   scheduler.loadWeek();
 */
/* global escapeHtml, nameCell */
window.AppointmentScheduler = class AppointmentScheduler {
  constructor ({ apiBase = '../backend/api/appointments', onLoaded = null } = {}) {
    this.weekEndpoint  = `${apiBase}/week.php`;
    this.state = { start: this._monday(new Date()), mode: 'Week', appointments: [], requests: [], loading: false };
    this.onLoaded = onLoaded;
  }

  /* ------------------------------------------------------------------
   *  Public API
   * ----------------------------------------------------------------*/

  init () {
    this._render();
    this._bindNav();
  }

  async loadWeek () {
    if (window.staffLiveSync) return window.staffLiveSync.refetch();
    if (this.state.loading) return;
    this.state.loading = true;

    const refresh  = document.getElementById('refreshAppointmentsBtn');
    const errorNote = document.getElementById('appointmentLoadError');
    const tbody     = document.getElementById('appointmentRequestsBody');

    if (refresh) { refresh.disabled = true; refresh.classList.add('is-loading'); }
    if (errorNote) errorNote.hidden = true;
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Loading booking requests…</td></tr>';

    try {
      const data = await this._api(`${this.weekEndpoint}?start=${encodeURIComponent(this.state.start)}`);
      // A real, working endpoint always returns these two arrays (even empty
      // ones for a genuinely quiet week). If they're missing, the endpoint
      // isn't actually implemented yet (e.g. a dev server just serving the
      // raw .php file as text) - treat that the same as a failed request.
      if (!Array.isArray(data.appointments) || !Array.isArray(data.requests)) {
        throw new Error('Appointments endpoint did not return the expected data.');
      }
      this.state.appointments = data.appointments;
      this.state.requests     = data.requests;
      this.state.error = null;
      this._render();
    } catch (error) {
      this.state.error = error.message;
      this._render();
      if (errorNote) { errorNote.textContent = error.message; errorNote.hidden = false; errorNote.classList.add('err'); errorNote.classList.remove('ok'); }
    } finally {
      this.state.loading = false;
      if (refresh) { refresh.disabled = false; refresh.classList.remove('is-loading'); }
    }

    if (this.onLoaded) this.onLoaded(this.state);
  }

  setMode (mode) {
    this.state.mode = mode;
    this._renderSchedule();
  }

  applySnapshot(data) {
    this.state.appointments = data.week.appointments;
    this.state.requests = data.week.requests;
    this.state.pending = data.pending;
    this.state.error = null;
    this._render();
    if (this.onLoaded) this.onLoaded(this.state);
  }

  /* Expose helpers for AppointmentActions */
  getRequest (requestId) {
    return this.state.requests.find(item => Number(item.request_id) === Number(requestId)) || null;
  }

  getAppointment (appointmentId) {
    return this.state.appointments.concat(this.state.pending || []).find(item => Number(item.appointment_id) === Number(appointmentId)) || null;
  }

  static isoDate (value) { return new AppointmentScheduler()._isoDate(value); }

  /* ------------------------------------------------------------------
   *  Private – date utilities
   * ----------------------------------------------------------------*/

  _localDate (value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const parts = String(value).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  _isoDate (value) {
    const d = this._localDate(value);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  _monday (value) {
    const d = this._localDate(value);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return this._isoDate(d);
  }

  _addDays (value, amount) {
    const d = this._localDate(value);
    d.setDate(d.getDate() + amount);
    return this._isoDate(d);
  }

  _timeLabel (value) {
    const parts = String(value || '00:00').split(':').map(Number);
    return `${parts[0] % 12 || 12}:${String(parts[1] || 0).padStart(2, '0')} ${parts[0] >= 12 ? 'PM' : 'AM'}`;
  }

  _dateLabel (value, options) {
    return this._localDate(value).toLocaleDateString('en-US', options || { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ------------------------------------------------------------------
   *  Private – rendering
   * ----------------------------------------------------------------*/

  _statusTag (status) {
    const normalized = String(status || 'pending').toLowerCase();
    const color  = ['confirmed', 'completed'].includes(normalized) ? 'green' : ['pending', 'rescheduled'].includes(normalized) ? 'amber' : 'red';
    const label  = normalized === 'no_show' ? 'No-Show' : normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return `<span class="tag tag-${color}">${escapeHtml(label)}</span>`;
  }

  _actionControls (item, compact = false) {
    if (!['pending', 'confirmed'].includes(String(item.status).toLowerCase())) return '';
    const id   = Number(item.appointment_id);
    const size = compact ? ' appointment-card-actions' : ' appointment-request-actions';
    return `<div class="${size.trim()}">` +
      (item.status === 'pending' ? `<button type="button" class="btn btn-sm btn-approve" data-appointment-action="approve" data-appointment-id="${id}">Approve</button><button type="button" class="btn btn-sm btn-reject" data-appointment-action="reject" data-appointment-id="${id}">Reject</button>` : '') +
      (item.status === 'confirmed' ? `<button type="button" class="btn btn-sm btn-approve" data-appointment-action="complete" data-appointment-id="${id}">Complete</button><button type="button" class="btn btn-sm btn-outline" data-appointment-action="no_show" data-appointment-id="${id}">No-show</button>` : '') +
      `<button type="button" class="btn btn-sm btn-outline" data-appointment-action="reschedule" data-appointment-id="${id}">Reschedule</button>` +
      `<button type="button" class="btn btn-sm btn-reject" data-appointment-action="cancel" data-appointment-id="${id}">Cancel</button>` +
      `</div>`;
  }

  _render () {
    this._renderSchedule();
    this._renderRequests();
  }

  _renderSchedule () {
    const grid     = document.getElementById('apptWeekGrid');
    const listView = document.getElementById('apptListView');
    const tbody    = document.getElementById('apptListBody');
    const tag      = document.getElementById('apptModeTag');
    if (!grid || !listView || !tbody || !tag) return;

    const days = Array.from({ length: 7 }, (_, i) => this._addDays(this.state.start, i));
    const range = `${this._dateLabel(days[0], { month: 'short', day: 'numeric' })} – ${this._dateLabel(days[6], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    tag.textContent = range + (this.state.mode === 'Week' ? '' : ` · ${this.state.mode} view`);

    if (this.state.mode === 'List') {
      grid.hidden     = true;
      listView.hidden = false;
      tbody.innerHTML = this.state.appointments.length
        ? this.state.appointments.map(item =>
          `<tr><td>${escapeHtml(this._dateLabel(item.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' }))}</td>` +
          `<td>${escapeHtml(this._timeLabel(item.scheduled_time))}</td>` +
          `<td>${escapeHtml(item.patient_name)}</td>` +
          `<td>${escapeHtml(item.service_type)}</td>` +
          `<td>${this._statusTag(item.status)}</td>` +
          `<td>${this._actionControls(item)}</td></tr>`
        ).join('')
        : '<tr><td colspan="6" class="empty-cell">No appointments scheduled for this week.</td></tr>';
      return;
    }

    grid.hidden     = false;
    listView.hidden = true;

    const today       = this._isoDate(new Date());
    const visibleDays = this.state.mode === 'Day' ? [days.includes(today) ? today : days[0]] : days;
    grid.style.setProperty('--appointment-day-count', visibleDays.length);

    const times = [...new Set(this.state.appointments.map(item => String(item.scheduled_time).slice(0, 5)))].sort();
    if (!times.length) times.push('09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00');

    const header = ['']
      .concat(visibleDays.map(day => this._dateLabel(day, { weekday: 'short', month: 'short', day: 'numeric' })))
      .map((label, index) => `<div class="cell${index ? ' head' : ''}">${escapeHtml(label)}</div>`)
      .join('');

    const cells = times.map(time => {
      const row = visibleDays.map(day => {
        const items = this.state.appointments.filter(
          appt => appt.scheduled_date === day && String(appt.scheduled_time).slice(0, 5) === time
        );
        return items.length
          ? '<div class="cell">' + items.map(item => `<div class="appt-block${String(item.status).toLowerCase() === 'completed' ? ' appt-completed' : ''}"><strong>${escapeHtml(item.patient_name)}</strong>` +
            `<span class="t">${escapeHtml(item.service_type)} · ${escapeHtml(item.status)}</span>` +
            `${String(item.status).toLowerCase() === 'completed' ? '<span class="appt-status">Completed</span>' : ''}` +
            `${this._actionControls(item, true)}</div>`).join('') + '</div>'
          : '<div class="cell"></div>';
      }).join('');
      return `<div class="cell time">${escapeHtml(this._timeLabel(time))}</div>${row}`;
    }).join('');

    grid.innerHTML = header + cells;
  }

  _renderRequests () {
    const tbody = document.getElementById('appointmentRequestsBody');
    const count = document.getElementById('appointmentRequestCount');
    if (!tbody || !count) return;

    count.textContent = `${this.state.requests.length + (this.state.pending || []).length} pending`;

    tbody.innerHTML = this.state.requests.length
      ? this.state.requests.map(request => {
        const initials = String(request.patient_name).split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
        return `<tr>` +
          `<td>${nameCell(initials, request.patient_name, request.email || '')}</td>` +
          `<td>${escapeHtml(request.service_type)}</td>` +
          `<td><strong>${escapeHtml(this._dateLabel(request.scheduled_date))}</strong>` +
          `<div class="request-time">${escapeHtml(this._timeLabel(request.scheduled_time))}</div></td>` +
          `<td>${escapeHtml(request.contact_number || '-')}</td>` +
          `<td>${this._statusTag(request.status)}</td>` +
          `<td><div class="appointment-request-actions">` +
          `<button type="button" class="btn btn-sm btn-approve" data-request-action="approve" data-request-id="${Number(request.request_id)}">Approve</button>` +
          `<button type="button" class="btn btn-sm btn-outline" data-request-action="reschedule" data-request-id="${Number(request.request_id)}">Reschedule</button>` +
          `<button type="button" class="btn btn-sm btn-reject" data-request-action="reject" data-request-id="${Number(request.request_id)}">Reject</button>` +
          `<button type="button" class="btn btn-sm btn-reject" data-request-action="cancel" data-request-id="${Number(request.request_id)}">Cancel</button>` +
          `</div></td></tr>`;
      }).join('')
      : '<tr><td colspan="6" class="empty-cell">No pending booking requests for this week.</td></tr>';
    if (this.state.pending?.length) {
      const rows = this.state.pending.map(a => `<tr><td>${escapeHtml(a.patient_name)}</td><td>${escapeHtml(a.service_type)}</td><td>${escapeHtml(a.scheduled_date)} ${escapeHtml(String(a.scheduled_time).slice(0,5))}</td><td>Patient portal</td><td>${this._statusTag(a.status)}</td><td>${this._actionControls(a)}</td></tr>`).join('');
      tbody.innerHTML = (this.state.requests.length ? tbody.innerHTML : '') + rows;
    }
  }

  /* ------------------------------------------------------------------
   *  Private – navigation
   * ----------------------------------------------------------------*/

  _bindNav () {
    document.getElementById('refreshAppointmentsBtn')?.addEventListener('click', () => this.loadWeek());
    document.getElementById('apptPrevWeek')?.addEventListener('click', () => { this.state.start = this._addDays(this.state.start, -7); this.loadWeek(); });
    document.getElementById('apptCurrentWeek')?.addEventListener('click', () => { this.state.start = this._monday(new Date()); this.loadWeek(); });
    document.getElementById('apptNextWeek')?.addEventListener('click', () => { this.state.start = this._addDays(this.state.start, 7); this.loadWeek(); });

    document.getElementById('apptWeekGrid')?.addEventListener('click', e => this._onGridClick(e));
    document.getElementById('apptListBody')?.addEventListener('click', e => this._onGridClick(e));
    document.getElementById('appointmentRequestsBody')?.addEventListener('click', e => this._onGridClick(e));
  }

  /* Delegate grid clicks to AppointmentActions if registered */
  _onGridClick (event) {
    if (window.__appointmentActions) window.__appointmentActions.handleGridClick(event);
  }

  /* ------------------------------------------------------------------
   *  Private – API (delegated to shared apiFetch)
   * ----------------------------------------------------------------*/

  async _api (url, options = {}) {
    return apiFetch(url, options);
  }
};
