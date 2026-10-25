const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let options, filename, pages = 1;
const rendered = [];
class PDF {
  constructor(config) { options = config; this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }; }
  setFont() {} setFontSize() {} setDrawColor() {} line() {} setPage() {}
  setTextColor() {} setFillColor() {} rect() {}
  splitTextToSize(value) { return value.match(/.{1,75}/g) || ['']; }
  text(value, x, y) { assert(y <= 285, 'Text extends beyond A4 margins.'); rendered.push(value); }
  addPage() { pages++; }
  getNumberOfPages() { return pages; }
  save(value) { filename = value; }
}
const ctx = { ASDC: { HtmlHelpers: { formatDate: value => value } }, jspdf: { jsPDF: PDF } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin-system/assets/js/PatientChartPDF.js'), 'utf8'), ctx);
ctx.ASDC.downloadPatientChartPDF({
  patient: { patient_id: 42, first_name: 'PDF', last_name: 'Test', contact_number: '09123456789' },
  records: Array.from({ length: 20 }, (_, index) => ({ date_recorded: '2026-10-23', diagnosis: 'Diagnosis ' + index, treatment_given: 'Cleaning', treatment_protocol: 'Detailed notes '.repeat(60) + 'END OF RECORD ' + index })),
  appointments: [{ scheduled_date: '2026-10-23', scheduled_time: '10:30:00', service_type: 'Checkup', status: 'completed' }]
});
assert.equal(options.format, 'a4');
assert.equal(options.orientation, 'portrait');
assert.equal(filename, 'patient-chart-P42-pdf-test.pdf');
assert(pages > 1, 'Long records must continue across multiple pages.');
const output = rendered.join('');
assert(output.includes('END OF RECORD 19'), 'Last clinical note was truncated.');
assert(output.includes('Checkup'), 'Appointment history missing.');
assert(output.includes(`${pages} / ${pages}`), 'Page numbering missing.');
rendered.length = 0;
pages = 1;
ctx.ASDC.downloadPatientChartPDF({
  patient: { patient_id: 42, first_name: 'PDF', last_name: 'Test' },
  records: [{ diagnosis: 'DO NOT INCLUDE CLINICAL HISTORY' }],
  appointments: [{ service_type: 'DO NOT INCLUDE APPOINTMENTS' }]
}, { billing: {
  accounts: [{ id: 'C-1', service: 'Braces plan', total_amount: 1000, paid_amount: 200, balance_amount: 800, status: 'active' }],
  payments: [{ id: 'C-2', orNumber: 'OR-TEST', paymentDate: '2026-10-23', category: 'Braces', amount: 'PHP 200.00', method: 'Cash', status: 'approved' }]
} });
const statement = rendered.join('');
assert.equal(filename, 'patient-billing-P42-pdf-test.pdf');
assert(statement.includes('Billing Statement') && statement.includes('OR-TEST') && statement.includes('800.00'));
assert(!statement.includes('Appointment') && !statement.includes('Clinical') && !statement.includes('DO NOT INCLUDE'));
rendered.length = 0;
pages = 1;
ctx.ASDC.downloadPatientChartPDF({ patient: { patient_id: 42, first_name: 'PDF', last_name: 'Test' } }, { billing: {
  accounts: [],
  payments: Array.from({ length: 35 }, (_, index) => ({ id: 'T-' + index, paymentDate: '2026-10-23', amount: 'PHP 100.00', method: 'Cash', status: 'approved', category: 'Treatment', note: 'Payment details '.repeat(25) + 'LAST NOTE ' + index }))
} });
assert(pages > 1, 'Long billing histories must paginate.');
assert(rendered.join('').includes('LAST NOTE 34'), 'Billing table truncated the final notes.');
assert(rendered.filter(value => value === 'REFERENCE').length > 1, 'Repeat payment table headings on continued pages.');
ctx.jspdf = null;
assert.throws(() => ctx.ASDC.downloadPatientChartPDF({}), /PDF download is unavailable/);
console.log('PASS: A4 PDF layout, multi-page notes, complete history, filename, page numbering and missing-library handling.');
