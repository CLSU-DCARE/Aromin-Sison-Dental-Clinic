(function () {
  'use strict';
  let chartData = null;

  const esc = value => window.ASDC.HtmlHelpers.escapeHtml(String(value ?? ''));
  const date = value => value ? window.ASDC.HtmlHelpers.formatDate(value) : 'Date not recorded';

  function renderRecords(records) {
    const list = document.getElementById('recordsList');
    const query = document.getElementById('recordsSearch').value.trim().toLowerCase();
    const rows = records.filter(record => [record.date_recorded, record.diagnosis, record.treatment_given, record.treatment_protocol, record.dentist_name]
      .some(value => String(value || '').toLowerCase().includes(query)));
    if (!rows.length) {
      list.innerHTML = `<p class="chart-empty">${records.length ? 'No clinical records match your search.' : 'No clinical treatment records are on file.'}</p>`;
      return;
    }
    list.innerHTML = rows.map(record => {
      const details = [
        record.diagnosis ? `<div><b>Diagnosis</b><p>${esc(record.diagnosis)}</p></div>` : '',
        record.treatment_given ? `<div><b>Treatment</b><p>${esc(record.treatment_given)}</p></div>` : '',
        record.treatment_protocol ? `<div><b>Notes / protocol</b><p>${esc(record.treatment_protocol)}</p></div>` : ''
      ].filter(Boolean).join('');
      return `<article class="chart-entry"><div class="chart-entry-top"><strong>${esc(date(record.date_recorded))}</strong><span>${esc(record.dentist_name || 'Dentist not recorded')}</span></div><div class="chart-entry-details">${details || '<p>Clinical details not recorded.</p>'}</div></article>`;
    }).join('');
  }

  function renderAppointments(appointments) {
    const list = document.getElementById('appointmentsList');
    const query = document.getElementById('appointmentsSearch').value.trim().toLowerCase();
    const rows = appointments.filter(appointment => [appointment.scheduled_date, appointment.scheduled_time, appointment.status, appointment.service_type, appointment.dentist_name]
      .some(value => String(value || '').toLowerCase().includes(query)));
    if (!rows.length) {
      list.innerHTML = `<p class="chart-empty">${appointments.length ? 'No appointments match your search.' : 'No appointments are on file.'}</p>`;
      return;
    }
    list.innerHTML = rows.map(appointment => {
      const time = String(appointment.scheduled_time || '').slice(0, 5);
      const status = String(appointment.status || 'Unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      return `<article class="chart-entry"><div class="chart-entry-top"><strong>${esc(date(appointment.scheduled_date))}${time ? ` · ${esc(time)}` : ''}</strong><span class="chart-status chart-status-${esc(status)}">${esc(appointment.status || 'Unknown')}</span></div><p>${esc(appointment.service_type || 'Appointment')}${appointment.dentist_name ? ` · ${esc(appointment.dentist_name)}` : ''}</p></article>`;
    }).join('');
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
      const data = await window.ASDC.ApiClient.api(`../backend/api/patients/details.php?patient_id=${encodeURIComponent(patientId)}`, {
        cache: 'no-store'
      });
      const patient = data.patient || {};
      const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Patient';
      const phone = patient.contact_number || '';
      document.title = `${fullName} · Patient Chart | Aromin-Sison Dental Clinic`;
      document.getElementById('patientName').textContent = fullName;
      document.getElementById('patientInitials').textContent = fullName.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
      document.getElementById('patientIdentifier').textContent = `Patient ID #P-${Number(patient.patient_id)}`;
      document.getElementById('patientStatus').innerHTML = `<span class="tag tag-${Number(patient.is_active) === 0 ? 'red' : 'green'}">${Number(patient.is_active) === 0 ? 'Inactive' : 'Active'}</span>`;
      document.getElementById('patientContact').innerHTML = [
        `<div><small>PHONE</small>${phone ? `<a class="phone-link" href="tel:${esc(phone.replace(/[^+0-9]/g, ''))}">${esc(phone)}</a>` : '<span>Not provided</span>'}</div>`,
        `<div><small>EMAIL</small><span>${esc(patient.email || 'Not provided')}</span></div>`,
        `<div><small>REGISTERED</small><span>${esc(date(patient.registered_at))}</span></div>`
      ].join('');

      const records = Array.isArray(data.records) ? data.records : [];
      const appointments = Array.isArray(data.appointments) ? data.appointments : [];
      document.getElementById('recordCount').textContent = records.length;
      document.getElementById('appointmentCount').textContent = appointments.length;
      renderRecords(records);
      renderAppointments(appointments);
      document.getElementById('recordsSearch').addEventListener('input', () => renderRecords(records));
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
    download.addEventListener('click', () => {
      if (!chartData) return;
      download.disabled = true;
      const status = document.getElementById('chartDownloadStatus');
      try {
        window.ASDC.downloadPatientChartPDF(chartData);
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
