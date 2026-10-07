// Production smoke checks for the Vercel frontend + Railway backend.
//
// Run after each production deploy:
//   node tests/production_smoke.cjs
//
// Optional:
//   VERCEL_URL=https://your-site.vercel.app RAILWAY_URL=https://your-api.up.railway.app node tests/production_smoke.cjs

const assert = require('node:assert/strict');

const VERCEL_URL = (process.env.VERCEL_URL || 'https://arominsisondental.vercel.app').replace(/\/+$/, '');
const RAILWAY_URL = (process.env.RAILWAY_URL || 'https://asdc-api-production.up.railway.app').replace(/\/+$/, '');
const ORIGIN = VERCEL_URL;

async function readText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

async function readJson(url, options = {}) {
  const { response, text } = await readText(url, options);
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`${url} did not return JSON. HTTP ${response.status}. Body starts with: ${text.slice(0, 120)}`);
  }
  return { response, payload };
}

async function checkFrontendBookingAsset() {
  const dashboardUrl = `${VERCEL_URL}/patient-dashboard/dashboard.html`;
  const dashboard = await readText(dashboardUrl, { cache: 'no-store' });
  assert.equal(dashboard.response.status, 200, `Patient dashboard should load from Vercel. Got ${dashboard.response.status}.`);
  assert.match(
    dashboard.text,
    /PatientAppointmentBooking\.js\?v=20260930-shared-api/,
    'Vercel is serving an old patient dashboard without the shared booking API cache-bust.'
  );

  const url = `${VERCEL_URL}/patient-dashboard/assets/js/PatientAppointmentBooking.js?v=20260930-shared-api`;
  const { response, text } = await readText(url, { cache: 'no-store' });
  assert.equal(response.status, 200, `Booking asset should load from Vercel. Got ${response.status}.`);
  assert.match(text, /apiFetch\(this\.endpoint, options\)/, 'Booking JS should use the shared API client on live host.');
  assert.doesNotMatch(text, /_productionApi/, 'Vercel is serving an old booking JS file with the removed production-only client.');
  console.log('PASS frontend booking asset uses the shared API client.');
}

async function checkReceptionPromotionEditAsset() {
  const dashboardUrl = `${VERCEL_URL}/admin-system/dashboard.html`;
  const dashboard = await readText(dashboardUrl, { cache: 'no-store' });
  assert.equal(dashboard.response.status, 200, `Receptionist dashboard should load from Vercel. Got ${dashboard.response.status}.`);
  assert.match(
    dashboard.text,
    /assets\/js\/admin\.js\?v=20261007-promo-actions/,
    'Vercel is serving an old receptionist dashboard without the promotion action asset version.'
  );
  assert.doesNotMatch(
    dashboard.text,
    /id="promoDetailEdit"/,
    'Receptionist promotion detail modal should not include the Edit button on live host.'
  );

  const url = `${VERCEL_URL}/admin-system/assets/js/admin.js?v=20261007-promo-actions`;
  const { response, text } = await readText(url, { cache: 'no-store' });
  assert.equal(response.status, 200, `Receptionist admin asset should load from Vercel. Got ${response.status}.`);
  assert.match(text, /data-action="edit-promo"/, 'Promotion cards should render an Edit button on live host.');
  assert.match(text, /openPromotionEditor/, 'Receptionist admin JS should wire promotion editing on live host.');
  assert.match(text, /promo_id/, 'Promotion edits should submit the existing promo_id on live host.');
  console.log('PASS receptionist promotion edit asset is deployed.');
}

async function checkPreflight(path, method = 'POST', headers = 'content-type') {
  const url = `${RAILWAY_URL}${path}`;
  const { response, text } = await readText(url, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': headers,
    },
  });
  assert.equal(response.status, 204, `${path} preflight should be 204. Got ${response.status}: ${text.slice(0, 120)}`);
  assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN, `${path} must allow the Vercel origin.`);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true', `${path} must allow credentials.`);
  console.log(`PASS ${path} CORS preflight.`);
}

async function checkForgotPasswordJson() {
  const url = `${RAILWAY_URL}/backend/api/auth/forgot-password.php`;
  const { response, payload } = await readJson(url, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: 'asdc-production-smoke@example.invalid' }),
  });
  assert.equal(response.status, 200, `Forgot-password smoke should be 200 for unknown email. Got ${response.status}.`);
  assert.equal(payload.success, true, 'Forgot-password should return generic success JSON.');
  console.log('PASS forgot-password API returns JSON success.');
}

async function main() {
  console.log(`Checking Vercel:  ${VERCEL_URL}`);
  console.log(`Checking Railway: ${RAILWAY_URL}`);
  await checkFrontendBookingAsset();
  await checkReceptionPromotionEditAsset();
  await checkPreflight('/backend/api/patients/appointments.php', 'POST', 'content-type,x-csrf-token');
  await checkPreflight('/backend/api/auth/forgot-password.php', 'POST', 'content-type');
  await checkForgotPasswordJson();
  console.log('PASS production smoke checks completed.');
  console.log('NOTE email delivery still requires valid Railway Gmail variables and scheduled reminders require: php database/maintenance.php');
}

main().catch(error => {
  console.error('FAIL production smoke checks.');
  console.error(error.message || error);
  process.exitCode = 1;
});
