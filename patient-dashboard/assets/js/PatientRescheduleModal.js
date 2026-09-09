/**
 * PatientRescheduleModal – Reschedule appointment from patient schedule view.
 *
 * Encapsulates the reschedule modal, date/time validation, and API submission.
 * Replaces lines 1415-1581 of patient.js.
 *
 * Usage:
 *   const resched = new PatientRescheduleModal({ mock: PatientMock, onRescheduled: () => loadPatientAppointments() });
 *   resched.init();
 */
/* global Modal, showToast */
window.PatientRescheduleModal = class PatientRescheduleModal {
  constructor ({ mock, appointmentsEndpoint = '../backend/api/patients/appointments.php', onRescheduled = null } = {}) {
    this.mock          = mock;
    this.endpoint      = appointmentsEndpoint;
    this.onRescheduled = onRescheduled;
    this.modal         = new Modal('reschedModal');
    this._selectedIndex = null;
  }

  init () {
    if (!this.modal.modal) return;

    this.modal.registerClose(document.getElementById('reschedModalClose'));
    this.modal.registerClose(document.getElementById('rsCancelBtn'));

    const saveBtn = document.getElementById('rsSaveBtn');
    const dateEl  = document.getElementById('rsDate');
    const timeEl  = document.getElementById('rsTime');
    const noteEl  = document.getElementById('rsNote');

    if (dateEl) {
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      dateEl.min = today.toISOString().split('T')[0];
    }

    saveBtn?.addEventListener('click', async () => {
      if (this._selectedIndex === null) return;
      const appointment = this.mock.schedule[this._selectedIndex];
      if (!appointment) return;

      if (!dateEl.value) {
        noteEl.textContent = 'Please choose a new date.';
        noteEl.classList.add('err');
        noteEl.classList.remove('ok');
        noteEl.hidden = false;
        dateEl.focus();
        return;
      }

      saveBtn.classList.add('is-loading');
      noteEl.hidden = true;

      try {
        await this._api('PATCH', {
          appointment_id: appointment.appointment_id,
          scheduled_date: dateEl.value,
          scheduled_time: timeEl.value
        });

        if (this.onRescheduled) await this.onRescheduled();
        this.modal.close();
        showToast('Appointment rescheduled');
      } catch (error) {
        noteEl.textContent = error.message;
        noteEl.classList.add('err');
        noteEl.classList.remove('ok');
        noteEl.hidden = false;
      } finally {
        saveBtn.classList.remove('is-loading');
      }
    });

    // Bind reschedule buttons in schedule table
    const scheduleBody = document.getElementById('scheduleBody');
    scheduleBody?.addEventListener('click', event => {
      const button = event.target.closest('[data-action="resched"]');
      if (!button) return;

      const index = Number(button.dataset.index);
      const appointment = this.mock.schedule[index];
      if (!appointment) return;

      this._selectedIndex = index;
      dateEl.value = '';
      timeEl.value = appointment.time;
      noteEl.hidden = true;
      this.modal.open(button);
    });
  }

  async _api (method, body) {
    return apiFetch(this.endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
};
