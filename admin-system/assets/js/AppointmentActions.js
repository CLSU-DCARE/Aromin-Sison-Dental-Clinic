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
/* global Modal, showToast, ASDC */
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
    const idKey = resourceType === 'request' ? 'request_id' : 'appointment_id';
    const data  = await this._api(this.actionEndpoint, {
      method: action === 'reschedule' ? 'PATCH' : 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action, resource_type: resourceType, [idKey]: Number(resourceId) }, extra))
    });
    if (refresh) await this.scheduler.loadWeek();
    return data;
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
      if (action === 'approve' && window.ASDC.approveAppointmentRequest) {
        window.ASDC.approveAppointmentRequest(request)
          .then(() => this.scheduler.loadWeek())
          .then(() => showToast('Booking request approved and added to the schedule', 'success'))
          .catch(error => showToast(error.message, 'error'));
        return;
      }

      if (['reject', 'cancel'].includes(action)) {
        const actionLabel = action === 'reject' ? 'Reject' : 'Cancel';
        const confirmed = await ASDC.confirmAction({
          title: `${actionLabel} Booking Request`,
          message: `${actionLabel} the booking request from ${request.patient_name}?`,
          confirmLabel: actionLabel,
          tone: 'danger'
        });
        if (!confirmed) return;
      }

      const rowButtons = button.closest('tr').querySelectorAll('button');
      rowButtons.forEach(b => { b.disabled = true; });
      button.classList.add('is-loading');

      try {
        await this.run(action, 'request', requestId);
        const messages = {
          approve: 'Booking request approved and added to the schedule',
          reject: 'Booking request rejected',
          cancel: 'Booking request cancelled'
        };
        showToast(messages[action] || 'Booking request updated', action === 'approve' ? 'success' : 'error');
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

  async handleGridClick (event) {
    const button = event.target.closest('[data-appointment-action]');
    if (!button || button.disabled) return;

    const appointmentId = Number(button.dataset.appointmentId);
    const appointment   = this.scheduler.getAppointment(appointmentId);
    if (!appointment) return;

    const action = button.dataset.appointmentAction;

    if (action === 'approve' && window.ASDC.approveAppointment) {
      if (window.ASDCAuthUser?.role === 'dentist') {
        this.run('approve', 'appointment', appointmentId)
          .then(() => showToast('Appointment approved and added to the schedule', 'success'))
          .catch(error => showToast(error.message, 'error'));
        return;
      }
      window.ASDC.approveAppointment(appointment)
        .then(() => this.scheduler.loadWeek())
        .then(() => showToast('Appointment approved and added to the schedule', 'success'))
        .catch(error => showToast(error.message, 'error'));
      return;
    }

    if (action === 'reschedule') {
      this._openReschedule('appointment', appointmentId, appointment.patient_name, appointment.service_type, appointment.scheduled_date, String(appointment.scheduled_time).slice(0, 5));
      return;
    }

    const actionLabel = {
      reject: 'Reject',
      cancel: 'Cancel',
      complete: 'Complete',
      no_show: 'Mark No-show'
    }[action] || action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ');
    if (['complete', 'no_show'].includes(action)) {
      const scheduledAt = new Date(`${appointment.scheduled_date}T${String(appointment.scheduled_time).slice(0, 5)}`);
      if (!Number.isNaN(scheduledAt.getTime()) && scheduledAt > new Date()) {
        showToast('This appointment cannot be marked complete or no-show until its scheduled date and time.', 'error');
        return;
      }
    }
    const confirmed = await ASDC.confirmAction({
      title: `${actionLabel} Appointment`,
      message: `${actionLabel} the appointment for ${appointment.patient_name}?`,
      confirmLabel: actionLabel,
      tone: ['reject', 'cancel'].includes(action) ? 'danger' : 'gold'
    });
    if (!confirmed) return;

    const controls = button.closest('.appointment-card-actions, .appointment-request-actions');
    const buttons  = controls ? controls.querySelectorAll('button') : [button];
    buttons.forEach(b => { b.disabled = true; });
    button.classList.add('is-loading');

    this.run(action, 'appointment', appointmentId)
      .then(() => showToast('Appointment updated', 'success'))
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
        await this.scheduler.loadWeek();
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
