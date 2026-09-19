<?php
/**
 * POST /backend/api/auth/refresh.php
 * Extends the current session (sliding window).
 * Requires valid CSRF token.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');
\ASDC\CsrfToken::requireValid();

\ASDC\AuthMiddleware::secureSessionStart();

if (empty($_SESSION['user_id'])) {
    \ASDC\ApiResponse::error(401, 'UNAUTHENTICATED', 'Authentication required.');
}

$_SESSION['last_activity'] = time();

// Update activity in active_sessions table
$sessionId = session_id();
\ASDC\SessionManager::updateActivity($sessionId);

// Audit log
\ASDC\SessionAudit::logRefresh((int) $_SESSION['user_id'], $sessionId, 'explicit');

\ASDC\ApiResponse::ok([], 'Session refreshed.');