<?php
/**
 * Public appointment request endpoint.
 * Delegates to ASDC\PublicBookingService.
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/appointments.php';
appointment_assert_method('POST');

$body   = appointment_body();
$result = \ASDC\PublicBookingService::submitRequest($body);
appointment_ok($result, 'Appointment request received.', 201);
