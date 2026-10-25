<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../backend/autoload.php';
$date = new DateTimeImmutable('+7 days');
while (\ASDC\HolidayCalendar::closedMessage($date->format('Y-m-d'))) $date = $date->modify('+1 day');
$date = $date->format('Y-m-d');
foreach (\ASDC\AppointmentTimes::TIMES as $time) {
    $slot = \ASDC\InputValidator::slot(['date'=>$date, 'time'=>$time], 'date', 'time');
    if ($slot !== [$date, $time . ':00']) throw new RuntimeException('Allowed time was rejected.');
}
foreach (['21:00', '08:30', '18:00', '12:00', '09:15', '09:00:01'] as $time) {
    foreach (['booking', 'reschedule', 'approval'] as $flow) {
        $setup = 'require ' . var_export(dirname(__DIR__) . '/backend/autoload.php', true) . ';';
        $code = match ($flow) {
            'booking' => '\\ASDC\\PublicBookingService::submitRequest(' . var_export(['requested_date'=>$date, 'requested_time'=>$time], true) . ');',
            'reschedule' => '\\ASDC\\InputValidator::slot(' . var_export(['scheduled_date'=>$date,'scheduled_time'=>$time], true) . ',"scheduled_date","scheduled_time");',
            'approval' => '\\ASDC\\AppointmentTimes::requireAllowed(' . var_export($time, true) . ',"scheduled_time");',
        };
        $process = proc_open([PHP_BINARY, '-r', $setup . $code], [1=>['pipe','w'],2=>['pipe','w']], $pipes);
        $result = json_decode(stream_get_contents($pipes[1]), true);
        $errors = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        if (proc_close($process) !== 0) throw new RuntimeException($errors);
        $key = $flow === 'booking' ? 'requested_time' : 'scheduled_time';
        if (($result['success'] ?? true) !== false || !isset($result['error']['fields'][$key])) throw new RuntimeException("Invalid $flow time accepted: $time");
    }
}
echo "PASS: fixed appointment choices; late-night, after-hours, lunch, off-grid and nonzero-second times rejected for booking, rescheduling and approval.\n";
