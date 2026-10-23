(function () {
  'use strict';
  window.ASDC.downloadPatientChartPDF = function (data) {
    const PDF = window.jspdf?.jsPDF;
    if (!PDF) throw new Error('PDF download is unavailable. Please reload the page and try again.');
    const pdf = new PDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const patient = data.patient;
    const name = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const margin = 16;
    let y = margin;
    const generated = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    function header() {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('AROMIN-SISON DENTAL CLINIC', margin, margin);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text('Patient Chart | #P-' + patient.patient_id, margin, margin + 6);
      pdf.setDrawColor(156, 139, 62);
      pdf.line(margin, margin + 10, width - margin, margin + 10);
      y = margin + 18;
    }
    function text(value, bold = false, size = 10) {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(String(value || 'Not recorded'), width - margin * 2);
      for (const line of lines) {
        if (y > height - 22) {
          pdf.addPage();
          header();
          pdf.setFont('helvetica', bold ? 'bold' : 'normal');
          pdf.setFontSize(size);
        }
        pdf.text(line, margin, y);
        y += size * 0.48;
      }
      y += 3;
    }
    const date = value => value ? window.ASDC.HtmlHelpers.formatDate(value) : 'Not recorded';
    header();
    text(name || 'Patient', true, 16);
    text('Status: ' + (Number(patient.is_active) === 0 ? 'Inactive' : 'Active'));
    text('Phone: ' + (patient.contact_number || 'Not provided'));
    text('Email: ' + (patient.email || 'Not provided'));
    text('Registered: ' + date(patient.registered_at));
    const records = Array.isArray(data.records) ? data.records : [];
    const appointments = Array.isArray(data.appointments) ? data.appointments : [];
    text(`Clinical Treatment Records (${records.length})`, true, 13);
    if (!records.length) text('No clinical treatment records are on file.');
    records.forEach((record, index) => {
      text(`${index + 1}. ${date(record.date_recorded)} | ${record.dentist_name || 'Dentist not recorded'}`, true);
      text('Diagnosis: ' + (record.diagnosis || 'Not recorded'));
      text('Treatment: ' + (record.treatment_given || 'Not recorded'));
      text('Notes / protocol: ' + (record.treatment_protocol || 'Not recorded'));
    });
    text(`Appointments (${appointments.length})`, true, 13);
    if (!appointments.length) text('No appointments are on file.');
    appointments.forEach((appointment, index) => {
      text(`${index + 1}. ${date(appointment.scheduled_date)} ${String(appointment.scheduled_time || '').slice(0, 5)}`, true);
      text('Service: ' + (appointment.service_type || 'Not recorded'));
      text('Status: ' + (appointment.status || 'Not recorded'));
      text('Dentist: ' + (appointment.dentist_name || 'Not recorded'));
    });
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('Generated: ' + generated + ' (Asia/Manila)', margin, height - 12);
      pdf.text(`${page} / ${pages}`, width - margin, height - 12, { align: 'right' });
    }
    const filename = (name || 'patient').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'patient';
    pdf.save(`patient-chart-P${patient.patient_id}-${filename}.pdf`);
  };
})();
