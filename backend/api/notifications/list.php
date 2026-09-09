<?php
/**
 * GET /backend/api/notifications/list.php
 * Query notification logs with optional filters.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\AuthMiddleware::requireRole('receptionist', 'dentist');

$filters = [
    'patient_id' => isset($_GET['patient_id']) ? (int) $_GET['patient_id'] : null,
    'channel'    => $_GET['channel'] ?? null,
    'status'     => $_GET['status'] ?? null,
    'limit'      => $_GET['limit'] ?? 50,
    'offset'     => $_GET['offset'] ?? 0,
];

echo json_encode(\ASDC\NotificationLogService::list($filters));
