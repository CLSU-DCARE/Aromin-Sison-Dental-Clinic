<?php
/**
 * POST /backend/api/auth/forgot-password.php
 * Body (JSON): { "email": "..." }
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

$input = \ASDC\ApiResponse::requireJson();

$email = is_string($input['email'] ?? '') ? $input['email'] : '';

$result = \ASDC\AuthService::forgotPassword($email);

if ($result['success']) {
    echo json_encode($result);
} else {
    http_response_code($result['code']);
    echo json_encode(['error' => $result['error']]);
}
