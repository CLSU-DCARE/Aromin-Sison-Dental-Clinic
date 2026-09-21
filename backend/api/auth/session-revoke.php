<?php
/**
 * DELETE /backend/api/auth/session-revoke.php
 * Revoke a specific session by its session_ref (see sessions.php).
 * Body: { "session_ref": "..." }
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('DELETE');
\ASDC\AuthMiddleware::requireLogin();
\ASDC\CsrfToken::requireValid();

$input = \ASDC\ApiResponse::requireJson();

$ref = is_string($input['session_ref'] ?? '') ? $input['session_ref'] : '';
if (!preg_match('/^[a-f0-9]{64}$/', $ref)) {
    \ASDC\ApiResponse::error(400, 'INVALID_REQUEST', 'A valid session reference is required.');
}

$userId = \ASDC\AuthMiddleware::userId();

// Only this user's own sessions can be found; the current session is refused (use logout).
$revoked = \ASDC\SessionManager::revokeByRef($userId, $ref, session_id());

if ($revoked === null) {
    \ASDC\ApiResponse::error(400, 'CANNOT_REVOKE_CURRENT', 'Cannot revoke your current session. Use logout instead.');
}
if (!$revoked) {
    \ASDC\ApiResponse::error(404, 'SESSION_NOT_FOUND', 'Session not found or already revoked.');
}

\ASDC\ApiResponse::ok([], 'Session revoked successfully.');
