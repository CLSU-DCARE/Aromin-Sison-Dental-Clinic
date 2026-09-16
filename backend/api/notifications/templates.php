<?php
/**
 * GET/POST /backend/api/notifications/templates.php
 * GET: list templates | POST: create or update a template
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\AuthMiddleware::requireRole('receptionist');
\ASDC\ApiResponse::method('GET', 'POST');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $activeOnly = isset($_GET['active_only']) && $_GET['active_only'] === '1';
    $templates = \ASDC\NotificationTemplateService::list($activeOnly);
    echo json_encode(['success' => true, 'templates' => $templates]);
    exit;
}

// POST
\ASDC\CsrfToken::requireValid();
$input = \ASDC\ApiResponse::requireJson();
$result = \ASDC\NotificationTemplateService::createOrUpdate($input);

if ($result['success']) {
    echo json_encode($result);
} else {
    http_response_code($result['code']);
    echo json_encode(['error' => $result['error']]);
}
