<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';
require_role('receptionist', 'dentist', 'patient');
$method = \ASDC\ApiResponse::method('GET', 'PATCH');
$userId = (int) $_SESSION['user_id'];
if ($method === 'PATCH') {
    \ASDC\CsrfToken::requireValid();
    $body = \ASDC\ApiResponse::requireJson();
    $ids = $body['ids'] ?? null;
    if (!is_array($ids) || count($ids) > 100 || !$ids) \ASDC\ApiResponse::error(422, 'validation_failed', 'Select notifications to mark as read.');
    foreach ($ids as $id) if (!\ASDC\InputValidator::positiveId($id)) \ASDC\ApiResponse::error(422, 'validation_failed', 'Invalid notification identifier.');
    $marks = implode(',', array_fill(0, count($ids), '?'));
    \ASDC\Database::pdo()->prepare("UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=? AND notification_id IN ($marks)")->execute(array_merge([$userId], $ids));
}
header('Cache-Control: no-store');
\ASDC\ApiResponse::ok(['notifications' => \ASDC\UserNotificationService::listForUser($userId)]);
