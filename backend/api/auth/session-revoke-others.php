<?php
/**
 * POST /backend/api/auth/session-revoke-others.php
 * Revoke all other sessions for the current user.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');
\ASDC\CsrfToken::requireValid();
\ASDC\AuthMiddleware::requireLogin();

$userId = \ASDC\AuthMiddleware::userId();
$currentSessionId = session_id();

$revokedCount = \ASDC\SessionManager::revokeAllOtherSessions($userId, $currentSessionId);

\ASDC\ApiResponse::ok(['revoked_count' => $revokedCount], 'All other sessions revoked successfully.');