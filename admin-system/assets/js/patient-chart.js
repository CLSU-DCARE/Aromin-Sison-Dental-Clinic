(function () {
  'use strict';

  // ---------- Small helpers ----------

  // Make text safe before putting it in the page (stops broken or harmful HTML)
  const esc = value => window.ASDC.HtmlHelpers.escapeHtml(String(value ?? ''));
  // Show a date like "Oct 20, 2026"
  const date = value => value ? window.ASDC.HtmlHelpers.formatDate(value) : 'Date not recorded';
  const $ = id => document.getElementById(id);

  // Turn "2026-10-20" (+ optional "14:30:00") into a real Date.
  // We build it by hand so the date never shifts by a day because of time zones.
  function toDate(dateValue, timeValue) {
    const d = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!d) return null;
    const t = String(timeValue || '').match(/^(\d{1,2}):(\d{2})/);
    return new Date(+d[1], +d[2] - 1, +d[3], t ? +t[1] : 0, t ? +t[2] : 0);
  }

  // "14:30:00" -> "2:30 PM"
  function formatTime(value) {
    const t = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    if (!t) return '';
    const hour = +t[1];
    return `${hour % 12 || 12}:${t[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  }

  // Friendly gap from today: "Today", "In 3 days", "2 weeks ago"
  function relativeDay(target) {
    if (!target) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diff = Math.round((day - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    const abs = Math.abs(diff);
    let text;
    if (abs < 14) text = `${abs} days`;
    else if (abs < 60) text = `${Math.round(abs / 7)} weeks`;
    else if (abs < 700) text = `${Math.round(abs / 30)} months`;
    else text = `${Math.round(abs / 365)} years`;
    return diff > 0 ? `In ${text}` : `${text} ago`;
  }

  // Sort a list by its date. "desc" = newest first.
  function sortByDate(list, getDate, direction) {
    const sign = direction === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => {
      const da = getDate(a), db = getDate(b);
      return ((da ? da.getTime() : 0) - (db ? db.getTime() : 0)) * sign;
    });
  }

  // Appointment status -> a simple group we can filter on
  function statusGroup(appointment) {
    const status = String(appointment.status || '').toLowerCase();
    if (status === 'completed') return 'completed';
    if (/cancel|no[\s_-]?show/.test(status)) return 'cancelled';
    const when = toDate(appointment.scheduled_date, appointment.scheduled_time);
    // Not done and not cancelled: if it is still in the future, it is upcoming
    if (when && when.getTime() >= Date.now()) return 'upcoming';
    return 'other';
  }

  // ---------- Page state (what is being shown right now) ----------
  const state = {
    records: [],
    appointments: [],
    tab: 'records',
    appointmentFilter: 'all'
  };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled / No-show' }
  ];

  // ---------- Messages (errors and tips) ----------

  function showMessage({ title, text, tone = 'error', actions = '' }) {
    const box = $('chartMessage');
    $('chartMessageTitle').textContent = title;
    $('chartMessageText').textContent = text;
    $('chartMessageActions').innerHTML = actions;
    box.className = `chart-message is-${tone}`;
    box.hidden = false;
    // Hide the empty sections so the page does not look half-loaded
    $('chartShell').classList.remove('is-loading');
    $('chartShell').classList.add('has-error');
    $('printChart').hidden = true;
  }

  function hideMessage() {
    $('chartMessage').hidden = true;
    $('chartShell').classList.remove('has-error');
  }

  const retryButton = '<button type="button" class="btn btn-primary btn-sm" data-chart-retry><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Try again</button>';
  const backLink = '<a class="btn btn-secondary btn-sm" href="dashboard.html">Back to Patient Management</a>';

  function loginUrl() {
    return (window.ASDC.Routing && window.ASDC.Routing.getLoginUrl && window.ASDC.Routing.getLoginUrl()) || '../auth/login.html';
  }

  // Pick the right message for each kind of problem
  function showLoadError(status, serverMessage) {
    if (status === 401) {
      showMessage({
        title: 'Your session has expired',
        text: 'For your security, staff sessions end after a while. Sign in again to open this chart.',
        actions: `<a class="btn btn-primary btn-sm" href="${esc(loginUrl())}"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Sign in again</a>`
      });
    } else if (status === 403) {
      showMessage({
        title: 'You do not have access',
        text: 'Your account is not allowed to view patient charts. Ask the clinic admin if you think this is a mistake.',
        actions: backLink
      });
    } else if (status === 404) {
      showMessage({
        title: 'Patient not found',
        text: 'This patient may have been archived or removed. Go back to the list and pick another patient.',
        actions: backLink
      });
    } else if (status === 'network') {
      showMessage({
        title: 'Cannot reach the server',
        text: 'Please check your internet connection and try again.',
        actions: retryButton
      });
    } else {
      showMessage({
        title: 'Could not load this chart',
        text: serverMessage || 'Something went wrong while loading the chart. Please try again.',
        actions: retryButton + backLink
      });
    }
  }

  // ---------- Patient card and summary ----------

  function renderProfile(patient) {
    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Patient';
    const phone = patient.contact_number || '';
    const email = patient.email || '';
    const inactive = Number(patient.is_active) === 0;

    document.title = `${fullName} · Patient Chart | Aromin-Sison Dental Clinic`;
    $('patientName').textContent = fullName;
    const avatar = $('patientInitials');
    avatar.classList.remove('skeleton');
    avatar.textContent = fullName.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
    $('patientIdentifier').textContent = `Patient ID #P-${Number(patient.patient_id)}`;
    $('patientStatus').innerHTML = `<span class="tag tag-${inactive ? 'red' : 'green'}">${inactive ? 'Inactive' : 'Active'}</span>`;

    // Phone and email are clickable so staff can call or write with one tap
    $('patientContact').innerHTML = [
      `<div><small>PHONE</small>${phone ? `<a class="phone-link" href="tel:${esc(phone.replace(/[^+0-9]/g, ''))}"><i class="bi bi-telephone" aria-hidden="true"></i> ${esc(phone)}</a>` : '<span class="is-missing">Not provided</span>'}</div>`,
      `<div><small>EMAIL</small>${email ? `<a href="mailto:${esc(email)}"><i class="bi bi-envelope" aria-hidden="true"></i> ${esc(email)}</a>` : '<span class="is-missing">Not provided</span>'}</div>`,
      `<div><small>REGISTERED</small><span>${esc(date(patient.registered_at))}</span></div>`
    ].join('');
  }

  function renderSummary() {
    const { records, appointments } = state;
    $('recordCount').textContent = records.length;
    $('appointmentCount').textContent = appointments.length;
    $('tabRecordsCount').textContent = records.length;
    $('tabAppointmentsCount').textContent = appointments.length;

    // Next appointment = the soonest one that has not happened yet
    const upcoming = appointments
      .filter(a => statusGroup(a) === 'upcoming')
      .map(a => ({ a, when: toDate(a.scheduled_date, a.scheduled_time) }))
      .sort((x, y) => x.when - y.when);
    if (upcoming.length) {
      const next = upcoming[0];
      $('nextAppointment').innerHTML = `${esc(date(next.a.scheduled_date))}<em>${esc(relativeDay(next.when))}${formatTime(next.a.scheduled_time) ? ` · ${esc(formatTime(next.a.scheduled_time))}` : ''}</em>`;
    } else {
      $('nextAppointment').innerHTML = 'None booked<em>No upcoming visit</em>';
    }

    // Last visit = the most recent completed appointment (or latest record if none)
    const doneDates = appointments
      .filter(a => statusGroup(a) === 'completed')
      .map(a => toDate(a.scheduled_date, a.scheduled_time))
      .concat(records.map(r => toDate(r.date_recorded)))
      .filter(Boolean)
      .sort((x, y) => y - x);
    if (doneDates.length) {
      const last = doneDates[0];
      const lastText = last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      $('lastVisit').innerHTML = `${esc(lastText)}<em>${esc(relativeDay(last))}</em>`;
    } else {
      $('lastVisit').innerHTML = 'No visits yet<em>Nothing on file</em>';
    }
  }

  // ---------- Treatment records (timeline) ----------

  function recordMatches(record, query) {
    return [record.date_recorded, record.diagnosis, record.treatment_given, record.treatment_protocol, record.dentist_name]
      .some(value => String(value || '').toLowerCase().includes(query));
  }

  function emptyState(icon, title, text, resetTarget) {
    return `<div class="chart-empty"><i class="bi ${icon}" aria-hidden="true"></i><strong>${esc(title)}</strong><span>${esc(text)}</span>${resetTarget ? `<button type="button" class="btn btn-secondary btn-sm" data-chart-reset="${resetTarget}">Clear search</button>` : ''}</div>`;
  }

  function renderRecords() {
    const list = $('recordsList');
    const query = $('recordsSearch').value.trim().toLowerCase();
    const direction = $('recordsSort').value;
    const all = state.records;
    const rows = sortByDate(all.filter(r => recordMatches(r, query)), r => toDate(r.date_recorded), direction);

    $('recordsCount').textContent = all.length ? `Showing ${rows.length} of ${all.length} record${all.length === 1 ? '' : 's'}` : '';

    if (!rows.length) {
      list.innerHTML = all.length
        ? emptyState('bi-search', 'No matching records', 'Try a different word, or clear the search.', 'records')
        : emptyState('bi-clipboard2-x', 'No treatment records yet', 'Records appear here after the dentist saves a treatment for this patient.');
      return;
    }

    let currentYear = '';
    list.innerHTML = rows.map(record => {
      const when = toDate(record.date_recorded);
      // A small year label whenever the year changes
      const yearLabel = when && String(when.getFullYear()) !== currentYear
        ? `<h3 class="chart-year">${when.getFullYear()}</h3>` : '';
      if (when) currentYear = String(when.getFullYear());

      const block = (label, text) => text
        ? `<div><b>${label}</b><p class="chart-clamp" data-clamp>${esc(text)}</p></div>` : '';
      const details = [
        block('Diagnosis', record.diagnosis),
        block('Treatment', record.treatment_given),
        block('Notes / protocol', record.treatment_protocol)
      ].filter(Boolean).join('');

      const dayBox = when
        ? `<div class="chart-record-date" aria-hidden="true"><b>${when.getDate()}</b><span>${when.toLocaleDateString('en-US', { month: 'short' })}</span></div>`
        : '<div class="chart-record-date" aria-hidden="true"><b>–</b><span>n/a</span></div>';

      return `${yearLabel}<article class="chart-entry chart-record">${dayBox}<div class="chart-record-body"><div class="chart-entry-top"><strong>${esc(date(record.date_recorded))}</strong><span class="chart-dentist"><i class="bi bi-person-badge" aria-hidden="true"></i>${esc(record.dentist_name || 'Dentist not recorded')}</span></div><div class="chart-entry-details">${details || '<p>Clinical details not recorded.</p>'}</div></div></article>`;
    }).join('');

    addShowMoreButtons(list);
  }

  // Long notes are cut to 4 lines. Add a "Show more" button only where text is really cut.
  function addShowMoreButtons(root) {
    root.querySelectorAll('[data-clamp]').forEach(paragraph => {
      if (paragraph.nextElementSibling && paragraph.nextElementSibling.classList.contains('chart-more')) return;
      if (paragraph.scrollHeight <= paragraph.clientHeight + 1) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chart-more';
      button.textContent = 'Show more';
      button.setAttribute('aria-expanded', 'false');
      paragraph.insertAdjacentElement('afterend', button);
    });
  }

  // ---------- Appointments ----------

  function renderFilters() {
    const counts = { all: state.appointments.length, upcoming: 0, completed: 0, cancelled: 0 };
    state.appointments.forEach(a => {
      const group = statusGroup(a);
      if (counts[group] !== undefined) counts[group] += 1;
    });
    $('appointmentFilters').innerHTML = FILTERS.map(f =>
      `<button type="button" class="chart-chip${state.appointmentFilter === f.key ? ' is-active' : ''}" data-filter="${f.key}" aria-pressed="${state.appointmentFilter === f.key}">${f.label} <b>${counts[f.key]}</b></button>`
    ).join('');
  }

  function renderAppointments() {
    const list = $('appointmentsList');
    const query = $('appointmentsSearch').value.trim().toLowerCase();
    const direction = $('appointmentsSort').value;
    const all = state.appointments;

    const rows = sortByDate(
      all.filter(a =>
        (state.appointmentFilter === 'all' || statusGroup(a) === state.appointmentFilter) &&
        [a.scheduled_date, a.scheduled_time, a.status, a.service_type, a.dentist_name]
          .some(value => String(value || '').toLowerCase().includes(query))),
      a => toDate(a.scheduled_date, a.scheduled_time),
      direction
    );

    renderFilters();
    $('appointmentsCount').textContent = all.length ? `Showing ${rows.length} of ${all.length} appointment${all.length === 1 ? '' : 's'}` : '';

    if (!rows.length) {
      list.innerHTML = all.length
        ? emptyState('bi-search', 'No matching appointments', 'Try another filter or clear the search.', 'appointments')
        : emptyState('bi-calendar-x', 'No appointments yet', 'Booked visits for this patient will show up here.');
      return;
    }

    list.innerHTML = rows.map(appointment => {
      const when = toDate(appointment.scheduled_date, appointment.scheduled_time);
      const time = formatTime(appointment.scheduled_time);
      const group = statusGroup(appointment);
      const statusClass = String(appointment.status || 'Unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const hint = group === 'upcoming' && when ? ` · ${relativeDay(when)}` : '';
      return `<article class="chart-entry chart-appt${group === 'upcoming' ? ' is-upcoming' : ''}"><div class="chart-appt-main"><div class="chart-appt-when">${esc(date(appointment.scheduled_date))}${time ? ` · ${esc(time)}` : ''}<span class="chart-muted">${esc(hint)}</span></div><p class="chart-appt-meta"><i class="bi bi-clipboard2-pulse" aria-hidden="true"></i>${esc(appointment.service_type || 'Appointment')}${appointment.dentist_name ? ` &nbsp;·&nbsp; <i class="bi bi-person-badge" aria-hidden="true"></i>${esc(appointment.dentist_name)}` : ''}</p></div><span class="chart-status chart-status-${esc(statusClass)}">${esc(appointment.status || 'Unknown')}</span></article>`;
    }).join('');
  }

  // ---------- Tabs ----------

  function selectTab(name, moveFocus) {
    state.tab = name;
    ['records', 'appointments'].forEach(key => {
      const tab = $(key === 'records' ? 'tabRecords' : 'tabAppointments');
      const panel = $(key === 'records' ? 'panelRecords' : 'panelAppointments');
      const active = key === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
      if (active && moveFocus) tab.focus();
    });
    // The records panel may have been hidden, so check the "Show more" buttons again
    if (name === 'records') addShowMoreButtons($('recordsList'));
  }

  // ---------- Wiring up clicks and typing (done once) ----------

  function bindEvents() {
    $('recordsSearch').addEventListener('input', renderRecords);
    $('recordsSort').addEventListener('change', renderRecords);
    $('appointmentsSearch').addEventListener('input', renderAppointments);
    $('appointmentsSort').addEventListener('change', renderAppointments);
    $('printChart').addEventListener('click', () => window.print());

    // Tabs: click, plus arrow keys / Home / End for keyboard users
    const tabs = [$('tabRecords'), $('tabAppointments')];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(index === 0 ? 'records' : 'appointments'));
      tab.addEventListener('keydown', event => {
        let next = null;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        selectTab(next === 0 ? 'records' : 'appointments', true);
      });
    });

    // One listener for the buttons that get re-created (filters, show more, clear, retry)
    document.addEventListener('click', event => {
      const filter = event.target.closest('[data-filter]');
      if (filter) {
        state.appointmentFilter = filter.dataset.filter;
        renderAppointments();
        return;
      }
      const more = event.target.closest('.chart-more');
      if (more) {
        const text = more.previousElementSibling;
        const open = more.getAttribute('aria-expanded') !== 'true';
        text.classList.toggle('chart-clamp', !open);
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? 'Show less' : 'Show more';
        return;
      }
      const reset = event.target.closest('[data-chart-reset]');
      if (reset) {
        if (reset.dataset.chartReset === 'records') {
          $('recordsSearch').value = '';
          renderRecords();
        } else {
          $('appointmentsSearch').value = '';
          state.appointmentFilter = 'all';
          renderAppointments();
        }
        return;
      }
      if (event.target.closest('[data-chart-retry]')) {
        loadChart();
      }
    });
  }

  // ---------- Load the chart from the server ----------

  async function loadChart() {
    const params = new URLSearchParams(window.location.search);
    const patientId = Number(params.get('patient_id'));
    const shell = $('chartShell');
    hideMessage();
    shell.classList.add('is-loading');

    // No patient chosen in the link
    if (!Number.isInteger(patientId) || patientId < 1) {
      showMessage({
        title: 'No patient selected',
        text: 'Choose a patient from Patient Management to open their chart.',
        tone: 'info',
        actions: backLink
      });
      return;
    }

    try {
      let response;
      try {
        response = await fetch(`../backend/api/patients/details.php?patient_id=${encodeURIComponent(patientId)}`, {
          credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }
        });
      } catch (_) {
        showLoadError('network');
        return;
      }

      let payload = {};
      try { payload = await response.json(); } catch (_) { /* answer was not JSON; handled below */ }

      if (!response.ok) {
        showLoadError(response.status, payload.error?.message || payload.message);
        return;
      }

      // The server wraps good answers as { success, message, data }.
      // We open it up, but also accept a plain object.
      const data = payload.data || payload;
      state.records = Array.isArray(data.records) ? data.records : [];
      state.appointments = Array.isArray(data.appointments) ? data.appointments : [];

      renderProfile(data.patient || {});
      renderSummary();
      renderRecords();
      renderAppointments();

      shell.classList.remove('is-loading');
      $('printChart').hidden = false;
    } catch (error) {
      showLoadError('other', error.message);
    }
  }

  // ---------- Start ----------

  function portalLabel(role) {
    return role === 'dentist' ? 'DENTIST PORTAL' : role === 'receptionist' ? 'RECEPTIONIST PORTAL' : 'PORTAL';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const guard = new window.ASDC.SessionGuard();
    window.ASDC.sessionGuard = guard;
    window.addEventListener('asdc:authenticated', event => {
      $('chartPortalRole').textContent = portalLabel(String(event.detail?.role || '').toLowerCase());
    });
    const currentRole = String(window.ASDCAuthUser?.role || '').toLowerCase();
    if (currentRole) $('chartPortalRole').textContent = portalLabel(currentRole);
    guard.init();
    bindEvents();
    loadChart();
  });
})();
