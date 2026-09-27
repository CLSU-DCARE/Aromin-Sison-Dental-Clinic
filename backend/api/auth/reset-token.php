<?php
/**
 * GET /backend/api/auth/reset-token.php?token=...
 * Validates whether a password reset token is active before the form submits.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('GET');

$token = is_string($_GET['token'] ?? '') ? $_GET['token'] : '';
$result = \ASDC\AuthService::resetTokenStatus($token);
echo json_encode($result);
