<?php
/**
 * POST /backend/api/auth/reset-password.php
 * Body (JSON): { "token": "...", "password": "..." }
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

$input = \ASDC\ApiResponse::requireJson();

$token    = is_string($input['token'] ?? '') ? $input['token'] : '';
$password = is_string($input['password'] ?? '') ? $input['password'] : '';

$result = \ASDC\AuthService::resetPassword($token, $password);

if ($result['success']) {
    echo json_encode($result);
} else {
    http_response_code($result['code']);
    echo json_encode(['error' => $result['error']]);
}
