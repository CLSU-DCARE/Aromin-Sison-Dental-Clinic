<?php
/**
 * DELETE /backend/api/auth/session-revoke.php
 * Revoke a specific session by session_id.
 * Body: { "session_id": "..." }
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('DELETE');
\ASDC\CsrfToken::requireValid();
\ASDC\AuthMiddleware::requireLogin();

$input = \ASDC\ApiResponse::requireJson();

$sessionId = is_string($input['session_id'] ?? '') ? $input['session_id'] : '';
if (!$sessionId) {
    \ASDC\ApiResponse::error(400, 'INVALID_REQUEST', 'Session ID is required.');
}

$userId = \ASDC\AuthMiddleware::userId();
$currentSessionId = session_id();

// Cannot revoke current session via this endpoint
if ($sessionId === $currentSessionId) {
    \ASDC\ApiResponse::error(400, 'CANNOT_REVOKE_CURRENT', 'Cannot revoke your current session. Use logout instead.');
}

$revoked = \ASDC\SessionManager::revokeSession($userId, $sessionId);

if (!$revoked) {
    \ASDC\ApiResponse::error(404, 'SESSION_NOT_FOUND', 'Session not found or already revoked.');
}

\ASDC\ApiResponse::ok([], 'Session revoked successfully.');