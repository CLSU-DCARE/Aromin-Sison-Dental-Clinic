(function () {
  'use strict';
  window.ASDC.downloadPatientChartPDF = function (data, { billing = null } = {}) {
    const PDF = window.jspdf?.jsPDF;
    if (!PDF) throw new Error('PDF download is unavailable. Please reload the page and try again.');
    const pdf = new PDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const patient = data.patient;
    const name = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const ink = [35, 39, 37], muted = [107, 112, 107], gold = [151, 131, 55];
    let y = margin;
    const generated = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    function header() {
      pdf.setFillColor(...gold);
      pdf.rect(margin, 11, 8, 1, 'F');
      pdf.setTextColor(...gold);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('AROMIN-SISON DENTAL CLINIC', margin, 18);
      pdf.setTextColor(...ink);
      pdf.setFontSize(18);
      pdf.text(billing ? 'Billing Statement' : 'Patient Chart', margin, 27);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...muted);
      pdf.text(billing ? 'PATIENT BILLING' : 'PATIENT RECORD', width - margin, 18, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('#P-' + patient.patient_id, width - margin, 27, { align: 'right' });
      pdf.setDrawColor(218, 216, 204);
      pdf.line(margin, 32, width - margin, 32);
      y = 39;
    }
    function ensure(space) {
      if (y + space > height - 24) { pdf.addPage(); header(); }
    }
    function text(value, bold = false, size = 9, x = margin, maxWidth = width - margin * 2) {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(String(value || 'Not recorded'), maxWidth);
      for (const line of lines) {
        ensure(size * 0.44);
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(...ink);
        pdf.text(line, x, y);
        y += size * 0.44;
      }
      y += 1.5;
    }
    function field(label, value) {
      ensure(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...muted);
      pdf.text(label.toUpperCase(), margin + 4, y);
      text(value, false, 9, margin + 36, width - margin * 2 - 40);
    }
    function section(title, count) {
      y += 4;
      ensure(27);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...muted);
      pdf.text(`${count} ${count === 1 ? 'record' : 'records'}`, width - margin, y, { align: 'right' });
      text(title, true, 11);
      pdf.setDrawColor(...gold);
      pdf.line(margin, y - 1, width - margin, y - 1);
      y += 5;
    }
    function entry(title) {
      ensure(27);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      const lineCount = pdf.splitTextToSize(title, width - margin * 2 - 8).length;
      pdf.setFillColor(244, 244, 238);
      pdf.rect(margin, y - 4, width - margin * 2, lineCount * 3.96 + 3, 'F');
      text(title, true, 9, margin + 4, width - margin * 2 - 8);
      y += 3;
    }
    const date = value => value ? window.ASDC.HtmlHelpers.formatDate(value) : 'Not recorded';
    header();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    const nameLines = pdf.splitTextToSize(name || 'Patient', width - margin * 2 - 12);
    pdf.setFillColor(246, 245, 238);
    pdf.rect(margin, y - 4, width - margin * 2, nameLines.length * 6.16 + 13, 'F');
    pdf.setTextColor(...gold);
    pdf.setFontSize(7);
    pdf.text('PATIENT INFORMATION', margin + 6, y + 2);
    y += 9;
    text(name || 'Patient', true, 14, margin + 6, width - margin * 2 - 12);
    y += 7;
    field('Status', Number(patient.is_active) === 0 ? 'Inactive' : 'Active');
    field('Phone', patient.contact_number || 'Not provided');
    field('Email', patient.email || 'Not provided');
    field('Registered', date(patient.registered_at));
    if (billing) {
      const accounts = billing.accounts || [];
      const payments = billing.payments || [];
      const money = value => 'PHP ' + Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const total = key => accounts.reduce((sum, account) => sum + (key === 'balance_amount' && account.status === 'cancelled' ? 0 : Number(account[key] || 0)), 0);
      y += 3;
      field('Recorded payments', money(total('paid_amount')));
      field('Outstanding balance', money(total('balance_amount')));
      section('Billing Accounts', accounts.length);
      if (!accounts.length) text('No billing accounts for this patient.');
      accounts.forEach(account => {
        entry(`${account.id} | ${account.service}`);
        field('Total', money(account.total_amount));
        field('Recorded payments', money(account.paid_amount));
        field('Balance', money(account.balance_amount));
        field('Status', account.status);
        y += 2;
      });
      section('Payment History', payments.length);
      if (!payments.length) text('No payments have been recorded for this patient.');
      payments.forEach(payment => {
        entry(`${date(payment.paymentDate)} | ${payment.orNumber || payment.id}`);
        field('Treatment / Plan', payment.service || payment.category);
        field('Amount', String(payment.amount || '').replace(/₱/g, 'PHP '));
        field('Method', payment.method);
        field('Status', payment.status === 'approved' ? 'Recorded' : payment.status);
        if (payment.note) field('Notes', payment.note);
        y += 2;
      });
    } else {
    const records = Array.isArray(data.records) ? data.records : [];
    const appointments = Array.isArray(data.appointments) ? data.appointments : [];
    section('Clinical Treatment Records', records.length);
    if (!records.length) text('No clinical treatment records are on file.');
    records.forEach((record, index) => {
      entry(`${String(index + 1).padStart(2, '0')}   |   ${date(record.date_recorded)}`);
      field('Dentist', record.dentist_name || 'Not recorded');
      field('Diagnosis', record.diagnosis);
      field('Treatment', record.treatment_given);
      field('Notes / protocol', record.treatment_protocol);
      y += 2;
    });
    section('Appointment History', appointments.length);
    if (!appointments.length) text('No appointments are on file.');
    appointments.forEach((appointment, index) => {
      entry(`${String(index + 1).padStart(2, '0')}   |   ${date(appointment.scheduled_date)}   ${String(appointment.scheduled_time || '').slice(0, 5)}`);
      field('Service', appointment.service_type);
      field('Status', String(appointment.status || 'Not recorded').replace(/_/g, ' ').replace(/^./, char => char.toUpperCase()));
      field('Dentist', appointment.dentist_name || 'Not recorded');
      y += 2;
    });
    }
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...muted);
      pdf.setDrawColor(218, 216, 204);
      pdf.line(margin, height - 19, width - margin, height - 19);
      pdf.setFontSize(7);
      pdf.text('Generated: ' + generated + ' (Asia/Manila)', margin, height - 13);
      pdf.text(`${page} / ${pages}`, width - margin, height - 13, { align: 'right' });
    }
    const filename = (name || 'patient').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'patient';
    pdf.save(`${billing ? 'patient-billing' : 'patient-chart'}-P${patient.patient_id}-${filename}.pdf`);
  };
})();
