const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-23T02:10:00Z'])); } }
const ctx = { Date: Clock, document: { querySelectorAll: () => [] } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/js/core/AppointmentTimes.js'), 'utf8'), ctx);
const times = ctx.ASDC.AppointmentTimes;
const php = fs.readFileSync(path.join(__dirname, '../backend/classes/AppointmentTimes.php'), 'utf8');
const server = [...php.match(/public const TIMES = \[([^\]]+)\]/)[1].matchAll(/'(\d{2}:\d{2})'/g)].map(match => match[1]);
assert.deepEqual([...times.times], server, 'Frontend and backend choices must match.');
assert(times.options().includes('Morning') && times.options().includes('Afternoon'));
assert(times.options().includes('9:00 AM') && times.options().includes('2:30 PM'));
assert(!times.allows('21:00') && !times.allows('09:15') && !times.allows('09:00:01'));
const select = {
  options: [],
  get value() { return this.options.find(option => option.selected)?.value || ''; },
  set value(value) { this.options.forEach(option => { option.selected = option.value === value; }); },
  set innerHTML(value) { this.options = [...value.matchAll(/<option value="([^"]*)"([^>]*)>/g)].map(match => ({ value: match[1], selected: match[2].includes('selected'), disabled: false })); }
};
select.innerHTML = times.options('09:30');
times.populate(select, '2026-10-23');
assert.equal(select.value, '', 'Clear a selected time that already passed.');
assert(select.options.find(option => option.value === '10:00').disabled);
assert(!select.options.find(option => option.value === '10:30').disabled);
times.populate(select, '2026-10-24');
assert(select.options.every(option => !option.disabled), 'Future dates must restore allowed choices.');
console.log('PASS: fixed AM/PM choices, client/server parity, invalid time rejection, Manila same-day past times and date changes.');
