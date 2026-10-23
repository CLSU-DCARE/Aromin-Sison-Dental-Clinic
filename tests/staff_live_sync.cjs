const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const timers = new Map(), events = {}, statuses = [], applied = [];
let seq = 0, calls = 0, pendingResolve;
let response = { week: { appointments: [], requests: [] }, notifications: [] };
const ctx = {
  document: { hidden: false, addEventListener: (name, fn) => { events[name] = fn; }, removeEventListener: name => { delete events[name]; } },
  addEventListener: (name, fn) => { events[name] = fn; }, removeEventListener: name => { delete events[name]; },
  setTimeout: (fn, delay) => { timers.set(++seq, { fn, delay }); return seq; }, clearTimeout: id => timers.delete(id)
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/js/core/ClinicLiveSync.js'), 'utf8'), ctx);
const sync = new ctx.ClinicLiveSync({
  validate: data => Array.isArray(data.week?.requests),
  fetchSnapshot: async () => { calls++; if (response instanceof Error) throw response; return response; },
  applySnapshot: (data, changed, keys) => applied.push({ data, changed, keys }), onStatus: status => statuses.push(status)
});
(async () => {
  sync.start(); await sync.pending;
  assert.equal(calls, 1); assert.equal(applied.length, 1); assert.equal(applied[0].changed, false);
  assert.equal([...timers.values()][0].delay, 10000);
  await sync.refresh(); assert.equal(applied.length, 1, 'Unchanged data must not redraw the page.');
  response = { ...response, week: { appointments: [], requests: [{ request_id: 2, status: 'pending' }] } };
  await sync.refresh(); assert.equal(applied.length, 2); assert.equal(applied[1].changed, true);
  assert.deepEqual([...applied[1].keys], ['week'], 'Only the changed section should redraw.');
  const good = response;
  response = new Error('offline'); await sync.refresh();
  assert.equal(applied.length, 2, 'Connection errors must preserve the last good display.');
  assert.equal(statuses.at(-1), 'reconnecting');
  assert.equal([...timers.values()][0].delay, 20000);
  response = good; events.online(); await sync.pending;
  assert.equal(statuses.at(-1), 'live'); assert.equal(applied.length, 2);
  ctx.document.hidden = true; events.visibilitychange();
  assert.equal(timers.size, 0); const before = calls;
  await sync.refresh(); assert.equal(calls, before, 'Hidden tabs must stop polling.');
  ctx.document.hidden = false; events.visibilitychange(); await sync.pending;
  assert.equal(calls, before + 1, 'Returning to the tab must refresh immediately.');
  sync.fetchSnapshot = () => { calls++; return new Promise(resolve => { pendingResolve = resolve; }); };
  const first = sync.refresh(), second = sync.refresh();
  assert.equal(first, second, 'Refreshes must not overlap.');
  sync.stop(); pendingResolve({ ...good, notifications: [{ title: 'Late response' }] }); await first;
  assert.equal(applied.length, 2, 'Responses received after stopping must be ignored.');
  assert.equal(timers.size, 0);
  sync.fetchSnapshot = async () => { throw Object.assign(new Error('expired'), { status: 401 }); };
  sync.start(); await sync.pending;
  assert.equal(sync.running, false); assert.equal(statuses.at(-1), 'signed-out');
  console.log('PASS: automatic updates, unchanged data, reconnect/backoff, visibility, request deduplication, stopping, and session expiration.');
})().catch(error => { console.error(error); process.exitCode = 1; });
