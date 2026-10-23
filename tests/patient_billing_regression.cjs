const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
async function run(chart, appointmentOnly = false) {
  const elements = new Map(), calls = [], events = {};
  const filters = ['all', 'balance', 'settled'].map(value => ({ dataset: { billingFilter: value }, classList: { toggle() {} }, setAttribute() {}, addEventListener(name, fn) { this.click = fn; } }));
  const get = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', dataset: {}, classList: { contains: () => true }, addEventListener(name, fn) { this[name] = fn; }, scrollIntoView() {} });
    return elements.get(id);
  };
  const ctx = {
    URLSearchParams, location: { search: '?patient_id=2', hash: appointmentOnly ? '' : '#billing' }, ASDCAuthUser: { role: 'receptionist' },
    ASDC: { HtmlHelpers: { escapeHtml: value => value.replace(/</g, '&lt;'), formatDate: value => value } },
    MutationObserver: class { observe() {} },
    document: { getElementById: get, querySelectorAll: () => chart ? [] : filters, body: { classList: { contains: () => chart } } },
    addEventListener: (name, fn) => { events[name] = fn; },
    apiFetch: async url => {
      calls.push(url);
      return chart ? {
        accounts: [{ id: 'T-1', service: 'Cleaning', total_amount: 500, paid_amount: 100, balance_amount: 400, pending_amount: 50, status: 'active' }],
        payments: [{ paymentDate: '2026-10-23', amount: 'PHP 100', service: 'Cleaning', method: 'Cash', status: 'approved', orNumber: 'OR-T1', note: '<private>' }]
      } : { patients: [{ patient_id: 2, patient: 'Billing Test', paid_amount: 100, balance_amount: 400, pending_amount: 50, accounts: 1 }, { patient_id: 3, patient: 'Settled Test', paid_amount: 500, balance_amount: 0, pending_amount: 0, accounts: 1 }] };
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/js/core/PatientBilling.js'), 'utf8'), ctx);
  if (appointmentOnly) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/js/core/StaffPayments.js'), 'utf8'), ctx);
    assert.equal(calls.length, 0, 'Appointment records must not fetch billing or initialise payment entry.');
    assert.equal(ctx.ASDC.exportPatientBilling, undefined);
    return;
  }
  await new Promise(resolve => setImmediate(resolve));
  if (chart) {
    assert(calls[0].endsWith('view=patient&patient_id=2'));
    assert.equal(get('view-payments').dataset.patientId, '2', 'Modal must be scoped to this patient.');
    assert(get('patientBillingTotals').innerHTML.includes('Recorded payments'));
    assert(get('patientBillingTotals').innerHTML.includes('Outstanding balance'));
    assert(!get('patientBillingTotals').innerHTML.includes('Pending'));
    assert(get('patientPaymentHistory').innerHTML.includes('OR-T1'));
    assert(get('patientPaymentHistory').innerHTML.includes('&lt;private>'), 'Escape user-entered notes.');
    assert(get('patientBillingAccounts').innerHTML.includes('Cleaning'));
  } else {
    assert(calls[0].endsWith('view=patients'));
    assert(get('patientBillingBody').innerHTML.includes('patient_id=2#billing'));
    assert(get('patientBillingBody').innerHTML.includes('Billing Test'));
    filters[1].click();
    assert(get('patientBillingBody').innerHTML.includes('Billing Test'));
    assert(!get('patientBillingBody').innerHTML.includes('Settled Test'));
    filters[2].click();
    assert(get('patientBillingBody').innerHTML.includes('Settled Test'));
    assert(!get('patientBillingBody').innerHTML.includes('Billing Test'));
    get('billingPatientSearch').value = 'Billing Test';
    get('billingPatientSearch').input();
    assert(get('patientBillingBody').innerHTML.includes('No patients found'));
    filters[0].click();
    assert(get('patientBillingBody').innerHTML.includes('Billing Test'));
    assert(!get('patientBillingBody').innerHTML.includes('Settled Test'));
  }
  events['staff-payment-recorded']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2, 'Refresh the ledger after payment entry.');
}
(async () => { await run(false); await run(true); await run(true, true); console.log('PASS: patient billing directory, scoped ledger, totals, complete payment history, escaped notes, post-payment refresh and appointment-only records.'); })().catch(error => { console.error(error); process.exitCode = 1; });
