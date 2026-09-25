<?php
/**
 * GET /backend/api/auth/sessions.php
 * List active sessions for the current user.
 *
 * Each session is identified by "session_ref", a one-way hash. The real PHP
 * session ID is the login secret, so it is never sent to the browser.
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
        'session_ref' => \ASDC\SessionManager::sessionRef($s['session_id']),
        'user_agent' => $s['user_agent'],
        'ip_address' => $s['ip_address'],
        'created_at' => $s['created_at'],
        'last_activity' => $s['last_activity'],
        'is_current' => $s['session_id'] === $currentSessionId,
        'remember_token_used' => (bool) $s['remember_token_used'],
    ];
}, $sessions);

\ASDC\ApiResponse::ok(['sessions' => $sessionsData, 'max_concurrent' => \ASDC\SessionManager::getMaxConcurrentSessions()]);
