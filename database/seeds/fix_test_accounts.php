<?php
/**
 * Seed script: Create fresh test accounts with correct password hashes.
 *
 * Run from the project root:
 *   php database/seeds/fix_test_accounts.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Run this script from the command line.');
}

require_once __DIR__ . '/../../backend/autoload.php';
require_once __DIR__ . '/../../backend/config/db.php';

echo "=== Aromin-Sison Dental Clinic: Test Account Seeder ===\n\n";

$accounts = [
    [
        'email'    => 'testadmin@arominsison.com',
        'password' => 'ASDC-Test-Admin-2026!',
        'role'     => 'receptionist',
        'name'     => 'Test Administrator',
    ],
    [
        'email'    => 'dentist@arominsison.com',
        'password' => 'ASDC-Test-Dentist-2026!',
        'role'     => 'dentist',
        'name'     => 'Dr. Test Dentist',
    ],
    [
        'email'    => 'testpatient1@arominsison.com',
        'password' => 'ASDC-Test-Patient-1-2026!',
        'role'     => 'patient',
        'name'     => 'Test Patient One',
        'first'    => 'Test',
        'last'     => 'Patient One',
    ],
    [
        'email'    => 'testpatient2@arominsison.com',
        'password' => 'ASDC-Test-Patient-2-2026!',
        'role'     => 'patient',
        'name'     => 'Test Patient Two',
        'first'    => 'Test',
        'last'     => 'Patient Two',
    ],
];

try {
    // 1. Fix ENUM
    echo "[1/3] Checking users.role ENUM...\n";
    $col = $pdo->query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'")->fetch();
    if ($col && (strpos($col['COLUMN_TYPE'], "'dentist'") === false || strpos($col['COLUMN_TYPE'], "'receptionist'") === false)) {
        // Keep existing roles valid while adding the roles used by the current app.
        $type = $col['COLUMN_TYPE'];
        foreach (['dentist', 'receptionist'] as $role) {
            if (strpos($type, "'$role'") === false) {
                $type = substr($type, 0, -1) . ",'$role')";
            }
        }
        $pdo->exec("ALTER TABLE users MODIFY COLUMN role $type NOT NULL");
        echo "       ENUM updated.\n";
    } else {
        echo "       ENUM OK.\n";
    }

    // 2. Preserve account IDs and all related patient records.
    echo "\n[2/3] Preparing test accounts...\n";
    $emails = array_column($accounts, 'email');
    $placeholders = implode(',', array_fill(0, count($emails), '?'));

    $pdo->beginTransaction();

    // 3. Insert fresh accounts
    echo "\n[3/3] Creating fresh test accounts...\n";
    $userStmt = $pdo->prepare('INSERT INTO users (role, email, password_hash, full_name, is_active) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE user_id = LAST_INSERT_ID(user_id), role = VALUES(role), password_hash = VALUES(password_hash), is_active = 1');
    $existingPatient = $pdo->prepare('SELECT patient_id FROM patients WHERE user_id = ?');
    $patientStmt = $pdo->prepare('INSERT INTO patients (user_id, first_name, last_name, email) VALUES (?, ?, ?, ?)');

    foreach ($accounts as $acct) {
        $hash = password_hash($acct['password'], PASSWORD_DEFAULT);
        $userStmt->execute([$acct['role'], $acct['email'], $hash, $acct['name']]);
        $userId = (int) $pdo->lastInsertId();

        if ($acct['role'] === 'patient' && isset($acct['first'])) {
            $existingPatient->execute([$userId]);
            if (!$existingPatient->fetch()) {
                $patientStmt->execute([$userId, $acct['first'], $acct['last'], $acct['email']]);
            }
        }

        echo "       {$acct['email']} → {$acct['role']}\n";
    }

    $pdo->commit();

    // 4. Verify
    echo "\n=== Verification ===\n";
    echo str_repeat('-', 92) . "\n";
    printf("  %-35s %-14s %-8s %s\n", 'Email', 'Role', 'Hash?', 'Name');
    echo str_repeat('-', 92) . "\n";

    $allEmails = $emails;
    $ph = implode(',', array_fill(0, count($allEmails), '?'));
    $rows = $pdo->prepare("SELECT email, role, password_hash, full_name FROM users WHERE email IN ($ph)");
    $rows->execute($allEmails);

    $pw = [
        'testadmin@arominsison.com'   => 'ASDC-Test-Admin-2026!',
        'dentist@arominsison.com'     => 'ASDC-Test-Dentist-2026!',
        'testpatient1@arominsison.com'=> 'ASDC-Test-Patient-1-2026!',
        'testpatient2@arominsison.com'=> 'ASDC-Test-Patient-2-2026!',
    ];

    $ok = 0;
    $total = 0;
    foreach ($rows as $r) {
        $total++;
        $pass = isset($pw[$r['email']]) ? password_verify($pw[$r['email']], $r['password_hash']) : false;
        if ($pass) $ok++;
        printf("  %-35s %-14s %-8s %s\n", $r['email'], $r['role'], $pass ? 'YES' : 'NO', $r['full_name']);
    }

    echo str_repeat('-', 92) . "\n";
    echo "$ok/$total accounts verified.\n\n";

    if ($ok === $total) {
        echo "All accounts ready! Login at: auth/login.html\n\n";
        echo "Test accounts:\n";
        foreach ($accounts as $a) {
            echo "  {$a['email']} / {$a['password']} -> {$a['role']}\n";
        }
    } else {
        echo "WARNING: Some accounts failed verification!\n";
    }

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
