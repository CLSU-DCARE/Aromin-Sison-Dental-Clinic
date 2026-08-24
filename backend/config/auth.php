<?php
/**
 * Shared session / authorization helper: Aromin-Sison Dental Clinic System.
 *
 * Include this at the top of ANY endpoint that requires a logged-in user:
 *
 *   require_once __DIR__ . '/../../config/auth.php';
 *   require_login();                    // any authenticated user
 *   require_role('admin', 'staff');     // restrict to specific roles
 *
 * It starts a hardened session (HttpOnly + SameSite cookie, optional Secure),
 * enforces an idle timeout, and centralizes the 401/403 JSON responses so
 * every endpoint returns the same shape.
 */

// Idle timeout: 30 minutes without a request kills the session.
if (!defined('SESSION_TIMEOUT')) {
    define('SESSION_TIMEOUT', 1800);
}

if (!function_exists('secure_session_start')) {
    function secure_session_start() {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        // Secure flags: HttpOnly + SameSite always; Secure only over HTTPS.
        session_set_cookie_params([
            'lifetime' => 0,                                  // browser-session cookie
            'path'     => '/',
            'domain'   => '',
            'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,                               // JS cannot read the cookie
            'samesite' => 'Lax',                              // CSRF mitigation
        ]);
        session_name('ASDC_SESSION');
        session_start();
    }
}

if (!function_exists('require_login')) {
    function require_login() {
        secure_session_start();

        if (empty($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required. Please log in.']);
            exit;
        }

        // Idle timeout: silently destroy an expired session.
        if (!empty($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > SESSION_TIMEOUT) {
            $_SESSION = [];
            session_destroy();
            http_response_code(401);
            echo json_encode(['error' => 'Session expired. Please log in again.']);
            exit;
        }

        $_SESSION['last_activity'] = time();
    }
}

if (!function_exists('require_role')) {
    function require_role(...$roles) {
        require_login();
        if (!in_array($_SESSION['role'], $roles, true)) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden: you do not have permission to access this resource.']);
            exit;
        }
    }
}
