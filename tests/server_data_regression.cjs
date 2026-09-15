// Run with: node tests/server_data_regression.cjs
// No database, network requests, or third-party packages are required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function element(value = '') {
  const classes = new Set();
  return {
    value, hidden: false, disabled: false, textContent: '', innerHTML: '', style: {}, dataset: {}, handlers: {},
    classList: { add: (...v) => v.forEach(x => classes.add(x)), remove: (...v) => v.forEach(x => classes.delete(x)), contains: v => classes.has(v), toggle: (v, on) => on ? classes.add(v) : classes.delete(v) },
    addEventListener(type, fn) { this.handlers[type] = fn; },
    setAttribute() {}, focus() {}, querySelector() { return element(); }, querySelectorAll() { return []; }
  };
}
function context() {
  const elements = new Map(), messages = [];
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const ctx = {
    ASDC: {}, console, Date, URLSearchParams, FormData, get, messages,
    document: { getElementById: get, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem() { throw Error('Legacy data must not be read'); }, setItem() { throw Error('Legacy data must not be written'); } },
    showToast: (message, kind) => messages.push({ message, kind }), announce: message => messages.push({ message }),
    escapeHtml: String, nameCell: String, wireChips() {}, setChipGroup() {},
    apiFetch: async () => { throw Error('Unable to process the request.'); },
    Modal: class { constructor() { this.modal = element(); } registerClose() {} open() {} close() {} }
  };
  ctx.window = ctx;
  return vm.createContext(ctx);
}
function load(ctx, file) { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file }); }

(async () => {
  let c = context();
  load(c, 'shared/js/core/api.js');
  for (const body of [null, {}, [], { success: false, error: 'Rejected' }]) {
    c.fetch = async () => ({ ok: true, status: 200, json: async () => body });
    await assert.rejects(() => c.apiFetch('/test'));
  }
  c.fetch = async () => ({ ok: true, status: 200, json: async () => { throw Error('HTML response'); } });
  await assert.rejects(() => c.apiFetch('/test'), /invalid response/);
  c.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { appointments: [] } }) });
  assert.equal((await c.apiFetch('/test')).appointments.length, 0);

  c = context();
  load(c, 'admin-system/assets/js/AppointmentScheduler.js');
  const scheduler = new c.AppointmentScheduler();
  scheduler._render = () => {};
  scheduler.state.appointments = [{ appointment_id: 1 }];
  await scheduler.loadWeek();
  assert.equal(scheduler.state.appointments.length, 0);
  assert.equal(scheduler.state.requests.length, 0);
  assert.equal(c.get('appointmentLoadError').hidden, false);
  assert.ok(scheduler.state.error);
  c.apiFetch = async () => ({ appointments: [{ appointment_id: 17 }], requests: [] });
  await scheduler.loadWeek();
  assert.equal(scheduler.state.appointments[0].appointment_id, 17);
  assert.equal(scheduler.state.error, null);

  c = context();
  load(c, 'admin-system/assets/js/AppointmentActions.js');
  const actions = new c.AppointmentActions({ scheduler: { state: { appointments: [] }, loadWeek() { throw Error('Must not reload on failed action'); } } });
  await assert.rejects(() => actions.run('approve', 'request', 1), /Unable to process/);

  c = context();
  load(c, 'patient-dashboard/assets/js/PatientAppointmentBooking.js');
  const slot = element(); slot.dataset.slot = '9:00 AM';
  c.document.querySelector = selector => selector === '.slot.selected' ? slot : null;
  c.get('bookDate').value = '2026-10-20';
  c.get('bookService').value = 'Consultation';
  c.get('bookDentist').value = 'No preference';
  const state = { schedule: [], dashboard: { upcoming: [] }, profile: {} };
  let booked = false;
  const booking = new c.PatientAppointmentBooking({ state, onBooked: () => { booked = true; } });
  booking.confirmBtn = c.get('confirmBookingBtn'); booking.noteEl = c.get('bookingNote');
  booking._initConfirm();
  await booking.confirmBtn.handlers.click();
  assert.equal(booked, false);
  assert.equal(state.schedule.length, 0);
  assert.ok(booking.noteEl.classList.contains('err'));
  assert.equal(c.get('bookDate').value, '2026-10-20');
  c.apiFetch = async () => ({ appointment_id: 18 });
  await booking.confirmBtn.handlers.click();
  assert.equal(booked, true);
  assert.ok(booking.noteEl.classList.contains('ok'));

  c = context();
  load(c, 'patient-dashboard/assets/js/PatientRescheduleModal.js');
  const appt = { appointment_id: 1, date: 'Sep 20, 2026', time: '9:00 AM', status: 'Confirmed' };
  const before = JSON.stringify(appt);
  const reschedule = new c.PatientRescheduleModal({ state: { schedule: [appt] } });
  reschedule.init(); reschedule._selectedIndex = 0;
  c.get('rsDate').value = '2026-10-20'; c.get('rsTime').value = '10:00 AM';
  await c.get('rsSaveBtn').handlers.click();
  assert.equal(JSON.stringify(appt), before);
  assert.ok(c.get('rsNote').classList.contains('err'));

  c = context();
  load(c, 'patient-dashboard/assets/js/PatientPaymentSubmission.js');
  const payment = new c.PatientPaymentSubmission({ state: {} });
  payment._receiptData = 'preview'; payment._receiptFile = new Blob(['receipt']);
  c.get('payAmount').value = '2000';
  payment._initSubmit();
  await c.get('submitPaymentBtn').handlers.click();
  assert.equal(payment._receiptData, 'preview');
  assert.equal(c.get('submitPaymentBtn').disabled, false);
  assert.equal(c.messages.at(-1).kind, 'error');
  await payment.render(); // Must never consult browser payment storage.

  c = context();
  load(c, 'admin-system/assets/js/PaymentApprovalManager.js');
  const approvals = new c.PaymentApprovalManager();
  const submission = { id: 1, status: 'pending', patient: 'API Patient', amount: '2000' };
  await approvals._approve(submission);
  assert.equal(submission.status, 'pending');
  assert.equal(c.messages.at(-1).kind, 'error');
  await approvals.render();
  assert.equal(approvals._items.length, 0);

  c = context();
  load(c, 'admin-system/assets/js/NotificationManager.js');
  const notifications = new c.ASDC.NotificationManager();
  notifications._initSendModal();
  c.get('snPatient').value = '1'; c.get('snBody').value = 'Reminder'; c.get('snChannel').value = 'sms';
  await c.get('sendNotifSave').handlers.click();
  assert.equal(c.get('sendNotifNote').hidden, false);
  assert.ok(!c.messages.some(m => m.message.startsWith('Notification sent')));
  c.apiFetch = async () => ({ success: true, results: [{ channel: 'sms', status: 'failed' }] });
  await c.get('sendNotifSave').handlers.click();
  assert.match(c.get('sendNotifNote').textContent, /could not be delivered/);

  c = context();
  load(c, 'shared/js/core/HtmlHelpers.js'); load(c, 'shared/js/core/ScheduleView.js');
  const week = c.ASDC.ScheduleView.week('2026-09-14', [{ scheduled_date: '2026-09-15', scheduled_time: '09:00:00', patient_name: '<Patient>', service_type: 'Consultation', status: 'confirmed' }]);
  assert.equal(week.rows[0].appts[1].name, '&lt;Patient&gt;');
  assert.equal(week.rows[0].appts[0], null);

  for (const dashboard of ['admin-system', 'patient-dashboard', 'dentist-dashboard']) {
    const html = fs.readFileSync(path.join(root, dashboard, 'dashboard.html'), 'utf8');
    for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      if (/^https?:/.test(src)) continue;
      assert.ok(fs.existsSync(path.resolve(root, dashboard, src.split('?')[0])), 'Missing script: ' + src);
    }
  }
  console.log('PASS: API validation, scheduling, booking, rescheduling, payment submission/approval, notification failures, schedule mapping, and dashboard script references.');
})().catch(error => { console.error(error); process.exitCode = 1; });
