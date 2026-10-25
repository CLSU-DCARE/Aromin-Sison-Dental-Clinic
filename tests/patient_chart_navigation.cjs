const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const events = {}, documentEvents = {}, frames = [];
const app = { inert: false, patientRows: ['Existing patient'], search: 'test search', scroll: 480 };
const classes = new Set();
let backCalls = 0, focused = false, prevented = false, storedState;
const link = { href: 'https://clinic.test/admin-system/patient-chart.html?patient_id=10', focus: () => { focused = true; } };
const ctx = {
  URL,
  location: { href: 'https://clinic.test/admin-system/dashboard.html#patients', origin: 'https://clinic.test' },
  document: {
    title: 'Staff Dashboard', querySelector: () => app,
    addEventListener: (name, handler) => { documentEvents[name] = handler; },
    createElement: () => {
      const frame = { contentWindow: {}, remove() { frame.removed = true; }, addEventListener() {}, focus() {} };
      frames.push(frame); return frame;
    },
    body: { appendChild() {}, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } }
  },
  history: { pushState: state => { storedState = state; }, back: () => { backCalls++; } },
  addEventListener: (name, handler) => { events[name] = handler; },
  fetch: () => { throw new Error('Returning must not fetch the dashboard again.'); }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin-system/assets/js/PatientChartNavigation.js'), 'utf8'), ctx);
const click = overrides => documentEvents.click({ target: { closest: () => link }, button: 0, preventDefault() { prevented = true; }, ...overrides });
click({ ctrlKey: true });
assert.equal(frames.length, 0, 'Modified clicks must keep normal new-tab navigation.');
click();
assert(prevented);
assert.equal(frames.length, 1);
assert.equal(app.inert, true);
assert.equal(storedState.patientChartPath, '/admin-system/patient-chart.html?patient_id=10');
events.message({ origin: 'https://untrusted.test', source: frames[0].contentWindow, data: { type: 'asdc:patient-chart-back' } });
assert.equal(backCalls, 0, 'Ignore untrusted back messages.');
events.message({ origin: ctx.location.origin, source: frames[0].contentWindow, data: { type: 'asdc:patient-chart-back' } });
assert.equal(backCalls, 1);
assert(frames[0].removed);
assert.equal(app.inert, false);
assert.equal(app.search, 'test search');
assert.equal(app.scroll, 480);
assert.deepEqual(app.patientRows, ['Existing patient']);
assert(focused, 'Restore focus to View Records without scrolling.');
events.popstate({ state: storedState });
assert.equal(frames.length, 2, 'Browser Forward must reopen the chart.');
events.popstate({ state: null });
assert(frames[1].removed, 'Browser Back must restore the existing list synchronously.');
assert.equal(app.inert, false);
link.href = 'https://clinic.test/admin-system/patient-chart.html?patient_id=99&archived=1';
click();
assert(storedState.patientChartPath.endsWith('patient_id=99&archived=1'));
events.popstate({ state: null });
events.popstate({ state: storedState });
assert(frames.at(-1).src.endsWith('patient_id=99&archived=1'), 'Forward must preserve archived record mode.');
console.log('PASS: instant chart return without a dashboard request, preserved list/search/scroll, browser Back/Forward, modified clicks and message validation.');
