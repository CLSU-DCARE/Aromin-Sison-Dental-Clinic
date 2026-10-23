// Actual Chromium layout check using synthetic records and the application's CSS/JS.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asdc-chart-layout-'));
const fixture = path.join(dir, 'chart.html');
const patient = { patient_id: 2, first_name: 'Layout', last_name: 'Test', is_active: 1, email: 'patient@example.test', contact_number: '09123456789' };
const payment = { paymentDate: '2026-10-23', amount: 'PHP 2000.00', category: 'Braces', method: 'Cash', status: 'approved', orNumber: 'LONG-REFERENCE-' + '1234567890'.repeat(6), note: 'A long payment note that must wrap inside the reference column. '.repeat(12) };
const data = { patient, accounts: [{ id: 'C-1', service: 'Braces plan', total_amount: 10000, paid_amount: 2000, balance_amount: 8000, status: 'active' }], payments: [payment], records: [], appointments: [{ scheduled_date: '2026-10-23', service_type: 'Long appointment service '.repeat(8), dentist_name: 'Dentist Name '.repeat(8), status: 'completed' }] };
const css = ['shared/css/variables.css', 'shared/css/buttons.css', 'shared/css/panels.css', 'admin-system/assets/css/admin.css', 'admin-system/assets/css/patient-chart.css', 'shared/css/staff-payments.css'].map(read).join('\n');
let html = read('admin-system/patient-chart.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const setup = `window.ASDC={HtmlHelpers:{escapeHtml:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),formatDate:v=>v},SessionGuard:class{init(){window.dispatchEvent(new CustomEvent('asdc:authenticated',{detail:{role:'receptionist'}}));}}};window.apiFetch=async()=>(${JSON.stringify(data)});window.ASDC.ApiClient={api:window.apiFetch};`;
const checks = `document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  document.querySelector('main').classList.add('billing-pdf-layout');
  const results=[];
  for(const width of [1000,740]) {
    document.querySelector('main').style.cssText='width:'+width+'px;max-width:none;';
    for(const cell of document.querySelectorAll('#patientPaymentHistory td, #patientPaymentHistory small, .chart-appointments-table td')) {
      if(cell.scrollWidth>cell.clientWidth+2) results.push('Overflow at '+width+': '+cell.textContent.slice(0,60));
    }
  }
  if(!document.querySelector('.chart-appointments-table')) results.push('Appointment table missing');
  document.body.setAttribute('data-layout-result',results.length?results.join(' | '):'PASS');
},100));`;
html = html.replace('</head>', `<style>${css}</style></head>`).replace('</body>', `<script>${setup}</script><script>${read('admin-system/assets/js/patient-chart.js')}</script><script>${read('shared/js/core/PatientBilling.js')}</script><script>${checks}</script></body>`);
try {
  fs.writeFileSync(fixture, html);
  const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edge = process.env.ASDC_EDGE_BINARY || (fs.existsSync(chrome) ? chrome : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
  const result = spawnSync(edge, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * 0.0.0.0', '--virtual-time-budget=2000', '--user-data-dir=' + path.join(dir, 'profile'), '--dump-dom', 'file:///' + fixture.replace(/\\/g, '/') + '?patient_id=2'], { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const outcome = result.stdout.match(/data-layout-result="([^"]+)"/);
  assert(outcome, 'Browser did not finish the layout check.');
  assert.equal(outcome[1], 'PASS');
  console.log('PASS: real browser layout wraps long payment notes/references and appointment details at PDF and narrow widths.');
} finally {
  // Delete only the unique fixture directory created by this test.
  if (path.dirname(dir) !== os.tmpdir() || !path.basename(dir).startsWith('asdc-chart-layout-')) throw new Error('Unsafe fixture cleanup path.');
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}
