<?php
/**
 * POST /backend/api/auth/auto-login.php
 * Attempts to log in using a remember token cookie.
 * Used when session is expired but remember token is present.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');
\ASDC\CsrfToken::requireValid();

\ASDC\AuthMiddleware::secureSessionStart();

// If already logged in, return current user
if (!empty($_SESSION['user_id'])) {
    $result = \ASDC\AuthService::me();
    if ($result) {
        \ASDC\ApiResponse::ok($result['user'], 'Already logged in.');
    }
}

// Check for remember token
$token = \ASDC\RememberToken::getCookieToken();
if (!$token) {
    \ASDC\ApiResponse::error(401, 'NO_REMEMBER_TOKEN', 'No remember token found.');
}

$userId = \ASDC\RememberToken::validate($token);
if (!$userId) {
    // Invalid or expired token, clear cookie
    \ASDC\RememberToken::clearCookie();
    \ASDC\ApiResponse::error(401, 'INVALID_REMEMBER_TOKEN', 'Remember token is invalid or expired.');
}

// Token valid - create new session
$pdo = \ASDC\Database::pdo();
$stmt = $pdo->prepare('SELECT user_id, role, email, full_name, is_active FROM users WHERE user_id = ? AND is_active = 1');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user || !in_array($user['role'], \ASDC\AuthService::ALLOWED_ROLES, true)) {
    \ASDC\RememberToken::clearCookie();
    \ASDC\ApiResponse::error(401, 'ACCOUNT_UNAVAILABLE', 'Account is no longer available.');
}

// Create new session
session_regenerate_id(true);
\ASDC\CsrfToken::regenerate();

$_SESSION['user_id'] = $user['user_id'];
$_SESSION['role'] = $user['role'];
$_SESSION['email'] = $user['email'];
$_SESSION['full_name'] = $user['full_name'];
$_SESSION['last_activity'] = time();
$_SESSION['remember_me'] = true;

// Register active session
$sessionId = session_id();
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
$ipAddress = \ASDC\AuthMiddleware::getClientIp();
\ASDC\SessionManager::registerSession($user['user_id'], $sessionId, $userAgent, $ipAddress, true);

// Delete the used remember token (single-use per login)
\ASDC\RememberToken::delete($token);
\ASDC\RememberToken::clearCookie();

// Audit log
\ASDC\SessionAudit::logRememberUsed($user['user_id'], $sessionId, 0); // token age unknown here

unset($user['password_hash'], $user['is_active']);

\ASDC\ApiResponse::ok($user, 'Auto-login successful.');