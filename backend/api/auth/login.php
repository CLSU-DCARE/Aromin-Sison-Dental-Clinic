<?php
/**
 * POST /backend/api/auth/login.php
 * Body (JSON): { "email": "...", "password": "..." }
 *
 * This is the PATTERN to copy for every other endpoint:
 *  1. Include auth.php + db.php
 *  2. Read + validate input
 *  3. Use a prepared statement (never concatenate SQL strings)
 *  4. Return JSON
 *
 * Security hardening included here:
 *  - hardened session cookie (HttpOnly / SameSite, Secure over HTTPS)
 *  - session_regenerate_id() after login -> prevents session fixation
 *  - per-email failed-attempt counter with a 15-minute lockout
 */

require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json');

// Start a (hardened) session up front so we can track failed attempts.
secure_session_start();

// ---- Brute-force protection ----
define('MAX_ATTEMPTS', 5);
define('LOCKOUT_SECONDS', 900); // 15 minutes

$input = json_decode(file_get_contents('php://input'), true);

$email = strtolower(trim($input['email'] ?? ''));
$password = $input['password'] ?? '';

if (!$email || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required.']);
    exit;
}

if (!isset($_SESSION['login_attempts'])) {
    $_SESSION['login_attempts'] = [];
}

$attempt = $_SESSION['login_attempts'][$email] ?? ['count' => 0, 'lockout_until' => 0];

if (time() < $attempt['lockout_until']) {
    $wait = $attempt['lockout_until'] - time();
    http_response_code(429);
    echo json_encode(['error' => "Too many failed attempts. Try again in {$wait} second(s)."]);
    exit;
}

$stmt = $pdo->prepare('SELECT user_id, role, email, password_hash, full_name FROM users WHERE email = ? AND is_active = 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    $attempt['count']++;
    if ($attempt['count'] >= MAX_ATTEMPTS) {
        $attempt['lockout_until'] = time() + LOCKOUT_SECONDS;
        $attempt['count'] = 0;
        $message = 'Too many failed attempts. This account is locked for 15 minutes.';
        $code = 429;
    } else {
        $message = 'Invalid email or password.';
        $code = 401;
    }
    $_SESSION['login_attempts'][$email] = $attempt;
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

// Success: reset the attempt counter and rotate the session id to prevent fixation.
unset($_SESSION['login_attempts'][$email]);
session_regenerate_id(true);

$_SESSION['user_id'] = $user['user_id'];
$_SESSION['role'] = $user['role'];
$_SESSION['email'] = $user['email'];
$_SESSION['full_name'] = $user['full_name'];
$_SESSION['last_activity'] = time();

unset($user['password_hash']); // never send the hash back to the client

echo json_encode([
    'success' => true,
    'user' => $user
]);
