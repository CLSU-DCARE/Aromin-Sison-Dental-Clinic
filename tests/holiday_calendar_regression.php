<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../backend/autoload.php';

$cases = [
    ['2026-04-02', 'Maundy Thursday'],
    ['2026-04-03', 'Good Friday'],
    ['2026-10-02', null],
    ['2026-10-04', 'Sunday'],
];

$failed = 0;
foreach ($cases as [$date, $expected]) {
    $closure = \ASDC\HolidayCalendar::closureForDate($date);
    $actual = $closure['name'] ?? null;
    $ok = $actual === $expected;
    echo ($ok ? 'PASS' : 'FAIL'), " - $date", $ok ? '' : " (expected " . var_export($expected, true) . ', got ' . var_export($actual, true) . ')', PHP_EOL;
    if (!$ok) $failed++;
}

exit($failed ? 1 : 0);
