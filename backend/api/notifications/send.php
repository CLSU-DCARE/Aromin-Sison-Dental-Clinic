<?php
/**
 * POST /backend/api/notifications/send.php
 * Sends an email notification to a patient.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\AuthMiddleware::requireRole('receptionist', 'dentist');
\ASDC\ApiResponse::method('POST');
\ASDC\CsrfToken::requireValid();

$input = \ASDC\ApiResponse::requireJson();

$patientId = (int) ($input['patient_id'] ?? 0);
[$where, $params] = \ASDC\DataScope::current()->patientFilter();
$check = \ASDC\Database::pdo()->prepare("SELECT p.patient_id FROM patients p WHERE p.patient_id=? AND $where");
$check->execute(array_merge([$patientId], $params));
if (!$check->fetchColumn()) \ASDC\ApiResponse::error(403, 'forbidden', 'Patient is outside your scope.');
$result = \ASDC\NotificationSendService::send($patientId, $input);

if ($result['success']) {
    $failed = array_values(array_filter($result['results'], fn($row) => ($row['status'] ?? '') !== 'sent'));
    if ($failed && count($failed) === count($result['results'])) {
        $message = $failed[0]['error'] ?? 'Email delivery failed.';
        \ASDC\ApiResponse::error(502, 'mail_delivery_failed', $message);
    }
    \ASDC\ApiResponse::ok([
        'patient_id' => $result['patient_id'],
        'results' => $result['results'],
    ], 'Notification processed.');
} else {
    \ASDC\ApiResponse::error($result['code'], 'notification_failed', $result['error']);
}
