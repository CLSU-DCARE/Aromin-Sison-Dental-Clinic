<?php
/**
 * DELETE /backend/api/notifications/delete.php
 * Deletes an email notification log row.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\AuthMiddleware::requireRole('receptionist', 'dentist');
\ASDC\ApiResponse::method('DELETE');
\ASDC\CsrfToken::requireValid();

$input = \ASDC\ApiResponse::requireJson();
$logId = (int) ($input['log_id'] ?? 0);
$result = \ASDC\NotificationLogService::delete($logId);

if ($result['success']) {
    \ASDC\ApiResponse::ok(['log_id' => $result['log_id']], 'Notification deleted.');
}

\ASDC\ApiResponse::error($result['code'], 'delete_failed', $result['error']);
