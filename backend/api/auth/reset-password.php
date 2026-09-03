<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}
require_once __DIR__ . '/../../config/db.php';

$input = json_decode(file_get_contents('php://input'), true);
$token = is_array($input) && isset($input['token']) && is_string($input['token']) ? trim($input['token']) : '';
$password = is_array($input) && isset($input['password']) && is_string($input['password']) ? $input['password'] : '';

if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
    http_response_code(400);
    echo json_encode(['error' => 'This password reset link is invalid or incomplete.']);
    exit;
}
if (strlen($password) < 8 || strlen($password) > 128) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be between 8 and 128 characters.']);
    exit;
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT reset_id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE');
    $stmt->execute([hash('sha256', $token)]);
    $reset = $stmt->fetch();
    if (!$reset) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'This password reset link is invalid or has expired. Request a new one.']);
        exit;
    }
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    if ($passwordHash === false) throw new RuntimeException('Password hashing failed.');
    $update = $pdo->prepare('UPDATE users SET password_hash = ? WHERE user_id = ? AND is_active = 1');
    $update->execute([$passwordHash, $reset['user_id']]);
    if ($update->rowCount() !== 1) throw new RuntimeException('Reset account is unavailable.');
    $pdo->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL')->execute([$reset['user_id']]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Password reset failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to reset the password right now.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Your password has been reset.']);
