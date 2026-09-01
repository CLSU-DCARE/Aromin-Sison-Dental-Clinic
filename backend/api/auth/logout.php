<?php
/**
 * POST /backend/api/auth/logout.php
 * Destroys the server-side session so a "logout" actually invalidates the
 * session id. Wire this into the dashboards' logout flow (dashboard-core.js
 * initLogout) before redirecting to the login page.
 */

require_once __DIR__ . '/../../config/auth.php';

header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

secure_session_start();

// Clear all session data and delete the session cookie.
$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}

session_destroy();

echo json_encode(['success' => true]);
