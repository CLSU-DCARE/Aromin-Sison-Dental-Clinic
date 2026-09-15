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
        this._showNote('', '', true);
        this._updateConfirmState();
      });
    });
    this._updateConfirmState();
  }

  _initSummarySync () {
    const service = document.getElementById('bookService');
    const dentist = document.getElementById('bookDentist');
    const sync = () => {
      const s = document.getElementById('summaryService');
      const d = document.getElementById('summaryDentist');
      if (s && service) s.textContent = service.value;
      if (d && dentist) d.textContent = dentist.value === 'No preference' ? 'Clinic assignment' : dentist.value;
    };
    if (service) service.addEventListener('change', sync);
    if (dentist) dentist.addEventListener('change', sync);
  }

  _initConfirm () {
    if (!this.confirmBtn) return;
    this.confirmBtn.addEventListener('click', async () => {
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

      this._showNote('', '', true);
      this.confirmBtn.classList.add('is-loading');

      try {
        const service  = document.getElementById('bookService').value;
        const dentist  = document.getElementById('bookDentist').value;
        const time     = slot.dataset.slot;

        await this._api('POST', {
            service_type: service,
            preferred_dentist: dentist,
            scheduled_date: date.value,
            scheduled_time: time
          });
        if (this.onBooked) await this.onBooked();

        slot.classList.remove('selected');
        slot.setAttribute('aria-pressed', 'false');
        document.getElementById('selectedSlot').textContent = 'Not yet selected';
        this._updateConfirmState();

        const serviceSelect = document.getElementById('bookService');
        const dentistSelect = document.getElementById('bookDentist');
        if (serviceSelect) serviceSelect.selectedIndex = 0;
        if (dentistSelect) dentistSelect.selectedIndex = 0;
        if (date) date.value = '';

        const summaryService = document.getElementById('summaryService');
        const summaryDentist = document.getElementById('summaryDentist');
        if (summaryService) summaryService.textContent = 'Braces Adjustment';
        if (summaryDentist) summaryDentist.textContent = this.state.profile.primaryDentist;

        this._showNote('Booking request sent! Our team will confirm shortly.', 'ok');
        announce('Booking request sent. Check your schedule to track it.');
      } catch (error) {
        this._showNote(error.message, 'err');
      } finally {
        this.confirmBtn.classList.remove('is-loading');
      }
    });
  }

  _updateConfirmState () {
    if (this.confirmBtn) this.confirmBtn.disabled = !document.querySelector('.slot.selected');
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
    const options = { method };
    if (body) { options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(body); }
    return apiFetch(this.endpoint, options);
  }
};
