<?php

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

require_role('receptionist', 'dentist');
\ASDC\ApiResponse::method('POST');
\ASDC\CsrfToken::requireValid();

$input = \ASDC\ApiResponse::requireJson();

$userId = (int)($input['user_id'] ?? 0);
$title = $input['title'] ?? '';
$message = $input['message'] ?? '';
if ($userId <= 0 || !is_string($title) || !is_string($message) || trim($title) === '' || trim($message) === '' || mb_strlen($title) > 160 || mb_strlen($message) > 5000) \ASDC\ApiResponse::error(422, 'validation_failed', 'A recipient, title and message are required.');
[$where, $params] = \ASDC\DataScope::current()->patientFilter();
$check = \ASDC\Database::pdo()->prepare("SELECT p.patient_id FROM patients p WHERE p.user_id=? AND $where");
$check->execute(array_merge([$userId], $params));
if (!$check->fetchColumn()) \ASDC\ApiResponse::error(403, 'forbidden', 'Recipient is outside your patient scope.');

$result = \ASDC\UserNotificationService::create(
    $userId,
    $title,
    $message
);

echo json_encode([
    'success' => $result
]);
