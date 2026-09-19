<?php
/**
 * POST /backend/api/auth/login.php
 * Body (JSON): { "email": "...", "password": "...", "remember_me": false }
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

$input = \ASDC\ApiResponse::requireJson();

$email       = is_string($input['email'] ?? '') ? $input['email'] : '';
$password    = is_string($input['password'] ?? '') ? $input['password'] : '';
$rememberMe  = isset($input['remember_me']) ? (bool) $input['remember_me'] : false;

$result = \ASDC\AuthService::login($email, $password, $rememberMe);

if ($result['success']) {
    \ASDC\ApiResponse::ok($result['user'], 'Login successful.');
} else {
    \ASDC\ApiResponse::error($result['code'], 'LOGIN_FAILED', $result['error']);
}
