<?php
/**
 * GET /backend/api/auth/sessions.php
 * List active sessions for the current user.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('GET');
\ASDC\AuthMiddleware::requireLogin();

$userId = \ASDC\AuthMiddleware::userId();
$sessions = \ASDC\SessionManager::getActiveSessions($userId);
$currentSessionId = session_id();

$sessionsData = array_map(function ($s) use ($currentSessionId) {
    return [
        'session_id' => $s['session_id'],
        'user_agent' => $s['user_agent'],
        'ip_address' => $s['ip_address'],
        'created_at' => $s['created_at'],
        'last_activity' => $s['last_activity'],
        'is_current' => $s['is_current'] || $s['session_id'] === $currentSessionId,
        'remember_token_used' => (bool) $s['remember_token_used'],
    ];
}, $sessions);

\ASDC\ApiResponse::ok(['sessions' => $sessionsData, 'max_concurrent' => \ASDC\SessionManager::getMaxConcurrentSessions()]);