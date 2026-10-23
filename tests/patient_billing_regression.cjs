const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
async function run(chart) {
  const elements = new Map(), calls = [], events = {};
  const get = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', dataset: {}, classList: { contains: () => true }, addEventListener() {}, scrollIntoView() {} });
    return elements.get(id);
  };
  const ctx = {
    URLSearchParams, location: { search: '?patient_id=2', hash: '#billing' }, ASDCAuthUser: { role: 'receptionist' },
    ASDC: { HtmlHelpers: { escapeHtml: value => value.replace(/</g, '&lt;'), formatDate: value => value } },
    MutationObserver: class { observe() {} },
    document: { getElementById: get, body: { classList: { contains: () => chart } } },
    addEventListener: (name, fn) => { events[name] = fn; },
    apiFetch: async url => {
      calls.push(url);
      return chart ? {
        accounts: [{ id: 'T-1', service: 'Cleaning', total_amount: 500, paid_amount: 100, balance_amount: 400, pending_amount: 50, status: 'active' }],
        payments: [{ paymentDate: '2026-10-23', amount: 'PHP 100', service: 'Cleaning', method: 'Cash', status: 'approved', orNumber: 'OR-T1', note: '<private>' }]
      } : { patients: [{ patient_id: 2, patient: 'Billing Test', paid_amount: 100, balance_amount: 400, pending_amount: 50 }] };
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/js/core/PatientBilling.js'), 'utf8'), ctx);
  await new Promise(resolve => setImmediate(resolve));
  if (chart) {
    assert(calls[0].endsWith('view=patient&patient_id=2'));
    assert.equal(get('view-payments').dataset.patientId, '2', 'Modal must be scoped to this patient.');
    assert(get('patientBillingTotals').innerHTML.includes('Outstanding balance'));
    assert(get('patientPaymentHistory').innerHTML.includes('OR-T1'));
    assert(get('patientPaymentHistory').innerHTML.includes('&lt;private>'), 'Escape user-entered notes.');
    assert(get('patientBillingAccounts').innerHTML.includes('Cleaning'));
  } else {
    assert(calls[0].endsWith('view=patients'));
    assert(get('patientBillingBody').innerHTML.includes('patient_id=2#billing'));
    assert(get('patientBillingBody').innerHTML.includes('Billing Test'));
  }
  events['staff-payment-recorded']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2, 'Refresh the ledger after payment entry.');
}
(async () => { await run(false); await run(true); console.log('PASS: patient billing directory, scoped ledger, totals, complete payment history, escaped notes and post-payment refresh.'); })().catch(error => { console.error(error); process.exitCode = 1; });
