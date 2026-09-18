<?php
// CLI only. Creates or updates the first receptionist account without storing a default password in the repo.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../backend/autoload.php';

$email = strtolower(trim((string) getenv('ASDC_BOOTSTRAP_RECEPTIONIST_EMAIL')));
$password = (string) getenv('ASDC_BOOTSTRAP_RECEPTIONIST_PASSWORD');
$name = trim((string) (getenv('ASDC_BOOTSTRAP_RECEPTIONIST_NAME') ?: 'Clinic Receptionist'));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Set ASDC_BOOTSTRAP_RECEPTIONIST_EMAIL to a valid email.\n");
    exit(1);
}
if (strlen($password) < 12) {
    fwrite(STDERR, "Set ASDC_BOOTSTRAP_RECEPTIONIST_PASSWORD to a unique password with at least 12 characters.\n");
    exit(1);
}

$pdo = \ASDC\Database::pdo();
$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare(
    "INSERT INTO users (role, email, password_hash, full_name, is_active)
     VALUES ('receptionist', ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
        role = 'receptionist',
        password_hash = VALUES(password_hash),
        full_name = VALUES(full_name),
        is_active = 1"
);
$stmt->execute([$email, $hash, $name]);

echo "Receptionist bootstrap account ready: {$email}\n";
