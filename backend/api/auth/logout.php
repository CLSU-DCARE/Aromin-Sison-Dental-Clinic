<?php
/**
 * POST /backend/api/auth/logout.php
 * Destroys the server-side session.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');
\ASDC\CsrfToken::requireValid();

\ASDC\AuthService::logout();

\ASDC\ApiResponse::ok([], 'Logged out successfully.');
