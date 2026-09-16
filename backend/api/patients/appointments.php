<?php
/**
 * Patient appointment API endpoint.
 *
 * The patient_id is always resolved from the authenticated session.
 * Delegates to ASDC\PatientAppointmentService.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/appointments.php';
require_role('patient');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST', 'PATCH'], true)) {
    header('Allow: GET, POST, PATCH');
    appointment_error(405, 'request_failed', 'Method not allowed.');
}

$patientId = \ASDC\PatientService::resolvePatientId((int) $_SESSION['user_id']);

if ($method === 'GET') {
    appointment_ok(\ASDC\PatientAppointmentService::listAppointments($patientId));
}

\ASDC\CsrfToken::requireValid();

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    appointment_error(400, 'request_failed', 'A valid JSON request body is required.');
}

if ($method === 'POST') {
    $result = \ASDC\PatientAppointmentService::create($patientId, $input);
    appointment_ok($result, 'Appointment booked.', 201);
}

if (($input['action'] ?? '') === 'cancel') {
    appointment_ok(\ASDC\PatientAppointmentService::cancel($patientId, $input), 'Appointment cancelled.');
}
$result = \ASDC\PatientAppointmentService::reschedule($patientId, $input);
appointment_ok($result, 'Appointment rescheduled.');
