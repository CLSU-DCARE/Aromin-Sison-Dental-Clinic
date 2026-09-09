<?php
/**
 * GET /backend/api/auth/me.php
 * Returns the currently authenticated user's basic account information.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('GET');

$result = \ASDC\AuthService::me();

if ($result) {
    echo json_encode($result);
} else {
    http_response_code(401);
    echo json_encode(['error' => 'Authenticated account is no longer available.']);
}
