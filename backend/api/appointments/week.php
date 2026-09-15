<?php
/**
 * Week appointments + pending requests endpoint.
 * Delegates to ASDC\AppointmentService.
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/appointments.php';
require_role('receptionist', 'dentist');
appointment_assert_method('GET');

try {
    $week = \ASDC\AppointmentService::getWeek($_GET['start'] ?? date('Y-m-d', strtotime('monday this week')));
    \ASDC\ApiResponse::ok($week);
} catch (\PDOException $error) {
    error_log('Appointment week load failed: ' . $error->getMessage());
    \ASDC\ApiResponse::error(500, 'server_error', 'Unable to load appointments.');
}
