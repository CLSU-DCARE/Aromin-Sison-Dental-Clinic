<?php
// CLI-only provisioner for the two shared staff accounts. Passwords must be
// supplied through environment variables and are never stored in this repo.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/autoload.php';

$accounts = [
    ['role' => 'receptionist', 'email' => 'receptionist@arominsison.com', 'prefix' => 'ASDC_BOOTSTRAP_RECEPTIONIST'],
    ['role' => 'dentist', 'email' => 'dentist@arominsison.com', 'prefix' => 'ASDC_BOOTSTRAP_DENTIST'],
];
$pdo = \ASDC\Database::pdo();
$pdo->beginTransaction();
try {
    foreach ($accounts as $account) {
        $password = (string) getenv($account['prefix'] . '_PASSWORD');
        $name = trim((string) (getenv($account['prefix'] . '_NAME') ?: ($account['role'] === 'dentist' ? 'Clinic Dentist' : 'Clinic Receptionist')));
        if (strlen($password) < 12) throw new RuntimeException('Set ' . $account['prefix'] . '_PASSWORD to a password with at least 12 characters.');

        $check = $pdo->prepare('SELECT user_id, role FROM users WHERE email=?');
        $check->execute([$account['email']]);
        $existing = $check->fetch();
        if ($existing && $existing['role'] === 'patient') throw new RuntimeException('Shared staff email is already assigned to a patient account.');

        $upsert = $pdo->prepare(
            'INSERT INTO users (role,email,password_hash,full_name,is_active) VALUES (?,?,?,?,1)
             ON DUPLICATE KEY UPDATE role=VALUES(role),password_hash=VALUES(password_hash),full_name=VALUES(full_name),is_active=1'
        );
        $upsert->execute([$account['role'], $account['email'], password_hash($password, PASSWORD_DEFAULT), $name]);
        $disable = $pdo->prepare('UPDATE users SET is_active=0 WHERE role=? AND email<>?');
        $disable->execute([$account['role'], $account['email']]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
echo "Shared dentist and receptionist accounts are ready.\n";
