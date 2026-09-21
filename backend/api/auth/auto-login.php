<?php
/**
 * POST /backend/api/auth/auto-login.php
 * Signs the user back in from the "remember me" cookie.
 * Used when the normal session has ended (idle timeout, browser restart) but
 * the person chose "Remember me" on the login form.
 *
 * No CSRF token is needed (same as login.php): the caller has no session yet,
 * so there is no token to send. The request is proven by the HttpOnly remember
 * cookie, which the browser does not attach to cross-site POSTs (SameSite=Lax).
 * We also require a JSON body type, which cross-site HTML forms cannot send.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('POST');

if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    \ASDC\ApiResponse::error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
}

// Already signed in with a healthy session? Just say who it is.
// (inspectSession does not start a session when the browser sent no session cookie,
// so a failed attempt below never changes the browser's cookies.)
if (\ASDC\AuthMiddleware::inspectSession(true) === null) {
    $current = \ASDC\AuthService::me();
    if ($current) {
        \ASDC\ApiResponse::ok($current['user'], 'Already logged in.');
    }
}

$token = \ASDC\RememberToken::getCookieToken();
if (!$token) {
    \ASDC\ApiResponse::error(401, 'NO_REMEMBER_TOKEN', 'No remember token found.');
}

$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
$ipAddress = \ASDC\AuthMiddleware::getClientIp();

$rotation = \ASDC\RememberToken::rotate($token, $userAgent, $ipAddress);
if (!$rotation) {
    \ASDC\RememberToken::clearCookie();
    \ASDC\ApiResponse::error(401, 'INVALID_REMEMBER_TOKEN', 'Remember token is invalid or expired.');
}

$pdo = \ASDC\Database::pdo();
$stmt = $pdo->prepare('SELECT user_id, role, email, full_name FROM users WHERE user_id = ? AND is_active = 1');
$stmt->execute([$rotation['user_id']]);
$user = $stmt->fetch();

if (!$user || !in_array($user['role'], \ASDC\AuthService::ALLOWED_ROLES, true)) {
    \ASDC\RememberToken::deleteAllForUser($rotation['user_id']);
    \ASDC\RememberToken::clearCookie();
    \ASDC\ApiResponse::error(401, 'ACCOUNT_UNAVAILABLE', 'Account is no longer available.');
}

// Fresh session ID for the new login. (A dead session's row was already removed
// by inspectSession, so nothing is left behind.)
\ASDC\AuthMiddleware::secureSessionStart();
session_regenerate_id(true);
$_SESSION = [];
\ASDC\CsrfToken::regenerate();

$_SESSION['user_id'] = $user['user_id'];
$_SESSION['role'] = $user['role'];
$_SESSION['email'] = $user['email'];
$_SESSION['full_name'] = $user['full_name'];
$_SESSION['last_activity'] = time();
$_SESSION['remember_me'] = true;

$sessionId = session_id();
\ASDC\SessionManager::registerSession((int) $user['user_id'], $sessionId, $userAgent, $ipAddress, true);
$_SESSION['session_registered'] = true;

// Hand the browser the replacement token (null = a sibling tab already did).
if ($rotation['new_token'] !== null) {
    \ASDC\RememberToken::setCookie($rotation['new_token']);
}

\ASDC\SessionAudit::logRememberUsed((int) $user['user_id'], $sessionId, 0);

// Same shape as me.php's user (includes the profile picture) so the page can draw itself.
$full = \ASDC\AuthService::me();
\ASDC\ApiResponse::ok($full ? $full['user'] : $user, 'Auto-login successful.');
