const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const events = {}, requests = [], applied = [];
const data = {
  week: { appointments: [], requests: [] }, pending: [], patients: [], contracts: [], records: [],
  notifications: [], metrics: [], payments: [], inventory: [],
  reports: Object.fromEntries(['this_week', 'last_week', 'this_month'].map(key => [key, { rows: [], bars: [] }]))
};
const ctx = {
  ASDC: {}, ASDCAuthUser: { role: 'receptionist' }, AbortController,
  document: { hidden: false, createElement: () => ({ setAttribute() {} }), body: { appendChild() {} }, addEventListener() {}, removeEventListener() {} },
  addEventListener: (name, handler) => { events[name] = handler; }, removeEventListener() {},
  setTimeout: () => 1, clearTimeout() {},
  apiFetch: () => new Promise(resolve => requests.push(resolve))
};
ctx.window = ctx;
vm.createContext(ctx);
for (const file of ['ClinicLiveSync.js', 'PortalSync.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/js/core', file), 'utf8'), ctx);
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const sync = ctx.ASDC.startPortalSync({ apply: (snapshot, keys) => applied.push([...keys]) });
  const first = sync.refetch();
  assert.equal(sync.refetch(), first, 'Duplicate save handlers must share a refresh.');
  assert.equal(requests.length, 1, 'An active poll must finish before the follow-up.');
  requests[0](data); await tick();
  assert.equal(requests.length, 2, 'Only one follow-up should be queued.');
  requests[1](data); await first;
  const next = sync.refetch();
  assert.equal(sync.refetch(), next);
  await tick();
  assert.equal(requests.length, 3, 'Same-tick refreshes should produce one request.');
  const midflight = sync.refetch();
  assert.equal(midflight, next);
  requests[2]({ ...data, notifications: [{ title: 'Update' }] }); await tick();
  assert.equal(requests.length, 4, 'A later save during fetching needs a fresh follow-up.');
  requests[3]({ ...data, notifications: [{ title: 'Latest' }] }); await next;
  assert.deepEqual(applied.at(-1), ['notifications'], 'Unchanged tables must not redraw.');
  sync.stop();
  console.log('PASS: coalesced save refreshes, one follow-up after polling, mid-request writes and selective dashboard redraws.');
})().catch(error => { console.error(error); process.exitCode = 1; });
