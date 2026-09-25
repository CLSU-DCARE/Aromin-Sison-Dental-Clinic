<?php
/**
 * POST /backend/api/auth/login.php
 * Body (JSON): { "identifier": "registered email or mobile number", "password": "...", "remember_me": false }
 * The legacy "email" field remains accepted for existing clients.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

$input = \ASDC\ApiResponse::requireJson();

$identifierValue = $input['identifier'] ?? $input['email'] ?? '';
$identifier  = is_string($identifierValue) ? $identifierValue : '';
$password    = is_string($input['password'] ?? '') ? trim($input['password']) : '';
$rememberMe  = isset($input['remember_me']) ? (bool) $input['remember_me'] : false;

$result = \ASDC\AuthService::login($identifier, $password, $rememberMe);

if ($result['success']) {
    \ASDC\ApiResponse::ok($result['user'], 'Login successful.');
} else {
    \ASDC\ApiResponse::error($result['code'], 'LOGIN_FAILED', $result['error']);
}
