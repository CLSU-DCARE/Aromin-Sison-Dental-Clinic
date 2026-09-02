<?php
header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/mail.php';

secure_session_start();
$input = json_decode(file_get_contents('php://input'), true);
$email = is_array($input) && isset($input['email']) && is_string($input['email']) ? strtolower(trim($input['email'])) : '';
$role = is_array($input) && isset($input['role']) && $input['role'] === 'staff' ? 'staff' : 'patient';

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email address is required.']);
    exit;
}

$now = time();
$attempts = array_values(array_filter($_SESSION['password_reset_attempts'] ?? [], function ($at) use ($now) {
    return is_int($at) && $at > $now - 900;
}));
if (count($attempts) >= 3) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many reset requests. Please wait 15 minutes and try again.']);
    exit;
}
$attempts[] = $now;
$_SESSION['password_reset_attempts'] = $attempts;

$roleSql = $role === 'staff' ? "role IN ('admin', 'staff', 'dentist')" : "role = 'patient'";
$stmt = $pdo->prepare("SELECT user_id, email, full_name FROM users WHERE email = ? AND {$roleSql} AND is_active = 1 LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM password_reset_tokens WHERE user_id = ?')->execute([$user['user_id']]);
        $pdo->prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))')->execute([$user['user_id'], $tokenHash]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Could not create password reset token: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Unable to process the request right now.']);
        exit;
    }

    $scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    $appBase = preg_replace('#/backend/api/auth/forgot-password\.php$#', '', $scriptPath);
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $resetUrl = $scheme . '://' . $host . $appBase . '/auth/reset-password.html?token=' . rawurlencode($token);
    $body = "Hello {$user['full_name']},\n\nUse this link to reset your password:\n\n{$resetUrl}\n\nThe link expires in one hour and can only be used once. If you did not request this, ignore this email.";

    $mailResult = send_email($user['email'], 'Reset your Aromin-Sison Dental Clinic password', $body);
    if (empty($mailResult['ok'])) {
        // Never include the reset URL/token or SMTP credentials in logs.
        error_log('[PASSWORD RESET MAIL FAILED] Delivery failed for user ID ' . $user['user_id']);
    }
}

echo json_encode(['success' => true, 'message' => 'If an active account matches that email, a password reset link has been sent.']);
