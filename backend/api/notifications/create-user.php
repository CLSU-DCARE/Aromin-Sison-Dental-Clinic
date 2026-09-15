<?php

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

require_role('receptionist', 'dentist');

$input = \ASDC\ApiResponse::requireJson();

$userId = (int)($input['user_id'] ?? 0);
$title = $input['title'] ?? '';
$message = $input['message'] ?? '';

$result = \ASDC\UserNotificationService::create(
    $userId,
    $title,
    $message
);

echo json_encode([
    'success' => $result
]);