const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

async function scenario({ hostname = 'arominsisondental.vercel.app', role = 'receptionist', recover = false, failure = null, patientId = '2' } = {}) {
  const elements = new Map();
  const listeners = new Map();
  const calls = [];
  let ready, verified = false, attempts = 0, revalidations = 0;
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', value: '', hidden: false, classList: { add() {} }, addEventListener() {} });
    return elements.get(id);
  };
  const ctx = {
    location: { hostname, pathname: '/admin-system/patient-chart.html', search: '?patient_id=' + patientId },
    URLSearchParams, navigator: {},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    document: { getElementById: element, addEventListener(name, handler) { if (name === 'DOMContentLoaded') ready = handler; } },
    addEventListener(name, handler) { listeners.set(name, handler); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const response = (status, payload) => ({ status, ok: status >= 200 && status < 300, json: async () => payload });
      if (url.includes('/auth/me.php')) return response(200, { user: { role } });
      if (url.includes('/auth/csrf-token.php')) return response(200, { csrf_token: 'test-token' });
      assert(verified, 'Chart requested before authentication was confirmed.');
      attempts++;
      if (recover && attempts === 1) return response(401, { success: false, error: { message: 'Expired' } });
      if (failure) return response(failure, { success: false, error: { message: 'Patient not found.' } });
      return response(200, { success: true, data: {
        patient: { patient_id: 2, first_name: 'Chart', last_name: 'Test', is_active: 1 },
        records: [{ date_recorded: '2026-10-01', diagnosis: 'Test diagnosis', treatment_given: 'Cleaning' }],
        appointments: [{ scheduled_date: '2026-10-01', status: 'completed', service_type: 'Cleaning' }]
      } });
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['shared/js/core/namespace.js', 'shared/js/core/api.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  ctx.ASDC.HtmlHelpers = { escapeHtml: value => value, formatDate: value => value };
  ctx.ASDC.SessionGuard = class {
    init() {}
    revalidate() { revalidations++; }
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'admin-system/assets/js/patient-chart.js'), 'utf8'), ctx);
  ready();
  assert.equal(calls.length, 0, 'Chart must wait for the authenticated event.');
  verified = true;
  ctx.dispatchEvent(new ctx.CustomEvent('asdc:authenticated', { detail: { role } }));
  await new Promise(resolve => setImmediate(resolve));
  return { calls, elements, attempts, revalidations };
}

(async () => {
  for (const role of ['receptionist', 'dentist']) {
    const { calls, elements } = await scenario({ role });
    assert.equal(calls[0].url, 'https://asdc-api-production.up.railway.app/backend/api/patients/details.php?patient_id=2');
    assert.equal(calls[0].options.credentials, 'include', 'Production API must receive session cookies.');
    assert.equal(elements.get('patientName').textContent, 'Chart Test');
    assert.equal(elements.get('recordCount').textContent, 1);
    assert.equal(elements.get('appointmentCount').textContent, 1);
    assert(elements.get('recordsList').innerHTML.includes('Test diagnosis'));
    assert(elements.get('appointmentsList').innerHTML.includes('Cleaning'));
    assert.equal(elements.get('chartMessage').hidden, true);
  }
  const local = await scenario({ hostname: 'localhost' });
  assert.equal(local.calls[0].options.credentials, 'same-origin');
  assert.equal(local.calls[0].url, '../backend/api/patients/details.php?patient_id=2');
  const recovered = await scenario({ recover: true });
  assert.equal(recovered.attempts, 2);
  assert.equal(recovered.elements.get('patientName').textContent, 'Chart Test');
  const missing = await scenario({ failure: 404 });
  assert.equal(missing.elements.get('chartMessage').textContent, 'Patient not found.');
  assert.equal(missing.elements.get('patientName').textContent, 'Patient chart unavailable');
  const unauthorized = await scenario({ failure: 403 });
  assert.equal(unauthorized.elements.get('chartMessage').textContent, 'Your account is not authorized to view patient charts.');
  const expired = await scenario({ failure: 401 });
  assert.equal(expired.revalidations, 1);
  const invalid = await scenario({ patientId: 'invalid' });
  assert.equal(invalid.calls.length, 0);
  console.log('PASS: patient chart authentication ordering, production/local API routing, cookies, both roles, session recovery, history rendering and error handling.');
})().catch(error => { console.error(error); process.exitCode = 1; });
