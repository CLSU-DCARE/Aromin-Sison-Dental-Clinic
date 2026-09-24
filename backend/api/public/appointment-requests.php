<?php
/**
 * Public appointment request endpoint.
 * Delegates to ASDC\PublicBookingService.
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/appointments.php';
appointment_assert_method('POST');

$rateKey = 'booking:' . \ASDC\AuthMiddleware::getClientIp();
if (\ASDC\RateLimiter::lockoutRemaining($rateKey) > 0) {
    appointment_error(429, 'rate_limited', 'Too many booking requests. Please wait a few minutes before trying again.');
}

$body   = appointment_body();
$result = \ASDC\PublicBookingService::submitRequest($body);
// Count only requests that passed validation and were stored, so someone who
// corrects a form mistake is not penalized.
\ASDC\RateLimiter::record($rateKey, 5, 900);
appointment_ok($result, 'Appointment request received.', 201);
