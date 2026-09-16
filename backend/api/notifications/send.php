<?php
/**
 * POST /backend/api/notifications/send.php
 * Sends a notification to a patient via email/SMS.
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
    echo json_encode($result);
} else {
    http_response_code($result['code']);
    echo json_encode(['error' => $result['error']]);
}
