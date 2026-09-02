<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/appointments.php';

appointment_assert_method('POST');
$body = appointment_body();
[$date, $time] = appointment_validate_slot($body, 'requested_date', 'requested_time');

$values = [];
foreach (['first_name','last_name','contact_number','service_type'] as $field) {
    $values[$field] = isset($body[$field]) && is_string($body[$field]) ? trim($body[$field]) : '';
}
$email = isset($body['email']) && is_string($body['email']) ? trim($body['email']) : '';
$fields = [];
foreach (['first_name','last_name','contact_number','service_type'] as $field) {
    if ($values[$field] === '') $fields[$field] = 'This field is required.';
}
if (strlen($values['first_name']) > 100 || strlen($values['last_name']) > 100) $fields['name'] = 'Names must be 100 characters or fewer.';
if (strlen($values['contact_number']) > 20 || !preg_match('/^[0-9+() .-]{7,20}$/', $values['contact_number'])) $fields['contact_number'] = 'Enter a valid contact number.';
if (strlen($values['service_type']) > 150) $fields['service_type'] = 'Service must be 150 characters or fewer.';
if ($email !== '' && (strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL))) $fields['email'] = 'Enter a valid email address.';
$dentistId = isset($body['preferred_dentist_id']) ? appointment_positive_id($body['preferred_dentist_id']) : null;
if (isset($body['preferred_dentist_id']) && !$dentistId) $fields['preferred_dentist_id'] = 'Choose a valid dentist.';
if ($fields) appointment_error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);
if ($dentistId) {
    $stmt = $pdo->prepare("SELECT 1 FROM users WHERE user_id=? AND role='dentist' AND is_active=1");
    $stmt->execute([$dentistId]);
    if (!$stmt->fetchColumn()) appointment_error(422, 'validation_failed', 'Please choose an active dentist.', ['preferred_dentist_id' => 'Dentist is unavailable.']);
}

$lock = appointment_lock($pdo, $date, $time);
try {
    $pdo->beginTransaction();
    if (appointment_slot_taken($pdo, $date, $time)) {
        $pdo->rollBack();
        appointment_error(409, 'slot_unavailable', 'That appointment slot is no longer available.');
    }
    $stmt = $pdo->prepare('INSERT INTO appointment_requests (first_name,last_name,email,contact_number,service_type,preferred_dentist_id,requested_date,requested_time,notes) VALUES (?,?,?,?,?,?,?,?,?)');
    $stmt->execute([$values['first_name'],$values['last_name'],$email ?: null,$values['contact_number'],$values['service_type'],$dentistId,$date,$time,isset($body['notes']) && is_string($body['notes']) ? trim($body['notes']) : null]);
    $id = (int) $pdo->lastInsertId();
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Appointment request failed: ' . $e->getMessage());
    appointment_error(500, 'booking_failed', 'Unable to save the appointment request.');
} finally {
    appointment_unlock($pdo, $lock);
}
appointment_ok(['request_id' => $id, 'status' => 'pending'], 'Appointment request received.', 201);
