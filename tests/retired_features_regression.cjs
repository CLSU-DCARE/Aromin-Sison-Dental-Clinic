const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));

function php(code, status = null) {
  if (status !== null) code = `register_shutdown_function(function(){fwrite(STDERR,(string)http_response_code());});` + code;
  const result = spawnSync('php', ['-r', code], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  if (status !== null) assert.equal(result.stderr, String(status));
  return JSON.parse(result.stdout);
}

for (const route of ['auth/register', 'patients/dashboard', 'patients/appointments', 'patients/braces', 'patients/payments']) {
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    const result = php(`$_SERVER['REQUEST_METHOD']='${method}'; require 'backend/api/${route}.php';`, 410);
    assert.equal(result.success, false);
    assert.equal(result.error.code, 'feature_removed');
  }
}
for (const call of [
  'PaymentApprovalService::submit(1, [], "receipt.png")',
  'PaymentApprovalService::approve(1, 1)',
  'PaymentApprovalService::reject(1, 1)',
  'ReceiptUploader::store(null, 1)',
  'ContractService::applyPayment(1, 100)',
]) {
  const result = php(`require 'backend/autoload.php'; \\ASDC\\${call};`, 410);
  assert.equal(result.error.code, 'payments_removed');
}
const result = php(`require 'backend/autoload.php'; echo json_encode(['roles'=>\\ASDC\\AuthService::ALLOWED_ROLES, 'registration'=>\\ASDC\\AuthService::register([])]);`);
assert.deepEqual(result.roles, ['dentist', 'receptionist']);
assert.equal(result.registration.code, 410);
const session = php(`require 'backend/autoload.php'; ini_set('session.save_path', sys_get_temp_dir()); \\ASDC\\AuthMiddleware::secureSessionStart(); $_SESSION=['user_id'=>123,'role'=>'patient','last_activity'=>time()]; echo json_encode(\\ASDC\\AuthMiddleware::inspectSession());`);
assert.equal(session.status, 401);
assert.equal(session.code, 'SESSION_REVOKED');
for (const page of ['auth/patient-login.html', 'auth/patient-signup.html', 'patient-dashboard/dashboard.html']) {
  const html = fs.readFileSync(page, 'utf8');
  assert(!/<form|<script/i.test(html));
  assert(html.includes('contact clinic staff'));
}
console.log('Retired feature routes, service mutations, roles and legacy pages passed.');
