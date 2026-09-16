<?php
// CLI fixtures for real-browser integration tests. Never stores deliverable contact details.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/autoload.php';
$pdo = \ASDC\Database::pdo();
$key = $argv[2] ?? '';
if (!preg_match('/^[a-f0-9]{16}$/', $key)) throw new RuntimeException('Invalid fixture key.');
$prefix = 'portal-test-' . $key;
if (($argv[1] ?? '') === 'cleanup') {
    $stmt = $pdo->prepare('SELECT patient_id FROM patients WHERE last_name=?'); $stmt->execute([$prefix]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) {
        $files = $pdo->prepare('SELECT cp.receipt_path FROM contract_payments cp JOIN braces_contracts c ON c.contract_id=cp.contract_id WHERE c.patient_id=?'); $files->execute([$id]);
        foreach ($files->fetchAll(PDO::FETCH_COLUMN) as $file) {
            $root = realpath(__DIR__ . '/../backend/uploads/receipts');
            $path = $file ? realpath(__DIR__ . '/../backend/' . $file) : false;
            if ($path && $root && str_starts_with($path, $root . DIRECTORY_SEPARATOR) && str_starts_with(basename($path), 'receipt_' . $id . '_')) unlink($path);
        }
        $pdo->prepare('DELETE FROM patients WHERE patient_id=?')->execute([$id]);
    }
    $pdo->prepare('DELETE FROM users WHERE email LIKE ?')->execute([$prefix . '-%@example.invalid']);
    echo "Fixtures removed.\n"; exit;
}
if (($argv[1] ?? '') === 'verify') {
    $stmt = $pdo->prepare('SELECT a.status FROM appointments a JOIN patients p ON p.patient_id=a.patient_id WHERE p.last_name=? ORDER BY a.appointment_id'); $stmt->execute([$prefix]);
    echo json_encode(['statuses' => $stmt->fetchAll(PDO::FETCH_COLUMN)]); exit;
}
$password = bin2hex(random_bytes(20)); $accounts = [];
foreach (['receptionist','dentist','patient','other','other_dentist'] as $roleKey) {
    $role = $roleKey === 'other' ? 'patient' : ($roleKey === 'other_dentist' ? 'dentist' : $roleKey);
    $email = $prefix . '-' . $roleKey . '@example.invalid';
    $name = 'Portal ' . $roleKey . ' ' . $key;
    $pdo->prepare('INSERT INTO users(role,email,password_hash,full_name,is_active) VALUES(?,?,?,?,1)')->execute([$role, $email, password_hash($password, PASSWORD_DEFAULT), $name]);
    $id = (int) $pdo->lastInsertId();
    $accounts[$roleKey] = ['user_id' => $id, 'email' => $email, 'password' => $password, 'name' => $name];
    if ($role === 'patient') {
        $pdo->prepare('INSERT INTO patients(user_id,first_name,last_name) VALUES(?,?,?)')->execute([$id, $roleKey, $prefix]);
        $accounts[$roleKey]['patient_id'] = (int) $pdo->lastInsertId();
    }
}
$date = date('Y-m-d', strtotime('+1 day'));
while (true) {
    $free = true;
    foreach (['09:00:00','09:30:00','10:00:00','10:30:00','11:00:00','13:00:00','13:30:00'] as $time) if (\ASDC\AppointmentSlotManager::isTaken($pdo, $date, $time)) $free = false;
    if ($free) break;
    $date = date('Y-m-d', strtotime($date . ' +1 day'));
}
echo json_encode(['accounts' => $accounts, 'date' => $date]);
