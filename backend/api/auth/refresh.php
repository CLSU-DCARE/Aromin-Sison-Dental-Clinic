<?php
/**
 * POST /backend/api/auth/refresh.php
 * Extends the current session (sliding window).
 * Requires a valid CSRF token AND a session that is still alive: an expired,
 * revoked or deactivated session can never be "refreshed" back to life.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

// 401 first (session is dead), then 403 (bad CSRF token), so the browser can tell them apart.
\ASDC\AuthMiddleware::requireLogin(false);
\ASDC\CsrfToken::requireValid();
\ASDC\AuthMiddleware::touch();

\ASDC\SessionAudit::logRefresh((int) $_SESSION['user_id'], session_id(), 'explicit');

\ASDC\ApiResponse::ok(['expires_in' => \ASDC\AuthMiddleware::getSessionTimeout()], 'Session refreshed.');
