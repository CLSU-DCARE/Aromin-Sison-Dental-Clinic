(function () {
  'use strict';
  let chartData = null;
  const archivedView = new URLSearchParams(window.location.search).get('archived') === '1';
  const billingView = !archivedView && window.location.hash === '#billing';
  document.getElementById('view-payments').hidden = !billingView;
  document.getElementById('chartAppointmentHistory').hidden = billingView;
  document.getElementById('chartRecordTotals').hidden = billingView;
  document.getElementById('chartPageTitle').textContent = billingView ? 'Patient Billing' : 'Patient Record';
  document.getElementById('chartPageDescription').textContent = billingView ? 'Billing accounts and payment history for this patient.' : 'Patient details and appointment history for clinic staff.';
  if (billingView || archivedView) {
    const back = document.querySelector('.chart-back');
    if (back) { back.href = archivedView ? '/dashboard#archived' : '/dashboard#payments'; back.innerHTML = '<i class="bi bi-arrow-left" aria-hidden="true"></i> ' + (archivedView ? 'Back to Archived Patients' : 'Back to Billing'); }
  }

  const esc = value => window.ASDC.HtmlHelpers.escapeHtml(String(value ?? ''));
  const date = value => value ? window.ASDC.HtmlHelpers.formatDate(value) : 'Date not recorded';

  function renderAppointments(appointments, search = null) {
    const list = document.getElementById('appointmentsList');
    const query = search ?? document.getElementById('appointmentsSearch').value.trim().toLowerCase();
    const rows = appointments.filter(appointment => [appointment.scheduled_date, appointment.scheduled_time, appointment.status, appointment.service_type, appointment.dentist_name]
      .some(value => String(value || '').toLowerCase().includes(query)));
    if (!rows.length) {
      list.innerHTML = `<p class="chart-empty">${appointments.length ? 'No appointments match your search.' : 'No appointments are on file.'}</p>`;
      return;
    }
    list.innerHTML = '<div class="chart-table-scroll"><table class="chart-appointments-table"><colgroup><col style="width:23%"><col style="width:28%"><col style="width:30%"><col style="width:19%"></colgroup><thead><tr><th>Date / Time</th><th>Service</th><th>Dentist</th><th>Status</th></tr></thead><tbody>' + rows.map(appointment => {
      const time = String(appointment.scheduled_time || '').slice(0, 5);
      const status = String(appointment.status || 'Unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const color = { completed: 'green', confirmed: 'green', pending: 'amber', rejected: 'red', cancelled: 'red', no_show: 'red' }[appointment.status] || 'gray';
      return `<tr><td><strong>${esc(date(appointment.scheduled_date))}</strong>${time ? `<small>${esc(time)}</small>` : ''}</td><td>${esc(appointment.service_type || 'Appointment')}</td><td>${esc(appointment.dentist_name || 'Dentist not recorded')}</td><td><span class="tag tag-${color} chart-status-${esc(status)}">${esc(String(appointment.status || 'Unknown').replace(/_/g, ' '))}</span></td></tr>`;
    }).join('') + '</tbody></table></div>';
  }

  async function loadChart() {
    const params = new URLSearchParams(window.location.search);
    const patientId = Number(params.get('patient_id'));
    const message = document.getElementById('chartMessage');
    if (!Number.isInteger(patientId) || patientId < 1) {
      message.textContent = 'Choose a patient from Patient Management to open their chart.';
      message.classList.add('is-error');
      return;
    }

    try {
      const endpoint = archivedView ? 'archived.php' : 'details.php';
      const data = await window.ASDC.ApiClient.api(`../backend/api/patients/${endpoint}?patient_id=${encodeURIComponent(patientId)}${archivedView ? '&view=record' : ''}`, {
        cache: 'no-store'
      });
      const patient = data.patient || {};
      const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Patient';
      const phone = patient.contact_number || '';
      document.title = `${fullName} · ${billingView ? 'Patient Billing' : 'Patient Record'} | Aromin-Sison Dental Clinic`;
      document.getElementById('patientName').textContent = fullName;
      document.getElementById('patientInitials').textContent = fullName.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
      document.getElementById('patientIdentifier').textContent = `Patient ID #P-${Number(patient.patient_id)}`;
      document.getElementById('patientStatus').innerHTML = `<span class="tag tag-${archivedView ? 'amber' : Number(patient.is_active) === 0 ? 'red' : 'green'}">${archivedView ? 'Archived' : Number(patient.is_active) === 0 ? 'Inactive' : 'Active'}</span>`;
      document.getElementById('patientContact').innerHTML = [
        `<div><small>PHONE</small>${phone ? `<a class="phone-link" href="tel:${esc(phone.replace(/[^+0-9]/g, ''))}">${esc(phone)}</a>` : '<span>Not provided</span>'}</div>`,
        `<div><small>EMAIL</small><span>${esc(patient.email || 'Not provided')}</span></div>`,
        `<div><small>REGISTERED</small><span>${esc(date(patient.registered_at))}</span></div>`,
        ...(archivedView ? [`<div><small>ARCHIVED</small><span>${esc(date(patient.archived_at))}</span></div>`] : [])
      ].join('');

      const appointments = Array.isArray(data.appointments) ? data.appointments : [];
      document.getElementById('appointmentCount').textContent = appointments.length;
      renderAppointments(appointments);
      document.getElementById('appointmentsSearch').addEventListener('input', () => renderAppointments(appointments));
      message.hidden = true;
      chartData = data;
      document.getElementById('downloadChartPDF').disabled = false;
    } catch (error) {
      document.getElementById('patientName').textContent = 'Patient chart unavailable';
      message.textContent = error.status === 401
        ? 'Your staff session has expired. Please sign in again.'
        : error.status === 403
          ? 'Your account is not authorized to view patient charts.'
          : error.message || 'Unable to load this patient chart.';
      message.classList.add('is-error');
      if (error.status === 401) window.ASDC.sessionGuard.revalidate({ force: true });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.chart-back')?.addEventListener('click', event => {
      if (window.frameElement?.id === 'patientChartFrame') {
        event.preventDefault();
        window.parent.postMessage({ type: 'asdc:patient-chart-back' }, window.location.origin);
      }
    });
    const download = document.getElementById('downloadChartPDF');
    download.addEventListener('click', async () => {
      if (!chartData) return;
      download.disabled = true;
      const status = document.getElementById('chartDownloadStatus');
      try {
        if (billingView) await window.ASDC.exportPatientBilling();
        else {
          renderAppointments(chartData.appointments || [], '');
          try { await window.ASDC.downloadPatientChartLayoutPDF(chartData.patient); }
          finally { renderAppointments(chartData.appointments || []); }
        }
        status.textContent = 'A4 PDF downloaded.';
      } catch (error) {
        status.textContent = error.message || 'Unable to download the patient chart.';
      } finally {
        download.disabled = false;
      }
    });
    const guard = new window.ASDC.SessionGuard();
    window.ASDC.sessionGuard = guard;
    window.addEventListener('asdc:authenticated', event => {
      const role = String(event.detail?.role || '').toLowerCase();
      const label = role === 'dentist' ? 'DENTIST PORTAL' : role === 'receptionist' ? 'RECEPTIONIST PORTAL' : 'PORTAL';
      document.getElementById('chartPortalRole').textContent = label;
      loadChart();
    });
    const currentRole = String(window.ASDCAuthUser?.role || '').toLowerCase();
    if (currentRole) {
      document.getElementById('chartPortalRole').textContent = currentRole === 'dentist' ? 'DENTIST PORTAL' : currentRole === 'receptionist' ? 'RECEPTIONIST PORTAL' : 'PORTAL';
      loadChart();
    }
    guard.init();
  });
})();
