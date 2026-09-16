<?php
/**
 * Appointment actions endpoint (approve/reschedule/cancel).
 * Delegates to ASDC\AppointmentService.
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/appointments.php';
require_role('receptionist', 'dentist');
\ASDC\CsrfToken::requireValid();
appointment_assert_method('POST', 'PATCH');

$body   = appointment_body();
$action = isset($body['action']) && is_string($body['action']) ? strtolower(trim($body['action'])) : '';
$type   = ($body['resource_type'] ?? 'appointment') === 'request' ? 'request' : 'appointment';
$key    = $type === 'request' ? 'request_id' : 'appointment_id';
$id     = appointment_positive_id($body[$key] ?? null);

if (!in_array($action, ['approve', 'reschedule', 'cancel', 'reject', 'complete', 'no_show'], true) || !$id) {
    appointment_error(422, 'validation_failed', 'A valid action and resource identifier are required.');
}

match ($action) {
    'reject'     => \ASDC\AppointmentService::cancel($type, $id, 'rejected'),
    'complete'   => \ASDC\AppointmentService::cancel($type, $id, 'completed'),
    'no_show'    => \ASDC\AppointmentService::cancel($type, $id, 'no_show'),
    'cancel'     => \ASDC\AppointmentService::cancel($type, $id),
    'reschedule' => \ASDC\AppointmentService::reschedule($type, $id, $body['scheduled_date'] ?? '', $body['scheduled_time'] ?? ''),
    'approve'    => \ASDC\AppointmentService::approve($type, $id, \ASDC\InputValidator::positiveId($body['dentist_id'] ?? null)),
};
