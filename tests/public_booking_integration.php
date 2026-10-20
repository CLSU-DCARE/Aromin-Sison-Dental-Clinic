<?php
// Uses a disposable database; never writes test requests into the clinic database.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../backend/autoload.php';
$pdo = \ASDC\Database::pdo();
$database = 'asdc_booking_test_' . bin2hex(random_bytes(5));
$pdo->exec("CREATE DATABASE `$database`");
try {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $create = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
        $create = preg_replace('/^CREATE TABLE `[^`]+`/', "CREATE TABLE `$database`.`$table`", $create);
        $pdo->exec($create);
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    $pdo->exec("INSERT INTO `$database`.users (role,email,password_hash,full_name,is_active) VALUES ('receptionist','staff@example.test','unused-test-hash','Test Receptionist',1)");
    $staffId = (int)$pdo->lastInsertId();
    $date = new DateTimeImmutable('+7 days');
    while (\ASDC\HolidayCalendar::closedMessage($date->format('Y-m-d'))) $date = $date->modify('+1 day');
    $request = [
        'first_name' => 'Booking', 'last_name' => 'Integration Test',
        'contact_number' => '09171234567', 'email' => '',
        'service_type' => 'Consultation', 'requested_date' => $date->format('Y-m-d'),
        'requested_time' => '10:00',
    ];
    $code = 'require ' . var_export(dirname(__DIR__) . '/backend/autoload.php', true) . ';'
        . 'putenv(' . var_export('ASDC_DB_NAME=' . $database, true) . ');'
        . '$booking=\\ASDC\\PublicBookingService::submitRequest('
        . var_export($request, true) . ');'
        . 'ini_set("session.save_path",' . var_export(sys_get_temp_dir(), true) . ');'
        . '\\ASDC\\AuthMiddleware::secureSessionStart();'
        . '$_SESSION=["role"=>"receptionist","user_id"=>' . $staffId . '];'
        . '$snapshot=\\ASDC\\StaffDashboardService::snapshot("2000-01-03");'
        . 'echo json_encode(["booking"=>$booking,"snapshot"=>$snapshot]);';
    $process = proc_open([PHP_BINARY, '-r', $code], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    $output = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    if (proc_close($process) !== 0) throw new RuntimeException($errors);
    $result = json_decode($output, true);
    if (($result['booking']['status'] ?? null) !== 'pending') throw new RuntimeException('Booking failed: ' . $output);
    if ((int)$pdo->query("SELECT COUNT(*) FROM `$database`.appointment_requests WHERE status='pending'")->fetchColumn() !== 1) throw new RuntimeException('Request was not saved.');
    if ((int)$pdo->query("SELECT COUNT(*) FROM `$database`.users WHERE role='patient'")->fetchColumn() !== 0) throw new RuntimeException('Booking unexpectedly created an account.');
    $requests = $result['snapshot']['week']['requests'] ?? [];
    if (count($requests) !== 1 || (int)$requests[0]['request_id'] !== (int)$result['booking']['request_id']) throw new RuntimeException('Receptionist snapshot is missing the out-of-week public booking.');
    if (count($result['snapshot']['notifications'] ?? []) !== 1) throw new RuntimeException('Receptionist did not receive the booking notification.');
    echo "Public booking saves a pending request without a patient account and appears in the receptionist snapshot and inbox regardless of selected week.\n";
} finally {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    $pdo->exec("DROP DATABASE `$database`");
}
