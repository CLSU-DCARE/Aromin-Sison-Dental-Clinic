/**
 * AppointmentActions – Approve / Reschedule / Cancel for staff appointments.
 *
 * Encapsulates the reschedule modal, runAppointmentAction, and all event delegation
 * for request actions and scheduled appointment actions.
 *
 * Usage:
 *   const actions = new AppointmentActions({ scheduler });
 *   actions.init();
 */
/* global Modal, showToast */
window.AppointmentActions = class AppointmentActions {
  constructor ({ scheduler, actionEndpoint = '../backend/api/appointments/actions.php' } = {}) {
    this.scheduler      = scheduler;
    this.actionEndpoint = actionEndpoint;
    this.rescheduleModal = new Modal('requestRescheduleModal');
    this._reschedulingResource = null;
  }

  init () {
    window.__appointmentActions = this;
    this._bindRequestActions();
    this._bindRescheduleModal();
  }

  /* ------------------------------------------------------------------
   *  Public – execute an action (exposed for external callers)
   * ----------------------------------------------------------------*/

  async run (action, resourceType, resourceId, extra = {}, refresh = true) {
    // Demo/offline mode: the real actions.php endpoint isn't reachable, so
    // mutate the in-memory sample data directly instead of failing forever.
    if (this.scheduler.isMock()) {
      this._runMock(action, resourceType, resourceId, extra);
      if (refresh) this.scheduler._render();
      return { mock: true };
    }
    const idKey = resourceType === 'request' ? 'request_id' : 'appointment_id';
    const data  = await this._api(this.actionEndpoint, {
      method: action === 'reschedule' ? 'PATCH' : 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action, resource_type: resourceType, [idKey]: Number(resourceId) }, extra))
    });
    if (refresh) await this.scheduler.loadWeek();
    return data;
  }

  /** Mutates scheduler.state directly for the sample-data (offline) case. */
  _runMock (action, resourceType, resourceId, extra) {
    const state = this.scheduler.state;
    const list  = resourceType === 'request' ? state.requests : state.appointments;
    const idKey = resourceType === 'request' ? 'request_id' : 'appointment_id';
    const item  = list.find(i => Number(i[idKey]) === Number(resourceId));
    if (!item) return;

    if (action === 'approve' && resourceType === 'request') {
      // Move the request into the confirmed appointments list.
      state.requests = state.requests.filter(r => r !== item);
      state.appointments.push(Object.assign({}, item, { appointment_id: item.request_id, status: 'confirmed' }));
    } else if (action === 'cancel') {
      if (resourceType === 'request') state.requests = state.requests.filter(r => r !== item);
      else item.status = 'cancelled';
    } else if (action === 'reschedule') {
      item.scheduled_date = extra.scheduled_date;
      item.scheduled_time = extra.scheduled_time + ':00';
    }
  }

  /* ------------------------------------------------------------------
   *  Private – request table action delegation
   * ----------------------------------------------------------------*/

  _bindRequestActions () {
    document.getElementById('appointmentRequestsBody')?.addEventListener('click', async event => {
      const button = event.target.closest('[data-request-action]');
      if (!button || button.disabled) return;

      const requestId = Number(button.dataset.requestId);
      const request   = this.scheduler.getRequest(requestId);
      if (!request) return;

      if (button.dataset.requestAction === 'reschedule') {
        this._openReschedule('request', requestId, request.patient_name, request.service_type, request.scheduled_date, String(request.scheduled_time).slice(0, 5));
        return;
      }

      const action = button.dataset.requestAction;
      if (action === 'cancel' && !window.confirm(`Reject the booking request from ${request.patient_name}?`)) return;

      const rowButtons = button.closest('tr').querySelectorAll('button');
      rowButtons.forEach(b => { b.disabled = true; });
      button.classList.add('is-loading');

      try {
        await this.run(action, 'request', requestId);
        showToast(action === 'approve' ? 'Booking request approved and added to the schedule' : 'Booking request rejected', action === 'approve' ? 'success' : 'error');
      } catch (error) {
        showToast(error.code === 'slot_unavailable' ? 'That appointment slot is already booked.' : error.message, 'error');
        rowButtons.forEach(b => { b.disabled = false; });
        button.classList.remove('is-loading');
      }
    });
  }

  /* ------------------------------------------------------------------
   *  Private – grid/list appointment action delegation
   * ----------------------------------------------------------------*/

  handleGridClick (event) {
    const button = event.target.closest('[data-appointment-action]');
    if (!button || button.disabled) return;

    const appointmentId = Number(button.dataset.appointmentId);
    const appointment   = this.scheduler.getAppointment(appointmentId);
    if (!appointment) return;

    const action = button.dataset.appointmentAction;

    if (action === 'reschedule') {
      this._openReschedule('appointment', appointmentId, appointment.patient_name, appointment.service_type, appointment.scheduled_date, String(appointment.scheduled_time).slice(0, 5));
      return;
    }

    if (!window.confirm(`Cancel the appointment for ${appointment.patient_name}?`)) return;

    const controls = button.closest('.appointment-card-actions, .appointment-request-actions');
    const buttons  = controls ? controls.querySelectorAll('button') : [button];
    buttons.forEach(b => { b.disabled = true; });
    button.classList.add('is-loading');

    this.run('cancel', 'appointment', appointmentId)
      .then(() => showToast('Appointment cancelled', 'error'))
      .catch(error => {
        showToast(error.message, 'error');
        buttons.forEach(b => { b.disabled = false; });
        button.classList.remove('is-loading');
      });
  }

  /* ------------------------------------------------------------------
   *  Private – reschedule modal
   * ----------------------------------------------------------------*/

  _bindRescheduleModal () {
    if (!this.rescheduleModal.modal) return;

    this.rescheduleModal.registerClose(document.getElementById('requestRescheduleClose'));
    this.rescheduleModal.registerClose(document.getElementById('requestRescheduleCancel'));

    const dateInput = document.getElementById('requestRescheduleDate');
    const timeInput = document.getElementById('requestRescheduleTime');
    const saveBtn   = document.getElementById('requestRescheduleSave');
    const note      = document.getElementById('requestRescheduleNote');

    dateInput.min = AppointmentScheduler.isoDate(new Date());

    saveBtn.addEventListener('click', async () => {
      if (!this._reschedulingResource || !dateInput.value || !timeInput.value) {
        note.textContent = 'Choose a valid new date and time.';
        note.classList.add('err');
        note.classList.remove('ok');
        note.hidden = false;
        return;
      }

      saveBtn.disabled = true;
      saveBtn.classList.add('is-loading');
      note.hidden = true;

      try {
        await this.run('reschedule', this._reschedulingResource.type, this._reschedulingResource.id, {
          scheduled_date: dateInput.value,
          scheduled_time: timeInput.value
        }, false);
        this.rescheduleModal.close();
        showToast(this._reschedulingResource.type === 'request' ? 'Booking request rescheduled' : 'Appointment rescheduled');
        // In mock/offline mode the mutation already happened in-memory —
        // calling loadWeek() again would just regenerate fresh sample data
        // and throw the change away, so only re-fetch for the real API.
        if (this.scheduler.isMock()) this.scheduler._render();
        else await this.scheduler.loadWeek();
      } catch (error) {
        note.textContent = error.code === 'slot_unavailable' ? 'That date and time are already booked. Choose another slot.' : error.message;
        note.classList.add('err');
        note.classList.remove('ok');
        note.hidden = false;
      } finally {
        saveBtn.disabled = false;
        saveBtn.classList.remove('is-loading');
      }
    });
  }

  _openReschedule (type, id, patientName, serviceType, date, time) {
    this._reschedulingResource = { type, id };
    document.getElementById('requestRescheduleTitle').textContent    = type === 'request' ? 'Reschedule Booking Request' : 'Reschedule Appointment';
    document.getElementById('requestReschedulePatient').textContent = `${patientName} · ${serviceType}`;
    document.getElementById('requestRescheduleDate').value          = date;
    document.getElementById('requestRescheduleTime').value          = time;
    document.getElementById('requestRescheduleNote').hidden        = true;
    this.rescheduleModal.open(document.querySelector(`[data-request-id="${id}"], [data-appointment-id="${id}"]`));
  }

  /* ------------------------------------------------------------------
   *  Private – API (delegated to shared apiFetch)
   * ----------------------------------------------------------------*/

  async _api (url, options = {}) {
    return apiFetch(url, options);
  }
};
