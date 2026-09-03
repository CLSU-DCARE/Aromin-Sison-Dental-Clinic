<?php
/**
 * GET /backend/api/auth/me.php
 * Returns the currently authenticated user's basic account information.
 * Identity is taken exclusively from the server-side session.
 */

require_once __DIR__ . '/../../config/auth.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

require_login();

$stmt = $pdo->prepare('
    SELECT user_id, role, email, full_name
    FROM users
    WHERE user_id = ? AND is_active = 1
');
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    $_SESSION = [];
    session_destroy();
    http_response_code(401);
    echo json_encode(['error' => 'Authenticated account is no longer available.']);
    exit;
}

$allowedRoles = ['dentist', 'receptionist', 'patient'];
if (!in_array($user['role'], $allowedRoles, true) || $user['role'] !== ($_SESSION['role'] ?? null)) {
    $_SESSION = [];
    session_destroy();
    http_response_code(401);
    echo json_encode(['error' => 'Session account information is no longer valid.']);
    exit;
}

echo json_encode([
    'success' => true,
    'user' => $user,
]);
