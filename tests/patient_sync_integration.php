<?php
// Uses the running local Apache and database. Creates and removes isolated fixtures.
// Patient contact details are NULL so staff actions cannot send external messages.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/autoload.php';
$pdo = \ASDC\Database::pdo();
$base = 'http://127.0.0.1/Aromin-Sison-Dental-Clinic/backend/api/';
$suffix = bin2hex(random_bytes(6));
$password = bin2hex(random_bytes(20));
$users = []; $patients = []; $emails = []; $sessions = [];
function callApi(string $route, string $method = 'GET', ?array $body = null, ?array $session = null): array {
    global $base;
    $headers = ['Accept: application/json'];
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    if ($session) { $headers[] = 'Cookie: ASDC_SESSION=' . $session['cookie']; $headers[] = 'X-CSRF-Token: ' . $session['csrf']; }
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body === null ? '' : json_encode($body), 'ignore_errors' => true, 'timeout' => 20]]);
    $raw = file_get_contents($base . $route, false, $context);
    if ($raw === false) throw new RuntimeException('Cannot reach the local API.');
    preg_match('/\s(\d{3})\s/', $http_response_header[0], $match);
    return ['status' => (int) $match[1], 'data' => json_decode($raw, true, 512, JSON_THROW_ON_ERROR), 'headers' => $http_response_header];
}
function expect(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function okData(array $result): array {
    expect($result['status'] === 200 || $result['status'] === 201, 'API failed: ' . json_encode($result['data']));
    return $result['data']['data'] ?? $result['data'];
}
function snapshot(array $session): array { return okData(callApi('patients/dashboard.php', 'GET', null, $session)); }
try {
    foreach (['receptionist', 'dentist', 'patient', 'other'] as $key) {
        $role = $key === 'other' ? 'patient' : $key;
        $email = "sync-$key-$suffix@example.invalid"; $emails[] = $email;
        $stmt = $pdo->prepare('INSERT INTO users(role,email,password_hash,full_name,is_active) VALUES(?,?,?,?,1)');
        $stmt->execute([$role, $email, password_hash($password, PASSWORD_DEFAULT), 'Sync Integration ' . $key]);
        $users[$key] = (int) $pdo->lastInsertId();
        if ($role === 'patient') {
            $pdo->prepare("INSERT INTO patients(user_id,first_name,last_name) VALUES(?,'Sync',?)")->execute([$users[$key], $suffix . $key]);
            $patients[$key] = (int) $pdo->lastInsertId();
        }
        $login = callApi('auth/login.php', 'POST', ['email' => $email, 'password' => $password]); okData($login);
        $cookie = '';
        foreach ($login['headers'] as $header) if (preg_match('/Set-Cookie: ASDC_SESSION=([^;]+)/i', $header, $m)) $cookie = $m[1];
        expect($cookie !== '', 'Session cookie missing.');
        $session = ['cookie' => $cookie, 'csrf' => ''];
        $token = okData(callApi('auth/csrf-token.php', 'GET', null, $session));
        $session['csrf'] = $token['csrf_token']; $sessions[$key] = $session;
    }
    expect(callApi('patients/dashboard.php')['status'] === 401, 'Anonymous dashboard access must fail.');
    expect(callApi('patients/dashboard.php', 'GET', null, $sessions['dentist'])['status'] === 403, 'Staff must not use the patient endpoint.');
    expect(snapshot($sessions['patient'])['braces']['has_contract'] === false, 'New patient should have no contract.');
    $contract = okData(callApi('contracts/contracts.php', 'POST', [
        'patient_id' => $patients['patient'], 'dentist_id' => $users['dentist'],
        'total_amount' => 24000, 'monthly_payment' => 1000, 'duration_months' => 24, 'status' => 'active'
    ], $sessions['receptionist']))['contract'];
    $contractId = $contract['contract_id'];
    expect(snapshot($sessions['patient'])['braces']['has_contract'] === true, 'New staff contract must appear for patient.');
    $other = okData(callApi('patients/dashboard.php?patient_id=' . $patients['patient'], 'GET', null, $sessions['other']));
    expect($other['profile']['patient_id'] == $patients['other'] && !$other['braces']['has_contract'], 'Patient ID parameters must never override session scope.');
    okData(callApi('contracts/progress.php', 'PATCH', ['contract_id' => $contractId, 'current_stage' => 'Adjustment Phase', 'progress_pct' => 40, 'progress_note' => 'Integration progress', 'next_note' => 'Integration next visit'], $sessions['dentist']));
    $view = snapshot($sessions['patient']);
    expect($view['braces']['braces_progress'] === '40%' && $view['braces']['braces']['description'] === 'Integration progress', 'Dentist progress must reach patient.');
    $pdo->prepare("INSERT INTO treatment_records(patient_id,dentist_id,treatment_given,date_recorded) VALUES(?,?,'Integration treatment',CURRENT_DATE())")->execute([$patients['patient'], $users['dentist']]);
    $view = snapshot($sessions['patient']);
    expect($view['treatments'][0]['title'] === 'Integration treatment' && $view['braces']['treatment_records'] === 1, 'Stored treatment records and counters must update together.');
    foreach ([1000, 500] as $amount) {
        $pdo->prepare("INSERT INTO contract_payments(contract_id,amount_paid,payment_date,payment_method,status,submitted_by) VALUES(?,?,CURRENT_DATE(),'cash','pending',?)")->execute([$contractId, $amount, $users['patient']]);
        $paymentIds[] = (int) $pdo->lastInsertId();
    }
    okData(callApi('payments/payments.php', 'POST', ['payment_id' => $paymentIds[0], 'action' => 'approve'], $sessions['receptionist']));
    $view = snapshot($sessions['patient']);
    expect($view['braces']['outstanding_balance'] === '₱23,000.00', 'Approved payment must reduce patient balance.');
    expect(count(array_filter($view['submissions'], fn($p) => $p['status'] === 'approved')) === 1, 'Approved submission must update.');
    expect(callApi('payments/payments.php', 'POST', ['payment_id' => $paymentIds[0], 'action' => 'approve'], $sessions['receptionist'])['status'] === 409, 'Duplicate approval must be rejected.');
    okData(callApi('payments/payments.php', 'POST', ['payment_id' => $paymentIds[1], 'action' => 'reject'], $sessions['receptionist']));
    $view = snapshot($sessions['patient']);
    expect($view['braces']['outstanding_balance'] === '₱23,000.00', 'Rejection must preserve balance.');
    expect(count(array_filter($view['submissions'], fn($p) => $p['status'] === 'rejected')) === 1, 'Rejected submission must update.');
    // Pick a free future slot to avoid touching another patient's booking.
    $date = date('Y-m-d', strtotime('+600 days'));
    while (\ASDC\AppointmentSlotManager::isTaken($pdo, $date, '09:00:00') || \ASDC\AppointmentSlotManager::isTaken($pdo, $date, '10:00:00')) $date = date('Y-m-d', strtotime($date . ' +1 day'));
    $pdo->prepare("INSERT INTO appointments(patient_id,dentist_id,service_type,scheduled_date,scheduled_time,status) VALUES(?,?,'Consultation',?,'09:00:00','pending')")->execute([$patients['patient'], $users['dentist'], $date]);
    $appointmentId = (int) $pdo->lastInsertId();
    $action = ['resource_type' => 'appointment', 'appointment_id' => $appointmentId];
    okData(callApi('appointments/actions.php', 'POST', $action + ['action' => 'approve'], $sessions['receptionist']));
    expect(snapshot($sessions['patient'])['appointments']['schedule'][0]['status'] === 'Confirmed', 'Confirmation must update patient schedule.');
    okData(callApi('appointments/actions.php', 'PATCH', $action + ['action' => 'reschedule', 'scheduled_date' => $date, 'scheduled_time' => '10:00'], $sessions['dentist']));
    expect(snapshot($sessions['patient'])['appointments']['schedule'][0]['time'] === '10:00 AM', 'Staff rescheduling must update patient time.');
    okData(callApi('appointments/actions.php', 'POST', $action + ['action' => 'cancel'], $sessions['receptionist']));
    $view = snapshot($sessions['patient']);
    expect(count($view['appointments']['schedule']) === 0 && $view['appointments']['history'][0]['status'] === 'Cancelled', 'Cancellation must move appointment to history.');
    okData(callApi('contracts/contracts.php', 'PATCH', ['contract_id' => $contractId, 'total_amount' => 36000, 'monthly_payment' => 1500, 'duration_months' => 24, 'status' => 'active'], $sessions['receptionist']));
    expect(snapshot($sessions['patient'])['braces']['outstanding_balance'] === '₱35,000.00', 'Contract edits must preserve paid amounts and update balance.');
    okData(callApi('contracts/contracts.php', 'PATCH', ['contract_id' => $contractId, 'total_amount' => 36000, 'monthly_payment' => 1500, 'duration_months' => 24, 'status' => 'cancelled'], $sessions['receptionist']));
    expect(snapshot($sessions['patient'])['braces']['has_contract'] === false, 'Cancelled contracts must disappear from patient active contract.');
    echo "PASS: separate staff/patient sessions; contract create/edit/cancel; dentist progress; payment approve/reject/duplicate protection; appointment confirm/reschedule/cancel; patient isolation.\n";
} finally {
    foreach ($sessions as $session) callApi('auth/logout.php', 'POST', [], $session);
    foreach ($patients as $id) $pdo->prepare('DELETE FROM patients WHERE patient_id = ?')->execute([$id]);
    foreach ($users as $id) $pdo->prepare('DELETE FROM users WHERE user_id = ?')->execute([$id]);
    // Older local installations use the session-based rate limiter.
    if ($pdo->query("SHOW TABLES LIKE 'rate_limits'")->fetchColumn()) {
        foreach ($emails as $email) $pdo->prepare('DELETE FROM rate_limits WHERE identifier = ?')->execute(['login:' . $email]);
    }
}
