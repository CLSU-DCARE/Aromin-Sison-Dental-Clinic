<?php
/**
 * Seed script: Create fresh test accounts with correct password hashes.
 *
 * Run from the project root:
 *   php database/seeds/fix_test_accounts.php
 */

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
    $col = $pdo->query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'aromin_sison_dental' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'")->fetch();
    if ($col && strpos($col['COLUMN_TYPE'], 'admin') !== false) {
        $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('dentist','receptionist','patient') NOT NULL");
        echo "       ENUM updated.\n";
    } else {
        echo "       ENUM OK.\n";
    }

    // 2. Delete old test accounts
    echo "\n[2/3] Clearing old test accounts...\n";
    $emails = array_column($accounts, 'email');
    $placeholders = implode(',', array_fill(0, count($emails), '?'));

    $pdo->prepare("DELETE FROM patients WHERE user_id IN (SELECT user_id FROM users WHERE email IN ($placeholders))")->execute($emails);
    $pdo->prepare("DELETE FROM users WHERE email IN ($placeholders)")->execute($emails);
    echo "       Old accounts removed.\n";

    // 3. Insert fresh accounts
    echo "\n[3/3] Creating fresh test accounts...\n";
    $userStmt = $pdo->prepare('INSERT INTO users (role, email, password_hash, full_name, is_active) VALUES (?, ?, ?, ?, 1)');
    $patientStmt = $pdo->prepare('INSERT INTO patients (user_id, first_name, last_name, email) VALUES (?, ?, ?, ?)');

    foreach ($accounts as $acct) {
        $hash = password_hash($acct['password'], PASSWORD_DEFAULT);
        $userStmt->execute([$acct['role'], $acct['email'], $hash, $acct['name']]);
        $userId = (int) $pdo->lastInsertId();

        if ($acct['role'] === 'patient' && isset($acct['first'])) {
            $patientStmt->execute([$userId, $acct['first'], $acct['last'], $acct['email']]);
        }

        echo "       {$acct['email']} → {$acct['role']}\n";
    }

    // 4. Verify
    echo "\n=== Verification ===\n";
    echo str_repeat('-', 92) . "\n";
    printf("  %-35s %-14s %-8s %s\n", 'Email', 'Role', 'Hash?', 'Name');
    echo str_repeat('-', 92) . "\n";

    $allEmails = $emails;
    $allEmails[] = 'anneperalta023@gmail.com';
    $ph = implode(',', array_fill(0, count($allEmails), '?'));
    $rows = $pdo->prepare("SELECT email, role, password_hash, full_name FROM users WHERE email IN ($ph)");
    $rows->execute($allEmails);

    $pw = [
        'testadmin@arominsison.com'   => 'ASDC-Test-Admin-2026!',
        'dentist@arominsison.com'     => 'ASDC-Test-Dentist-2026!',
        'testpatient1@arominsison.com'=> 'ASDC-Test-Patient-1-2026!',
        'testpatient2@arominsison.com'=> 'ASDC-Test-Patient-2-2026!',
        'anneperalta023@gmail.com'    => 'AnneTest!2026',
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
        echo "  anneperalta023@gmail.com / AnneTest!2026 -> patient\n";
    } else {
        echo "WARNING: Some accounts failed verification!\n";
    }

} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
