<?php
// Runs only against a disposable copy of the schema; no clinic data is changed.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../backend/autoload.php';
ini_set('session.save_path', sys_get_temp_dir());
\ASDC\AuthMiddleware::secureSessionStart();
$pdo = \ASDC\Database::pdo();
$original = $pdo->query('SELECT DATABASE()')->fetchColumn();
$database = 'asdc_payments_test_' . bin2hex(random_bytes(5));
$pdo->exec("CREATE DATABASE `$database`");
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
try {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $create = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
        $create = preg_replace('/^CREATE TABLE `[^`]+`/', "CREATE TABLE `$database`.`$table`", $create);
        $pdo->exec($create);
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    $pdo->exec("USE `$database`");
    // Bring only the disposable fixture up to the patient-status schema.
    $pdo->exec(file_get_contents(__DIR__ . '/../database/migrations/030_patient_status_without_accounts.sql'));
    $pdo->exec("INSERT INTO users (role,email,password_hash,full_name,is_active) VALUES
        ('receptionist','reception@example.test','test','Reception Test',1),
        ('dentist','dentist@example.test','test','Dentist Test',1)");
    $staff = $pdo->query('SELECT user_id, role FROM users ORDER BY user_id')->fetchAll();
    $pdo->exec("INSERT INTO patients (first_name,last_name) VALUES ('Payment','Test')");
    $patient = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO treatment_bills (patient_id,service_treatment,total_amount,balance_amount) VALUES (?,'Cleaning',1000,1000)")->execute([$patient]);
    $bill = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO braces_contracts (patient_id,start_date,total_amount,balance_amount,monthly_payment,duration_months,status) VALUES (?,CURDATE(),2000,2000,1000,2,'active')")->execute([$patient]);
    $contract = (int)$pdo->lastInsertId();
    $base = ['account_id' => 'T-' . $bill, 'amount' => '250.25', 'payment_method' => 'cash', 'payment_date' => date('Y-m-d'), 'note' => 'Test collection'];
    foreach ($staff as $user) {
        $pdo->exec('DELETE FROM active_sessions');
        $_SESSION = ['user_id' => (int)$user['user_id'], 'role' => $user['role'], 'last_activity' => time()];
        $result = \ASDC\StaffPaymentService::record($base);
        check(str_starts_with($result['id'], 'T-'), 'Missing treatment reference.');
        $row = $pdo->query('SELECT * FROM treatment_payments ORDER BY payment_id DESC LIMIT 1')->fetch();
        check($row['status'] === 'approved' && (int)$row['submitted_by'] === (int)$user['user_id'] && (int)$row['reviewed_by'] === (int)$user['user_id'], 'Staff audit fields missing.');
    }
    check((float)$result['balance_amount'] === 499.5, 'Partial payments did not update balance.');
    foreach (['0', '-1', '1.001', 'NaN', '100000000'] as $invalid) {
        try { \ASDC\StaffPaymentService::record(array_replace($base, ['amount' => $invalid])); throw new RuntimeException('Invalid amount accepted.'); }
        catch (InvalidArgumentException $expected) {}
    }
    foreach ([['payment_date'=>'2026-02-30'], ['payment_date'=>date('Y-m-d', strtotime('+2 days'))], ['payment_method'=>'invalid'], ['account_id'=>'T-0']] as $invalid) {
        try { \ASDC\StaffPaymentService::record(array_replace($base, $invalid)); throw new RuntimeException('Invalid payment fields accepted.'); }
        catch (InvalidArgumentException $expected) {}
    }
    $pdo->prepare("INSERT INTO treatment_payments (bill_id,amount_paid,payment_date,status) VALUES (?,100,CURDATE(),'pending')")->execute([$bill]);
    try { \ASDC\StaffPaymentService::record(array_replace($base, ['amount'=>'400'])); throw new RuntimeException('Pending balance was not reserved.'); }
    catch (DomainException $expected) {}
    check(!$pdo->inTransaction(), 'Failed payment left a transaction open.');
    check((int)$pdo->query("SELECT COUNT(*) FROM treatment_payments WHERE status='approved'")->fetchColumn() === 2, 'Rejected entry created a payment.');
    $accounts = \ASDC\StaffPaymentService::accounts();
    $treatment = array_values(array_filter($accounts, fn($item) => $item['id'] === 'T-' . $bill))[0];
    check((float)$treatment['available_amount'] === 399.5, 'Account availability is incorrect.');
    $result = \ASDC\StaffPaymentService::record(array_replace($base, ['account_id'=>'C-' . $contract, 'amount'=>'2000', 'payment_method'=>'bank_transfer']));
    check((float)$result['balance_amount'] === 0.0, 'Contract payment did not settle balance.');
    check($pdo->query("SELECT status FROM braces_contracts WHERE contract_id=$contract")->fetchColumn() === 'completed', 'Contract not completed.');
    $pdo->prepare("UPDATE treatment_payments SET status='rejected' WHERE bill_id=? AND status='pending'")->execute([$bill]);
    \ASDC\StaffPaymentService::record(array_replace($base, ['amount'=>'499.50']));
    check($pdo->query("SELECT status FROM treatment_bills WHERE bill_id=$bill")->fetchColumn() === 'paid', 'Treatment not marked paid.');
    $history = \ASDC\PaymentApprovalService::listAll();
    check(count(array_filter($history, fn($item) => $item['status'] === 'approved')) === 4, 'Collections missing from shared billing history.');
    $snapshot = \ASDC\StaffDashboardService::snapshot(date('Y-m-d'));
    check((float)$snapshot['metrics'][2] === 3000.0, 'Weekly collections must include treatment and braces payments.');
    $ledger = \ASDC\StaffPaymentService::patientBilling($patient);
    check(count($ledger['accounts']) === 2 && count($ledger['payments']) === 5, 'Patient billing must retain settled accounts and all payment statuses.');
    check(array_sum(array_column($ledger['accounts'], 'paid_amount')) == 3000, 'Patient recorded payment total incorrect.');
    $pdo->exec("INSERT INTO patients (first_name,last_name) VALUES ('Other','Patient')");
    $otherPatient = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO treatment_bills (patient_id,service_treatment,total_amount,balance_amount) VALUES (?,'Other bill',200,200)")->execute([$otherPatient]);
    $otherBill = (int)$pdo->lastInsertId();
    try { \ASDC\StaffPaymentService::record(array_replace($base, ['account_id'=>'T-'.$otherBill, 'patient_id'=>$patient, 'amount'=>'25'])); throw new RuntimeException('A payment was assigned to another patient.'); }
    catch (DomainException $expected) {}
    \ASDC\StaffPaymentService::record(array_replace($base, ['account_id'=>'T-'.$otherBill, 'patient_id'=>$otherPatient, 'amount'=>'25']));
    $summaries = \ASDC\StaffPaymentService::patientSummaries();
    check(count($summaries) === 2, 'Billing directory must group by patient.');
    $otherSummary = array_values(array_filter($summaries, fn($item) => $item['patient_id'] === $otherPatient))[0];
    check($otherSummary['paid_amount'] == 25 && $otherSummary['balance_amount'] == 175, 'Patient totals were mixed.');
    check(count(\ASDC\StaffPaymentService::accounts($patient)) === 0, 'Paid patient should have no payable accounts.');
    $otherLedger = \ASDC\StaffPaymentService::patientBilling($otherPatient);
    check(count($otherLedger['payments']) === 1 && count($otherLedger['accounts']) === 1, 'Patient history contains another patient records.');
    $pdo->prepare('DELETE FROM patients WHERE patient_id=?')->execute([$otherPatient]);
    try { \ASDC\StaffPaymentService::record($base); throw new RuntimeException('Paid bill accepted another payment.'); }
    catch (DomainException $expected) {}
    $pdo->prepare("UPDATE treatment_bills SET status='active', balance_amount=100 WHERE bill_id=?")->execute([$bill]);
    $pdo->prepare('UPDATE patients SET archived_at=NOW() WHERE patient_id=?')->execute([$patient]);
    check(count(\ASDC\StaffPaymentService::accounts()) === 0, 'Archived patient is selectable.');
    try { \ASDC\StaffPaymentService::record(array_replace($base, ['amount'=>'50'])); throw new RuntimeException('Archived patient payment accepted.'); }
    catch (DomainException $expected) {}
    echo "Staff payments: both roles, validation, audit, partial/full settlements, pending reservations, rollback and archived patients passed.\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    $pdo->exec("USE `$original`");
    $pdo->exec("DROP DATABASE `$database`");
}
