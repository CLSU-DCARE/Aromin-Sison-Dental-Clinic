<?php
/**
 * POST /backend/api/auth/logout.php
 * Destroys the server-side session and forgets this browser's "remember me" token.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

// While a session is alive, the CSRF token must match.
// When there is no live session (it already expired) there is nothing for an
// attacker to abuse, and we still must clear the remember token below, so the
// CSRF check is skipped.
\ASDC\AuthMiddleware::secureSessionStart();
if (!empty($_SESSION['user_id'])) {
    \ASDC\CsrfToken::requireValid();
}

\ASDC\AuthService::logout();

\ASDC\ApiResponse::ok([], 'Logged out successfully.');
