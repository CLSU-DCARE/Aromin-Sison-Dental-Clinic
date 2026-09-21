<?php
/**
 * POST /backend/api/auth/session-revoke-others.php
 * Revoke all other sessions for the current user.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');
\ASDC\AuthMiddleware::requireLogin();
\ASDC\CsrfToken::requireValid();

$userId = \ASDC\AuthMiddleware::userId();
$currentSessionId = session_id();

$revokedCount = \ASDC\SessionManager::revokeAllOtherSessions($userId, $currentSessionId);
// Other devices must not be able to sign straight back in with an old "remember me" cookie.
\ASDC\RememberToken::deleteAllForUserExcept($userId, \ASDC\RememberToken::getCookieToken());

\ASDC\ApiResponse::ok(['revoked_count' => $revokedCount], 'All other sessions revoked successfully.');
