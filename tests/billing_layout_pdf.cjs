const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let root, options, filename, pages = 1, hiddenButtons = false;
const images = [];
const profile = { cloneNode: () => ({ kind: 'patient-profile' }) };
const billing = { cloneNode: () => ({ kind: 'billing-only' }) };
let chartExport = false;
const ctx = {
  ASDC: {},
  document: {
    fonts: { ready: Promise.resolve() },
    querySelector: () => profile,
    getElementById: id => id === 'view-payments' ? billing : { cloneNode: () => ({ kind: id }) },
    body: { appendChild(element) { root = element; } },
    createElement(tag) {
      if (tag === 'canvas') return { getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/png;base64,test' };
      return { children: [], style: {}, appendChild(child) { this.children.push(child); }, remove() { this.removed = true; },
        getBoundingClientRect: () => ({ top: 0, height: 2100 }),
        querySelectorAll(selector) {
          if (selector.startsWith('button')) return [{ remove() { hiddenButtons = true; } }];
          return [{ getBoundingClientRect: () => ({ top: 1300, bottom: 1600 }) }];
        }
      };
    }
  },
  html2canvas: async (element, config) => {
    assert.equal(config.windowWidth, 1200, 'Use desktop card layout even when downloading on mobile.');
    assert.deepEqual(element.children.slice(1).map(child => child.kind), chartExport ? ['patient-profile', 'chartClinicalHistory', 'chartAppointmentHistory'] : ['patient-profile', 'billing-only']);
    config.onclone({}, element);
    return { width: 2000, height: 4200 };
  },
  jspdf: { jsPDF: class {
    constructor(config) { options = config; this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }; }
    addPage() { pages++; }
    addImage(...args) { images.push(args); }
    setPage() {} setFont() {} setFontSize() {} setTextColor() {} text() {}
    save(value) { filename = value; }
  } }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin-system/assets/js/BillingLayoutPDF.js'), 'utf8'), ctx);
(async () => {
  await ctx.ASDC.downloadBillingLayoutPDF({ patient_id: 2, first_name: 'Layout', last_name: 'Test' });
  assert.equal(options.format, 'a4');
  assert.equal(filename, 'patient-billing-P2-layout-test.pdf');
  assert.equal(pages, 2);
  assert.equal(images[0][4], 190);
  assert.equal(images[0][5], 247, 'Move page break above a card/row instead of cutting it.');
  assert(hiddenButtons, 'Exclude action buttons from PDF.');
  assert(root.removed, 'Remove the temporary export copy.');
  chartExport = true;
  await ctx.ASDC.downloadPatientChartLayoutPDF({ patient_id: 2, first_name: 'Layout', last_name: 'Test' });
  assert.equal(filename, 'patient-chart-P2-layout-test.pdf');
  ctx.html2canvas = async () => { throw new Error('capture failed'); };
  await assert.rejects(ctx.ASDC.downloadBillingLayoutPDF({ patient_id: 2 }), /capture failed/);
  assert(root.removed, 'Clean up the temporary copy after a failed export.');
  console.log('PASS: export actual patient/billing layout only, A4 sizing, desktop layout on mobile, safe page breaks, hidden buttons and cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
