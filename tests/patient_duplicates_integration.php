<?php
// All writes, including simultaneous registrations, use a disposable schema.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../backend/autoload.php';
ini_set('session.save_path', sys_get_temp_dir());
\ASDC\AuthMiddleware::secureSessionStart();
$_SESSION = ['role'=>'receptionist'];
$pdo = \ASDC\Database::pdo();
$original = $pdo->query('SELECT DATABASE()')->fetchColumn();
$database = 'asdc_duplicates_test_' . bin2hex(random_bytes(5));
$pdo->exec("CREATE DATABASE `$database`");
function checkDuplicate($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function rejectedDuplicate(callable $call) {
    try { $call(); throw new RuntimeException('Duplicate patient was accepted.'); }
    catch (\ASDC\DuplicatePatientException $expected) { checkDuplicate(str_contains($expected->getMessage(), '#P-'), 'Conflict must identify the existing patient.'); }
}
try {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $create = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
        $create = preg_replace('/^CREATE TABLE `[^`]+`/', "CREATE TABLE `$database`.`$table`", $create);
        $pdo->exec($create);
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    $pdo->exec("USE `$database`");
    $pdo->exec(file_get_contents(__DIR__ . '/../database/migrations/030_patient_status_without_accounts.sql'));
    $base = ['name'=>'Duplicate Patient', 'contact_number'=>'09170000001', 'email'=>'duplicate@example.test'];
    $first = \ASDC\PatientService::create($base)['patient_id'];
    rejectedDuplicate(fn() => \ASDC\PatientService::create($base));
    rejectedDuplicate(fn() => \ASDC\PatientService::create(['name'=>'  DUPLICATE   patient ', 'contact_number'=>'09170000002', 'email'=>'different@example.test']));
    rejectedDuplicate(fn() => \ASDC\PatientService::create(['name'=>'Different Person', 'contact_number'=>'+63 (917) 000-0001', 'email'=>'']));
    rejectedDuplicate(fn() => \ASDC\PatientService::create(['name'=>'Another Person', 'contact_number'=>'09170000003', 'email'=>'DUPLICATE@example.test']));
    checkDuplicate((int)$pdo->query('SELECT COUNT(*) FROM patients')->fetchColumn() === 1, 'Rejected duplicates inserted patient rows.');
    checkDuplicate(!$pdo->inTransaction(), 'Duplicate rejection left a transaction open.');
    $pdo->prepare('UPDATE patients SET is_active=0 WHERE patient_id=?')->execute([$first]);
    rejectedDuplicate(fn() => \ASDC\PatientService::create($base));
    \ASDC\PatientService::delete($first);
    $archivedRecord = \ASDC\PatientService::archivedDetails($first, true);
    checkDuplicate((int)$archivedRecord['patient']['patient_id'] === $first && isset($archivedRecord['appointments']), 'Archived patient record unavailable.');
    checkDuplicate(!isset($archivedRecord['payments']) && !isset($archivedRecord['notifications']) && !isset($archivedRecord['records']), 'Appointment-only archive record includes unrelated history.');
    $replacement = \ASDC\PatientService::create($base)['patient_id'];
    checkDuplicate($replacement !== $first, 'Archived record was overwritten.');
    rejectedDuplicate(fn() => \ASDC\PatientService::restore($first));
    checkDuplicate((bool)$pdo->query("SELECT archived_at FROM patients WHERE patient_id=$first")->fetchColumn(), 'Failed restore altered the archive.');
    $pdo->prepare('UPDATE patients SET is_active=0 WHERE patient_id=?')->execute([$replacement]);
    \ASDC\PatientService::delete($replacement);
    \ASDC\PatientService::restore($first);
    \ASDC\PatientIdentity::locked(fn() => \ASDC\PatientIdentity::assertAvailable($base['name'], $base['contact_number'], $base['email'], $first));
    $method = new ReflectionMethod(\ASDC\AppointmentService::class, 'findOrCreatePatient');
    $pdo->beginTransaction();
    $linked = $method->invoke(null, $pdo, ['first_name'=>'DUPLICATE', 'last_name'=>'  Patient ', 'contact_number'=>'+639170000001', 'email'=>'']);
    $pdo->commit();
    checkDuplicate($linked === $first, 'Booking created a duplicate instead of reusing the existing patient.');
    // Different patients may leave optional email empty.
    \ASDC\PatientService::create(['name'=>'Unique Patient', 'contact_number'=>'09170000004', 'email'=>'']);
    \ASDC\PatientService::create(['name'=>'Separate Patient', 'contact_number'=>'09170000005', 'email'=>'']);
    $race = ['name'=>'Concurrent Patient', 'contact_number'=>'09170000008', 'email'=>''];
    $code = 'putenv(' . var_export('ASDC_DB_NAME=' . $database, true) . ');require ' . var_export(dirname(__DIR__) . '/backend/autoload.php', true) . ';'
        . 'try { \\ASDC\\PatientService::create(' . var_export($race, true) . '); echo "created"; } catch (\\ASDC\\DuplicatePatientException $e) { echo "duplicate"; }';
    $processes = [];
    for ($i=0; $i<2; $i++) {
        $process = proc_open([PHP_BINARY, '-r', $code], [0=>['pipe','r'], 1=>['pipe','w'], 2=>['pipe','w']], $pipes);
        if (!is_resource($process)) throw new RuntimeException('Could not launch concurrent registration test.');
        fclose($pipes[0]);
        $processes[] = [$process, $pipes];
    }
    $results = [];
    foreach ($processes as [$process, $pipes]) {
        $results[] = stream_get_contents($pipes[1]); $errors = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        checkDuplicate(proc_close($process) === 0, $errors);
    }
    sort($results);
    checkDuplicate($results === ['created','duplicate'], 'Concurrent requests created duplicate patients: ' . json_encode($results));
    echo "PASS: duplicate names/emails/normalised phones, inactive records, archived replacements, restore conflicts, booking reuse, optional emails and concurrent registrations.\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    $pdo->exec("USE `$original`");
    $pdo->exec("DROP DATABASE `$database`");
}
