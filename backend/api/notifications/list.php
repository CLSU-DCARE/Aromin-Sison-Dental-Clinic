<?php
/**
 * Notification list endpoint.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/headers.php';

require_role('receptionist', 'dentist');

$filters = [
    'patient_id' => $_GET['patient_id'] ?? null,
    'channel'    => $_GET['channel'] ?? null,
    'status'     => $_GET['status'] ?? null,
    'limit'      => (int)($_GET['limit'] ?? 50),
    'offset'     => (int)($_GET['offset'] ?? 0)
];

$result = \ASDC\NotificationLogService::list($filters);

echo json_encode([
    'success' => true,
    'data' => $result
]);