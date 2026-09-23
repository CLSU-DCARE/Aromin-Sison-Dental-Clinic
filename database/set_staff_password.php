<?php
// Command line only. Updates passwords only for the canonical shared accounts.
//
//   set ASDC_STAFF_EMAIL=dentist@example.com
//   set ASDC_STAFF_PASSWORD=A-long-unique-password
//   php database/set_staff_password.php
//
// The password is read from the environment so it never lands in shell history or in Git.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../backend/autoload.php';

$email    = strtolower(trim((string) getenv('ASDC_STAFF_EMAIL')));
$password = (string) getenv('ASDC_STAFF_PASSWORD');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Set ASDC_STAFF_EMAIL to the staff member's email.\n");
    exit(1);
}
if (strlen($password) < 12 || strlen($password) > 72) {
    // 72 is the longest password bcrypt really uses.
    fwrite(STDERR, "ASDC_STAFF_PASSWORD must be 12 to 72 characters.\n");
    exit(1);
}

$pdo = \ASDC\Database::pdo();

// Only staff accounts can be changed here. Patients use the normal reset flow.
$find = $pdo->prepare("SELECT user_id FROM users WHERE email = ? AND ((email='dentist@arominsison.com' AND role='dentist') OR (email='receptionist@arominsison.com' AND role='receptionist')) AND is_active=1");
$find->execute([$email]);
$userId = $find->fetchColumn();
if (!$userId) {
    fwrite(STDERR, "No dentist or receptionist account uses that email.\n");
    exit(1);
}

$pdo->prepare('UPDATE users SET password_hash = ?, is_active = 1 WHERE user_id = ?')
    ->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);

// A new password means every old login (any device, any "remember me") must stop working.
\ASDC\SessionManager::revokeAllSessions((int) $userId);
\ASDC\RememberToken::deleteAllForUser((int) $userId);

echo "Password updated for {$email}. Existing logins were signed out.\n";
