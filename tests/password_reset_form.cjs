// Execute the page's initialization and submit handler without sending an email.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const nodes = new Map(), ready = [], requests = [], alerts = [];
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {
    hidden: true, value: '', handlers: {}, textContent: '',
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { this.handlers[type] = fn; },
    querySelector(selector) { return selector === '.btn-block' ? node('submit') : node('forgotEmail'); },
    querySelectorAll() { return []; }, focus() {}
  });
  return nodes.get(id);
}
let payload = { success: true };
const ctx = {
  URLSearchParams, AbortController, setTimeout, clearTimeout,
  location: { search: '' },
  document: {
    getElementById: node, body: node('body'),
    addEventListener(type, fn) { if (type === 'DOMContentLoaded') ready.push(fn); },
    removeEventListener() {}
  },
  fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => payload }; },
  ASDC: {
    AlertManager: { show: message => alerts.push(message), hide() {}, setLoading() {} },
    FormValidator: { validateForm: () => true, initLiveValidation() {} },
    PasswordToggle: { init() {} }, AuthPageGuard: { init() {} }
  }
};
ctx.window = ctx;
vm.createContext(ctx);
for (const file of ['shared/js/core/Modal.js', 'auth/assets/js/AuthApiClient.js', 'auth/assets/js/auth.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
}
const html = fs.readFileSync(path.join(root, 'auth/forgot-password.html'), 'utf8');
for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script, ctx);
for (const init of ready) init();
assert.equal(ctx.Modal, undefined, 'Auth must work without the dashboard-only global Modal alias.');
const submit = node('panel-forgot').handlers.submit;
assert.equal(typeof submit, 'function', 'The page must register its submit handler.');
(async () => {
  let prevented = false;
  node('forgotEmail').value = 'patient@example.invalid';
  await submit({ preventDefault() { prevented = true; } });
  assert.ok(prevented, 'Submission must not navigate to ?email=...');
  assert.equal(requests[0].url, '../backend/api/auth/forgot-password.php');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(JSON.parse(requests[0].options.body).email, 'patient@example.invalid');
  assert.equal(node('recoveryModal').hidden, false);
  node('recoveryModal').hidden = true;
  payload = {};
  await submit({ preventDefault() {} });
  assert.equal(node('recoveryModal').hidden, true, 'An invalid response must not claim the email was sent.');
  assert.ok(alerts.length);
  console.log('PASS: page initializes, intercepts submit, calls reset API by POST, and only shows confirmation for a successful response.');
})().catch(error => { console.error(error); process.exitCode = 1; });
