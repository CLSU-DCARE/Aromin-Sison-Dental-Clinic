<?php
/**
 * POST /backend/api/auth/login.php
 * Body (JSON): { "email": "...", "password": "..." }
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

$input = \ASDC\ApiResponse::requireJson();

$email    = is_string($input['email'] ?? '') ? $input['email'] : '';
$password = is_string($input['password'] ?? '') ? $input['password'] : '';

$result = \ASDC\AuthService::login($email, $password);

if ($result['success']) {
    echo json_encode($result);
} else {
    http_response_code($result['code']);
    echo json_encode(['error' => $result['error']]);
}
