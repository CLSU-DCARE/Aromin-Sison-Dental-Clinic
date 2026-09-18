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
if (!$patientId || mb_strlen($name) < 2 || mb_strlen($name) > 100 || ($contact !== '' && !preg_match('/^[+0-9() -]{7,20}$/', $contact))) \ASDC\ApiResponse::error(422, 'validation_failed', 'Enter a name and valid contact number.');
// Login email is deliberately not editable through a demographic update.
$parts = preg_split('/\s+/', $name, 2);
$pdo = \ASDC\Database::pdo();
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT user_id FROM patients WHERE patient_id=? AND archived_at IS NULL FOR UPDATE'); $stmt->execute([$patientId]);
    $row = $stmt->fetch();
    if (!$row) { $pdo->rollBack(); \ASDC\ApiResponse::error(404, 'not_found', 'Patient not found.'); }
    $pdo->prepare('UPDATE patients SET first_name=?,last_name=?,contact_number=? WHERE patient_id=?')->execute([$parts[0], $parts[1] ?? '', $contact ?: null, $patientId]);
    if ($row['user_id']) $pdo->prepare('UPDATE users SET full_name=?,contact_number=? WHERE user_id=?')->execute([$name, $contact ?: null, $row['user_id']]);
    \ASDC\PortalEvent::patient($patientId, 'Patient profile updated', 'Name or contact details have changed.');
    $pdo->commit();
    \ASDC\ApiResponse::ok(['patient_id' => $patientId], 'Profile updated.');
} catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); error_log($e->getMessage()); \ASDC\ApiResponse::error(500, 'profile_failed', 'Unable to update profile.'); }
