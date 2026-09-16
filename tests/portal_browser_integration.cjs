// Real Edge browser contexts, real Apache/PHP/MySQL, no third-party packages.
// Run: node tests/portal_browser_integration.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const php = 'C:\\xampp\\php\\php.exe';
const key = randomBytes(8).toString('hex');
const fixture = (action) => execFileSync(php, [path.join(__dirname, 'portal_fixtures.php'), action, key], { cwd: root, encoding: 'utf8' });
const base = 'http://127.0.0.1/Aromin-Sison-Dental-Clinic/';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let edge, ws, profile, browserLog = '';
const errors = [];
(async () => {
  const { accounts: a, date } = JSON.parse(fixture('create'));
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dcare-browser-'));
  edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir=' + profile,'about:blank'], { windowsHide: true, stdio: ['ignore','ignore','pipe'] });
  edge.stderr.on('data', data => { browserLog = (browserLog + data).slice(-3000); });
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    const timeout = setTimeout(() => reject(Error('Edge DevTools did not start')), 15000);
    edge.stderr.on('data', data => { log += data; const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    edge.on('error', reject);
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0; const waiting = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const item = waiting.get(message.id); if (!item) return; waiting.delete(message.id); clearTimeout(item.timer); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  };
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => { waiting.delete(id); reject(Error('CDP timeout: ' + method)); }, 20000); waiting.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  }
  async function evaluate(session, expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, session);
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(session, expression, message) {
    for (let i = 0; i < 100; i++) { if (await evaluate(session, expression)) return; await delay(150); }
    throw Error(message);
  }
  const sessions = {};
  for (const role of Object.keys(a)) {
    console.log('Opening isolated ' + role + ' portal.');
    const { browserContextId } = await send('Target.createBrowserContext');
    const { targetId } = await send('Target.createTarget', { url: base + 'auth/login.html', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    sessions[role] = sessionId;
    await send('Runtime.enable', {}, sessionId);
    await waitFor(sessionId, 'document.readyState === "complete"', 'Login page did not load');
    const login = await evaluate(sessionId, `(async()=>{const r=await fetch('../backend/api/auth/login.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({ email: a[role].email, password: a[role].password })})});return r.status})()`);
    assert.equal(login, 200, 'Role login failed: ' + role);
    const portal = role === 'receptionist' ? 'admin-system' : role.includes('dentist') ? 'dentist-dashboard' : 'patient-dashboard';
    await send('Page.navigate', { url: base + portal + '/dashboard.html' }, sessionId);
    await waitFor(sessionId, 'document.querySelector("#portalSyncStatus,#patientSyncStatus")?.textContent === "Updates automatically"', 'Portal did not become live: ' + role + ' ' + errors.join('\n'));
  }
  const p = sessions.patient, r = sessions.receptionist, d = sessions.dentist, o = sessions.other, od = sessions.other_dentist;
  await evaluate(d, `document.getElementById('dentistWeekStart').value=${JSON.stringify(date)};document.getElementById('dentistWeekStart').dispatchEvent(new Event('change'))`);
  const api = (session, route, method = 'GET', body) => evaluate(session, `(async()=>{try{return {status:200,data:await apiFetch('../backend/api/${route}',${JSON.stringify({ method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })})}}catch(e){return {status:e.status,message:e.message}}})()`);
  const okay = async (...args) => { const result = await api(...args); assert.equal(result.status, 200, result.message); return result.data; };
  await evaluate(p, `document.getElementById('bookDate').value=${JSON.stringify(date)};document.getElementById('bookService').value='Consultation';document.getElementById('bookDentist').value=${JSON.stringify(a.dentist.name)};document.querySelector('[data-slot="9:00 AM"]').click();document.getElementById('confirmBookingBtn').click()`);
  await waitFor(p, 'document.getElementById("bookingNote").textContent.includes("Booking request sent")', 'Patient booking UI failed');
  const own = await okay(p, 'patients/dashboard.php');
  const id = own.appointments.schedule[0].appointment_id;
  await waitFor(r, `!!document.querySelector('[data-appointment-id="${id}"][data-appointment-action="approve"]')`, 'Receptionist did not receive patient request');
  await waitFor(d, `!!document.querySelector('[data-id="${id}"][data-clinical-action="approve"]')`, 'Dentist did not receive patient request');
  assert.equal((await api(o, 'patients/appointments.php', 'PATCH', { appointment_id: id, action: 'cancel' })).status, 404);
  assert.equal((await api(od, 'appointments/actions.php', 'POST', { appointment_id: id, action: 'approve' })).status, 403);
  assert.equal((await api(p, 'appointments/dashboard.php')).status, 403);
  assert.equal((await api(p, 'patients/appointments.php', 'POST', { service_type:'Consultation',preferred_dentist:a.dentist.name,scheduled_date:date,scheduled_time:'09:00' })).status, 409);
  await evaluate(r, `document.querySelector('[data-appointment-id="${id}"][data-appointment-action="approve"]').click()`);
  await waitFor(r, '!!document.querySelector("dialog select[name=dentist_id]")', 'Assignment form did not open');
  await evaluate(r, `document.querySelector('dialog select').value='${a.dentist.user_id}';document.querySelector('dialog form').requestSubmit()`);
  await waitFor(p, 'document.getElementById("scheduleBody").textContent.includes("Confirmed")', 'Patient approval display did not update');
  await waitFor(d, `document.getElementById('dentistAppointmentActions').textContent.includes('confirmed')`, 'Dentist approval display did not update');
  await okay(r, 'appointments/actions.php', 'PATCH', { appointment_id:id, action:'reschedule', scheduled_date:date, scheduled_time:'09:30' });
  await waitFor(p, 'document.getElementById("scheduleBody").textContent.includes("9:30 AM")', 'Patient rescheduled time missing');
  await waitFor(d, 'document.getElementById("dentistAppointmentActions").textContent.includes("09:30:00")', 'Dentist rescheduled time missing');
  await okay(p, 'patients/appointments.php', 'PATCH', { appointment_id:id, scheduled_date:date, scheduled_time:'10:00' });
  await waitFor(r, `document.querySelector('#appointmentRequestsBody [data-appointment-id="${id}"][data-appointment-action="approve"]')?.closest('tr')?.textContent.includes('10:00')`, 'Receptionist patient reschedule missing');
  console.log('PASS: booking, approval, cross-role rescheduling and appointment ownership/conflicts.');
  await okay(r, 'appointments/actions.php', 'POST', { appointment_id:id, action:'approve' });
  await evaluate(d, `document.getElementById('addClinicalRecord').click()`);
  await waitFor(d, '!!document.querySelector("dialog textarea[name=treatment_given]")', 'Clinical form did not open');
  await evaluate(d, `document.querySelector('dialog [name=patient_id]').value='${a.patient.patient_id}';document.querySelector('dialog [name=diagnosis]').value='Integration diagnosis';document.querySelector('dialog [name=treatment_given]').value='Integration treatment';document.querySelector('dialog [name=treatment_protocol]').value='Integration clinical notes';document.querySelector('dialog form').requestSubmit()`);
  await waitFor(p, 'document.getElementById("timelineList").textContent.includes("Integration clinical notes")', 'Patient clinical notes missing');
  await waitFor(r, 'document.getElementById("recordsBody").textContent.includes("Integration treatment")', 'Receptionist treatment missing');
  const record = (await okay(d, 'patients/records.php')).records.find(x => x.patient_id == a.patient.patient_id);
  assert.equal((await api(r, 'patients/records.php', 'POST', {patient_id:a.patient.patient_id, treatment_given:'forbidden'})).status,403);
  assert.equal((await api(od, 'patients/records.php', 'PATCH', {patient_id:a.patient.patient_id, record_id:record.record_id, treatment_given:'forbidden'})).status,403);
  assert.equal((await okay(o, 'patients/records.php')).records.length, 0);
  await okay(d, 'patients/records.php', 'PATCH', {patient_id:a.patient.patient_id,record_id:record.record_id,diagnosis:'Updated diagnosis',treatment_given:'Updated treatment',treatment_protocol:'Updated notes'});
  await waitFor(p, 'document.getElementById("timelineList").textContent.includes("Updated notes")', 'Patient record edit missing');
  await waitFor(r, 'document.getElementById("recordsBody").textContent.includes("Updated treatment")', 'Receptionist record edit missing');
  await okay(d, 'appointments/actions.php', 'POST', { appointment_id:id, action:'complete' });
  await waitFor(p, 'document.getElementById("historyBody").textContent.includes("Completed")', 'Patient completed appointment missing');
  // Selected staff week may differ from the fixture date, so inspect its snapshot and calendar explicitly.
  await evaluate(r, `appointmentScheduler.state.start=${JSON.stringify(date)};staffLiveSync.refetch()`);
  await waitFor(r, 'document.getElementById("apptWeekGrid").textContent.includes("completed")', 'Receptionist completion missing');
  console.log('PASS: treatment create/edit and dentist completion reach both affected portals.');
  for (const [time, action, expected] of [['10:30','reject','Rejected'],['11:00','cancel','Cancelled'],['13:00','patient_cancel','Cancelled']]) {
    const booked = await okay(p, 'patients/appointments.php', 'POST', {service_type:'Consultation',preferred_dentist:a.dentist.name,scheduled_date:date,scheduled_time:time});
    if (action === 'patient_cancel') await okay(p, 'patients/appointments.php', 'PATCH', {appointment_id:booked.appointment_id,action:'cancel'});
    else await okay(r, 'appointments/actions.php', 'POST', {appointment_id:booked.appointment_id,action});
    await waitFor(p, `document.getElementById('historyBody').textContent.includes('${expected}')`, 'Patient terminal status missing');
    await waitFor(r, `staffSnapshot.week.appointments.some(x=>x.appointment_id==${booked.appointment_id}&&x.status==='${expected.toLowerCase()}')`, 'Receptionist terminal status missing');
    await waitFor(d, `document.querySelector('#dentistAppointmentActions').textContent.includes('${expected.toLowerCase()}')`, 'Dentist terminal status missing');
  }
  const contract = (await okay(r,'contracts/contracts.php','POST',{patient_id:a.patient.patient_id,dentist_id:a.dentist.user_id,total_amount:24000,monthly_payment:1000,duration_months:24,status:'active'})).contract;
  await waitFor(p, 'document.getElementById("dashStats").textContent.includes("24,000")', 'Patient billing balance missing');
  await waitFor(d, 'document.getElementById("patientsBody").textContent.includes("24,000")', 'Dentist billing balance missing');
  await okay(d,'contracts/progress.php','PATCH',{contract_id:contract.contract_id,current_stage:'Adjustment Phase',progress_pct:40,progress_note:'Integration progress',next_note:'Integration next visit'});
  await waitFor(p, 'document.body.textContent.includes("Integration progress")', 'Patient braces progress missing');
  const submission = await evaluate(p, `(async()=>{const form=new FormData();form.set('amount','1000');form.set('method','cash');const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6mQAAAABJRU5ErkJggg=='),x=>x.charCodeAt(0));form.set('receipt',new Blob([bytes],{type:'image/png'}),'receipt.png');return await apiFetch('../backend/api/patients/payments.php',{method:'POST',body:form})})()`);
  const paymentId = submission.submission.id;
  await waitFor(r, `!!document.querySelector('[data-pay-id="${paymentId}"]')`, 'Receptionist payment submission missing');
  await evaluate(r, `document.querySelector('[data-pay-id="${paymentId}"][data-pay-action="approve"]').click()`);
  await waitFor(p, 'document.getElementById("dashStats").textContent.includes("23,000")', 'Patient approved balance missing');
  await waitFor(d, 'document.getElementById("patientsBody").textContent.includes("23,000")', 'Dentist approved balance missing');
  assert.equal((await api(r,'payments/payments.php','POST',{payment_id:paymentId,action:'approve'})).status,409);
  const receiptStatus = (session) => evaluate(session, `fetch('../backend/api/payments/receipt.php?payment_id=${paymentId}').then(r=>r.status)`);
  assert.equal(await receiptStatus(p),200); assert.equal(await receiptStatus(o),404);
  assert.equal(await evaluate(p, `fetch('../backend/api/patients/profile.php',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Forbidden change'})}).then(r=>r.status)`),403);
  await okay(p,'patients/profile.php','PATCH',{name:'Updated ' + 'portal-test-' + key,contact_number:''});
  await waitFor(r, `document.getElementById('patientsBody').textContent.includes('Updated portal-test-${key}')`, 'Receptionist profile change missing');
  await waitFor(d, `document.getElementById('patientsBody').textContent.includes('Updated portal-test-${key}')`, 'Dentist profile change missing');
  const inbox = await okay(p,'notifications/inbox.php'); assert.ok(inbox.notifications.length > 0);
  await okay(p,'notifications/inbox.php','PATCH',{ids:inbox.notifications.map(n=>n.id)});
  assert.equal((await okay(p,'notifications/inbox.php')).notifications.some(n=>n.unread),false);
  const saved = await evaluate(p, 'document.getElementById("historyBody").innerHTML');
  await send('Network.enable',{},p); await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},p);
  await waitFor(p,'document.getElementById("patientSyncStatus").textContent.includes("Retrying")','Offline state missing');
  assert.equal(await evaluate(p,'document.getElementById("historyBody").innerHTML'),saved);
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},p);
  await evaluate(p,'window.dispatchEvent(new Event("online"))');
  await waitFor(p,'document.getElementById("patientSyncStatus").textContent === "Updates automatically"','Reconnect failed');
  const db = JSON.parse(fixture('verify')); assert.deepEqual(db.statuses, ['completed','rejected','cancelled','cancelled']);
  assert.equal(errors.length,0,'Browser JavaScript exceptions: ' + errors.join('\n'));
  console.log('PASS: real separate browser sessions; patient booking; receptionist approval/assignment/reschedule/reject/cancel; patient reschedule/cancel; dentist treatment create/edit/completion/progress; payment upload/approval/receipt/balance; profile changes; inbox read persistence; ownership/RBAC/CSRF/conflicts; offline retention and reconnect; database verification.');
  await send('Browser.close');
})().catch(error => { console.error(error.stack); if (/CDP|DevTools/.test(error.message)) console.error(browserLog); process.exitCode = 1; }).finally(async () => {
  if (ws) ws.close(); if (edge && !edge.killed) edge.kill();
  try { fixture('cleanup'); } catch (error) { console.error('Fixture cleanup failed: ' + error.message); process.exitCode = 1; }
  // Only this test's freshly-created OS temporary browser profile is removed.
  if (profile && path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('dcare-browser-')) {
    await delay(1000); try { fs.rmSync(profile, {recursive:true,force:true,maxRetries:3,retryDelay:300}); } catch {}
  }
});
