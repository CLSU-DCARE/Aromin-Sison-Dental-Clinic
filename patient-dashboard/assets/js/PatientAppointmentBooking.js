/**
 * PatientAppointmentBooking – Book appointment form logic.
 *
 * Encapsulates slot selection, date validation, booking summary sync, and API submission.
 * Replaces lines 234-578 of patient.js.
 *
 * Usage:
 *   const booking = new PatientAppointmentBooking({ state: PatientState, onBooked: () => loadPatientAppointments() });
 *   booking.init();
 */
/* global escapeHtml, showToast, announce */
window.PatientAppointmentBooking = class PatientAppointmentBooking {
  constructor ({ state, appointmentsEndpoint = '../backend/api/patients/appointments.php', onBooked = null } = {}) {
    this.state       = state;
    this.endpoint   = appointmentsEndpoint;
    this.onBooked   = onBooked;
    this.noteEl     = null;
    this.confirmBtn = null;
  }

  init () {
    this.noteEl     = document.getElementById('bookingNote');
    this.confirmBtn = document.getElementById('confirmBookingBtn');
    document.getElementById('summaryDentist')?.closest('.row')?.remove();

    this._initDateMin();
    this._initSlots();
    this._initSummarySync();
    this._initConfirm();
  }

  /* ------------------------------------------------------------------
   *  Private
   * ----------------------------------------------------------------*/

  _initDateMin () {
    const date = document.getElementById('bookDate');
    if (!date) return;
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    date.min = today.toISOString().split('T')[0];
    date.addEventListener('change', () => {
      this._syncClosedDateNote();
      this._updateConfirmState();
    });
  }

  _initSlots () {
    document.querySelectorAll('.slot:not(.unavailable)').forEach(slot => {
      slot.addEventListener('click', () => {
        document.querySelectorAll('.slot').forEach(item => {
          const selected = item === slot;
          item.classList.toggle('selected', selected);
          if (item.hasAttribute('aria-pressed')) item.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        document.getElementById('selectedSlot').textContent = slot.dataset.slot;
        this._syncClosedDateNote();
        this._updateConfirmState();
      });
    });
    this._updateConfirmState();
  }

  _initSummarySync () {
    const service = document.getElementById('bookService');
    const sync = () => {
      const s = document.getElementById('summaryService');
      if (s && service) s.textContent = service.value;
    };
    if (service) service.addEventListener('change', sync);
  }

  _initConfirm () {
    if (!this.confirmBtn) return;
    this.confirmBtn.addEventListener('click', async () => {
      if (this._submitting) return;
      const date = document.getElementById('bookDate');
      const slot = document.querySelector('.slot.selected');

      if (!slot) {
        this._showNote('Please select an available time slot.', 'err');
        const first = document.querySelector('.slot:not(.unavailable)');
        if (first) first.focus();
        return;
      }

      if (!date || !date.value) {
        this._showNote('Please choose a preferred date.', 'err');
        if (date) date.focus();
        return;
      }

      const closedMessage = window.ASDC?.HolidayCalendar?.message(date.value) || '';
      if (closedMessage) {
        this._showNote(closedMessage, 'err');
        date.focus();
        return;
      }

      this._showNote('', '', true);
      this.confirmBtn.classList.add('is-loading');
      this._submitting = true;
      this.confirmBtn.disabled = true;

      try {
        const service  = document.getElementById('bookService').value;
        const time     = slot.dataset.slot;

        await this._api('POST', {
            service_type: service,
            scheduled_date: date.value,
            scheduled_time: time
          });
        if (this.onBooked) await this.onBooked();

        slot.classList.remove('selected');
        slot.setAttribute('aria-pressed', 'false');
        document.getElementById('selectedSlot').textContent = 'Not yet selected';
        this._updateConfirmState();

        const serviceSelect = document.getElementById('bookService');
        if (serviceSelect) serviceSelect.selectedIndex = 0;
        if (date) date.value = '';

        const summaryService = document.getElementById('summaryService');
        if (summaryService) summaryService.textContent = 'Braces Adjustment';

        this._showNote('Booking request sent! Our team will confirm shortly.', 'ok');
        announce('Booking request sent. Check your schedule to track it.');
      } catch (error) {
        this._showNote(error.message, 'err');
      } finally {
        this._submitting = false;
        this.confirmBtn.classList.remove('is-loading');
        this._updateConfirmState();
      }
    });
  }

  _updateConfirmState () {
    const date = document.getElementById('bookDate');
    const closed = Boolean(window.ASDC?.HolidayCalendar?.closureForDate(date?.value));
    if (this.confirmBtn) this.confirmBtn.disabled = closed || !document.querySelector('.slot.selected');
  }

  _syncClosedDateNote () {
    const date = document.getElementById('bookDate');
    const message = window.ASDC?.HolidayCalendar?.message(date?.value) || '';
    if (message) {
      this._showNote(message, 'err');
      return true;
    }
    this._showNote('', '', true);
    return false;
  }

  _showNote (message, kind, hide) {
    if (!this.noteEl) return;
    if (hide) { this.noteEl.hidden = true; return; }
    this.noteEl.textContent = message;
    this.noteEl.classList.toggle('ok', kind === 'ok');
    this.noteEl.classList.toggle('err', kind === 'err');
    this.noteEl.hidden = false;
  }

  async _api (method, body) {
    if (this._usesProductionApi()) {
      return this._productionApi(method, body);
    }
    const options = { method };
    if (body) { options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(body); }
    return apiFetch(this.endpoint, options);
  }

  _usesProductionApi () {
    return location.hostname === 'arominsisondental.vercel.app';
  }

  _productionUrl (path) {
    const base = window.ASDC?.API_BASE_URL || 'https://asdc-api-production.up.railway.app';
    return base.replace(/\/+$/, '') + '/' + String(path).replace(/^\.\.\//, '');
  }

  async _productionJson (url, options = {}) {
    const response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('The clinic server did not return a valid booking response. Please refresh and try again.');
    }
    if (!response.ok || payload.success === false) {
      const message = payload?.error?.message || payload?.message || 'Unable to book this appointment. Please try again.';
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return payload.data || payload;
  }

  async _productionCsrfToken () {
    try {
      const data = await this._productionJson(this._productionUrl('../backend/api/auth/csrf-token.php'));
      return data.csrf_token || '';
    } catch (error) {
      return '';
    }
  }

  async _productionApi (method, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') {
      const token = await this._productionCsrfToken();
      if (token) headers['X-CSRF-Token'] = token;
    }
    return this._productionJson(this._productionUrl(this.endpoint), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  }
};
