<?php
/**
 * GET /backend/api/auth/csrf-token.php
 * Returns a CSRF token for the current session.
 * Used by frontend to bootstrap CSRF protection.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\AuthMiddleware::secureSessionStart();
$token = \ASDC\CsrfToken::get();

echo json_encode(['csrf_token' => $token]);
