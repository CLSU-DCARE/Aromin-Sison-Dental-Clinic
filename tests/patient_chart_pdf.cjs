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
ctx.jspdf = null;
assert.throws(() => ctx.ASDC.downloadPatientChartPDF({}), /PDF download is unavailable/);
console.log('PASS: A4 PDF layout, multi-page notes, complete history, filename, page numbering and missing-library handling.');
