<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\AuthMiddleware::requireRole('receptionist');
\ASDC\ApiResponse::method('POST');
\ASDC\CsrfToken::requireValid();
$input = \ASDC\ApiResponse::requireJson();
$logId = (int) ($input['log_id'] ?? 0);
if ($logId <= 0) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid failed notification.');

$pdo = \ASDC\Database::pdo();
[$scopeWhere, $scopeParams] = \ASDC\DataScope::current()->patientFilter();
$stmt = $pdo->prepare(
    "SELECT nl.patient_id, nl.subject, nl.body, nt.template_key
     FROM notification_logs nl
     JOIN patients p ON p.patient_id=nl.patient_id
     LEFT JOIN notification_templates nt ON nt.template_id=nl.template_id
     WHERE nl.log_id=? AND nl.status='failed' AND $scopeWhere"
);
$stmt->execute(array_merge([$logId], $scopeParams));
$log = $stmt->fetch();
if (!$log) \ASDC\ApiResponse::error(404, 'not_found', 'Failed notification not found.');

$payload = ['channel' => 'email', 'subject' => $log['subject'], 'body' => $log['body']];
if ($log['template_key']) {
    $payload['template_key'] = $log['template_key'];
    unset($payload['subject'], $payload['body']);
}
$result = \ASDC\NotificationSendService::send((int) $log['patient_id'], $payload);
if (!$result['success']) \ASDC\ApiResponse::error($result['code'], 'resend_failed', $result['error']);
\ASDC\ApiResponse::ok(['results' => $result['results']], 'Notification resent.');
