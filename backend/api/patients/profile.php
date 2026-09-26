<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';
require_role('patient', 'receptionist');
$method = \ASDC\ApiResponse::method('PATCH', 'POST', 'DELETE');
\ASDC\CsrfToken::requireValid();
$body = \ASDC\ApiResponse::requireJson();
if ($method === 'POST') {
    require_role('receptionist');
    \ASDC\ApiResponse::ok(\ASDC\PatientService::create($body), 'Patient created.', 201);
}
if ($method === 'DELETE') {
    require_role('receptionist');
    $patientId = \ASDC\InputValidator::positiveId($body['patient_id'] ?? null);
    if (!$patientId) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid patient.');
    \ASDC\ApiResponse::ok(\ASDC\PatientService::delete($patientId), 'Patient archived.');
}
$patientId = $_SESSION['role'] === 'patient' ? \ASDC\PatientService::resolvePatientId((int) $_SESSION['user_id']) : \ASDC\InputValidator::positiveId($body['patient_id'] ?? null);
$name = is_string($body['name'] ?? null) ? trim($body['name']) : '';
$contact = is_string($body['contact_number'] ?? null) ? trim($body['contact_number']) : '';
$billingBalance = array_key_exists('billing_balance', $body) && $body['billing_balance'] !== '' ? filter_var($body['billing_balance'], FILTER_VALIDATE_FLOAT) : null;
if ($_SESSION['role'] !== 'receptionist') $billingBalance = null;
if ($billingBalance !== null && ($billingBalance === false || $billingBalance < 0 || $billingBalance > 99999999.99)) \ASDC\ApiResponse::error(422, 'validation_failed', 'Enter a valid balance.');
$activeStatus = null;
if (array_key_exists('is_active', $body)) {
    if ($_SESSION['role'] !== 'receptionist' || !in_array((string) $body['is_active'], ['0', '1'], true)) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid patient status.');
    $activeStatus = (int) $body['is_active'];
}
if (!$patientId || mb_strlen($name) < 2 || mb_strlen($name) > 100 || ($contact !== '' && !preg_match('/^[+0-9() -]{7,20}$/', $contact))) \ASDC\ApiResponse::error(422, 'validation_failed', 'Enter a name and valid contact number.');
// Login email is deliberately not editable through a demographic update.
$parts = preg_split('/\s+/', $name, 2);
if ($billingBalance !== null) \ASDC\PaymentApprovalService::ensureGeneralTreatmentBillingTables();
$pdo = \ASDC\Database::pdo();
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT user_id FROM patients WHERE patient_id=? AND archived_at IS NULL FOR UPDATE'); $stmt->execute([$patientId]);
    $row = $stmt->fetch();
    if (!$row) { $pdo->rollBack(); \ASDC\ApiResponse::error(404, 'not_found', 'Patient not found.'); }
    $pdo->prepare('UPDATE patients SET first_name=?,last_name=?,contact_number=? WHERE patient_id=?')->execute([$parts[0], $parts[1] ?? '', $contact ?: null, $patientId]);
    if ($row['user_id']) {
        if ($activeStatus === null) $pdo->prepare('UPDATE users SET full_name=?,contact_number=? WHERE user_id=?')->execute([$name, $contact ?: null, $row['user_id']]);
        else $pdo->prepare('UPDATE users SET full_name=?,contact_number=?,is_active=? WHERE user_id=?')->execute([$name, $contact ?: null, $activeStatus, $row['user_id']]);
    }
    if ($billingBalance !== null) {
        $bill = $pdo->prepare("SELECT bill_id, total_amount FROM treatment_bills WHERE patient_id=? AND status='active' ORDER BY bill_id DESC LIMIT 1 FOR UPDATE");
        $bill->execute([$patientId]);
        $existing = $bill->fetch();
        if ($existing) {
            $pdo->prepare('UPDATE treatment_bills SET balance_amount=?, total_amount=GREATEST(total_amount, ?) WHERE bill_id=?')->execute([$billingBalance, $billingBalance, $existing['bill_id']]);
        } else {
            $pdo->prepare("INSERT INTO treatment_bills (patient_id, service_treatment, total_amount, balance_amount, status) VALUES (?, 'Dental Treatment', ?, ?, 'active')")->execute([$patientId, $billingBalance, $billingBalance]);
        }
    }
    \ASDC\PortalEvent::patient($patientId, 'Patient profile updated', 'Name or contact details have changed.');
    $pdo->commit();
    \ASDC\ApiResponse::ok(['patient_id' => $patientId], 'Profile updated.');
} catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); error_log($e->getMessage()); \ASDC\ApiResponse::error(500, 'profile_failed', 'Unable to update profile.'); }
