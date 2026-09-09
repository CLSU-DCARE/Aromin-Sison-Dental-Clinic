<?php
/**
 * POST /backend/api/auth/register.php
 * Creates a patient portal account.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

$input = \ASDC\ApiResponse::requireJson();

$result = \ASDC\AuthService::register($input);

if ($result['success']) {
    http_response_code(201);
    echo json_encode($result);
} else {
    http_response_code($result['code']);
    echo json_encode(['error' => $result['error']]);
}
