/** Small forms for existing workflow gaps; all writes go through authenticated APIs. */
(function () {
  const esc = value => ASDC.HtmlHelpers.escapeHtml(String(value ?? ''));
  function form(title, fields, save) {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'border:1px solid #ddd;border-radius:16px;padding:24px;width:min(520px,90vw);max-height:90vh';
    dialog.innerHTML = `<form><h3>${esc(title)}</h3>${fields}<p role="alert" data-error></p><div style="display:flex;gap:12px;margin-top:16px"><button type="submit" class="btn btn-primary">Save</button><button type="button" class="btn btn-outline" data-close>Cancel</button></div></form>`;
    document.body.appendChild(dialog);
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const button = dialog.querySelector('[type=submit]');
      if (button.disabled) return;
      button.disabled = true;
      try { await save(Object.fromEntries(new FormData(event.target))); dialog.close(); ASDC._toast.show('Saved successfully.'); }
      catch (error) { dialog.querySelector('[data-error]').textContent = error.message; }
      finally { button.disabled = false; }
    };
    dialog.showModal();
  }
  const field = (label, input) => `<label style="display:block;margin-top:12px">${esc(label)}${input}</label>`;
  const write = (url, body, method = 'PATCH') => apiFetch('../backend/api/' + url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  ASDC.openProfileForm = patient => form('Edit patient profile',
    field('Full name', `<input name="name" required maxlength="100" value="${esc(patient.name)}">`) +
    field('Contact number', `<input name="contact_number" maxlength="20" value="${esc(patient.contact === '—' ? '' : patient.contact)}">`),
    values => write('patients/profile.php', { ...values, patient_id: patient.pid }));

  ASDC.openClinicalForm = (snapshot, record = null) => {
    const patients = record ? snapshot.patients.filter(p => Number(p.patient_id) === Number(record.patient_id)) : snapshot.patients;
    const patientOptions = patients.map(p => `<option value="${Number(p.patient_id)}">${esc(p.first_name + ' ' + p.last_name)}</option>`).join('');
    if (!patients.length) { ASDC._toast.show('No assigned patients are available.'); return; }
    form(record ? 'Edit treatment record' : 'Record consultation / treatment',
      field('Patient', `<select name="patient_id" required>${patientOptions}</select>`) +
      field('Date recorded', `<input name="date_recorded" type="date" required value="${esc(record?.date_recorded || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,10))}">`) +
      field('Diagnosis', `<input name="diagnosis" maxlength="255" value="${esc(record?.diagnosis)}">`) +
      field('Treatment', `<textarea name="treatment_given" maxlength="10000">${esc(record?.treatment_given)}</textarea>`) +
      field('Dentist notes / protocol (shared with patient)', `<textarea name="treatment_protocol" maxlength="10000">${esc(record?.treatment_protocol)}</textarea>`),
      values => write('patients/records.php', { ...values, ...(record ? { record_id: record.record_id, appointment_id: record.appointment_id } : {}) }, record ? 'PATCH' : 'POST'));
  };

  ASDC.approveAppointment = async appointment => {
    const data = await apiFetch('../backend/api/contracts/dentists.php');
    if (!data.dentists.length) throw new Error('No active dentist is available for assignment.');
    return new Promise(resolve => {
      form('Approve appointment and assign dentist', field('Treating dentist', `<select name="dentist_id" required>${data.dentists.map(d => `<option value="${Number(d.user_id)}" ${Number(d.user_id) === Number(appointment.dentist_id) ? 'selected' : ''}>${esc(d.full_name)}</option>`).join('')}</select>`),
        async values => { await write('appointments/actions.php', { action: 'approve', resource_type: 'appointment', appointment_id: appointment.appointment_id, dentist_id: Number(values.dentist_id) }, 'POST'); resolve(); });
    });
  };

  ASDC.renderDentistActions = (container, snapshot) => {
    if (!container) return;
    const appointments = [...new Map(snapshot.week.appointments.concat(snapshot.pending).map(a => [a.appointment_id, a])).values()];
    container.innerHTML = appointments.length ? appointments.map(a => `<div class="card" style="padding:12px;margin-top:8px"><strong>${esc(a.patient_name)}</strong> · ${esc(a.service_type)} · ${esc(a.scheduled_date)} ${esc(a.scheduled_time)} · ${esc(a.status)}<div>${['pending','confirmed'].includes(a.status) ? (a.status === 'pending' ? ['approve','reject','reschedule','cancel'] : ['reschedule','cancel','complete','no_show']).map(action => `<button class="btn btn-outline btn-sm" data-id="${Number(a.appointment_id)}" data-clinical-action="${action}">${esc({ approve: 'Approve', reject: 'Reject', reschedule: 'Reschedule', cancel: 'Cancel', complete: 'Complete', no_show: 'No-show' }[action])}</button>`).join('') : ''}</div></div>`).join('') : '<p>No appointments for this week.</p>';
    container.onclick = async event => {
      const button = event.target.closest('[data-clinical-action]');
      if (!button || button.disabled) return;
      const appointment = appointments.find(a => Number(a.appointment_id) === Number(button.dataset.id));
      const action = button.dataset.clinicalAction;
      const body = { action, appointment_id: appointment.appointment_id, resource_type: 'appointment' };
      if (action === 'reschedule') {
        form('Reschedule appointment', field('Date', `<input type="date" name="scheduled_date" required value="${esc(appointment.scheduled_date)}">`) + field('Time', `<input type="time" name="scheduled_time" required value="${esc(appointment.scheduled_time.slice(0,5))}">`), values => write('appointments/actions.php', { ...body, ...values }));
        return;
      }
      if (!window.confirm('Update this appointment to ' + action.replace('_', '-') + '?')) return;
      button.disabled = true;
      try { await write('appointments/actions.php', body, 'POST'); ASDC._toast.show('Appointment updated.'); }
      catch (error) { ASDC._toast.show(error.message, 'error'); }
      finally { button.disabled = false; }
    };
  };
})();
