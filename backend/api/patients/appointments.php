<?php
/**
 * Patient appointment API.
 *
 * The patient_id is always resolved from the authenticated session.
 * It is never accepted from the browser.
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/appointments.php';

require_role('patient');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST', 'PATCH'], true)) {
    header('Allow: GET, POST, PATCH');
    respond_error(405, 'Method not allowed.');
}

$patientId = current_patient_id($pdo, (int) $_SESSION['user_id']);

if ($method === 'GET') {
    list_appointments($pdo, $patientId);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond_error(400, 'A valid JSON request body is required.');
}

if ($method === 'POST') {
    create_appointment($pdo, $patientId, $input);
}

reschedule_appointment($pdo, $patientId, $input);

function respond_error(int $status, string $message): void
{
    appointment_error($status, $status === 409 ? 'slot_unavailable' : 'request_failed', $message);
}

function current_patient_id(PDO $pdo, int $userId): int
{
    $statement = $pdo->prepare('
        SELECT patient_id
        FROM patients
        WHERE user_id = ?
        LIMIT 1
    ');
    $statement->execute([$userId]);
    $patient = $statement->fetch();

    if (!$patient) {
        respond_error(404, 'No patient profile is linked to this account.');
    }

    return (int) $patient['patient_id'];
}

function valid_date(string $value): bool
{
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    $errors = DateTime::getLastErrors();

    return $date !== false
        && (!$errors || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))
        && $date->format('Y-m-d') === $value;
}

function normalized_time(string $value): ?string
{
    $value = trim($value);
    foreach (['!g:i A', '!H:i', '!H:i:s'] as $format) {
        $time = DateTime::createFromFormat($format, strtoupper($value));
        $errors = DateTime::getLastErrors();
        if ($time !== false && (!$errors || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
            return $time->format('H:i:s');
        }
    }

    return null;
}

function status_label(string $status): string
{
    return $status === 'no_show'
        ? 'No-Show'
        : ucfirst($status);
}

function status_tag(string $status): string
{
    if (in_array($status, ['confirmed', 'completed'], true)) {
        return 'green';
    }
    if ($status === 'pending') {
        return 'amber';
    }

    return 'red';
}

function format_appointment(array $row): array
{
    $date = new DateTime($row['scheduled_date']);
    $time = DateTime::createFromFormat('H:i:s', $row['scheduled_time']);
    $timeLabel = $time ? $time->format('g:i A') : $row['scheduled_time'];
    $dentist = $row['dentist_name'] ?: 'Clinic assignment';
    $status = status_label($row['status']);
    $tag = status_tag($row['status']);

    return [
        'appointment_id' => (int) $row['appointment_id'],
        'scheduled_date' => $row['scheduled_date'],
        'scheduled_time' => $row['scheduled_time'],
        'date' => $date->format('M j, Y'),
        'time' => $timeLabel,
        'd' => $date->format('d'),
        'm' => $date->format('M'),
        'svc' => $row['service_type'],
        'dentist' => $dentist,
        'meta' => $timeLabel . ' · ' . $dentist,
        'status' => $status,
        'tag' => $tag,
    ];
}

function select_appointments(PDO $pdo, int $patientId, string $where, string $order): array
{
    $statement = $pdo->prepare("
        SELECT
            a.appointment_id,
            a.service_type,
            a.scheduled_date,
            a.scheduled_time,
            a.status,
            d.full_name AS dentist_name
        FROM appointments a
        LEFT JOIN users d ON d.user_id = a.dentist_id
        WHERE a.patient_id = ?
          AND ($where)
        ORDER BY $order
    ");
    $statement->execute([$patientId]);

    return array_map('format_appointment', $statement->fetchAll());
}

function list_appointments(PDO $pdo, int $patientId): void
{
    $schedule = select_appointments(
        $pdo,
        $patientId,
        "a.status IN ('pending', 'confirmed')
         AND (
             a.scheduled_date > CURRENT_DATE()
             OR (
                 a.scheduled_date = CURRENT_DATE()
                 AND a.scheduled_time >= CURRENT_TIME()
             )
         )",
        'a.scheduled_date ASC, a.scheduled_time ASC'
    );

    $history = select_appointments(
        $pdo,
        $patientId,
        "a.status IN ('completed', 'cancelled', 'no_show')
         OR a.scheduled_date < CURRENT_DATE()
         OR (
             a.scheduled_date = CURRENT_DATE()
             AND a.scheduled_time < CURRENT_TIME()
         )",
        'a.scheduled_date DESC, a.scheduled_time DESC'
    );

    $upcoming = array_map(
        static function (array $appointment): array {
            return [
                'appointment_id' => $appointment['appointment_id'],
                'd' => $appointment['d'],
                'm' => $appointment['m'],
                'svc' => $appointment['svc'],
                'meta' => $appointment['meta'],
                'status' => $appointment['status'],
                'tag' => $appointment['tag'],
            ];
        },
        $schedule
    );

    appointment_ok(['schedule' => $schedule, 'upcoming' => $upcoming, 'history' => $history]);
}

function create_appointment(PDO $pdo, int $patientId, array $input): void
{
    $service = isset($input['service_type']) && is_string($input['service_type'])
        ? trim($input['service_type'])
        : '';
    $preferredDentist = isset($input['preferred_dentist']) && is_string($input['preferred_dentist'])
        ? trim($input['preferred_dentist'])
        : 'No preference';
    $date = isset($input['scheduled_date']) && is_string($input['scheduled_date'])
        ? trim($input['scheduled_date'])
        : '';
    $timeInput = isset($input['scheduled_time']) && is_string($input['scheduled_time'])
        ? trim($input['scheduled_time'])
        : '';
    $time = normalized_time($timeInput);

    $allowedServices = [
        'Braces Adjustment',
        'Cleaning & Check-up',
        'Consultation',
        'Teeth Whitening',
    ];

    if (!in_array($service, $allowedServices, true)) {
        respond_error(400, 'Please choose a valid service.');
    }
    if (!valid_date($date) || $date < date('Y-m-d')) {
        respond_error(400, 'Please choose today or a future date.');
    }
    if ($time === null) {
        respond_error(400, 'Please choose a valid appointment time.');
    }

    $lock = appointment_lock($pdo, $date, $time);
    $pdo->beginTransaction();
    if (appointment_slot_taken($pdo, $date, $time)) {
        $pdo->rollBack();
        appointment_unlock($pdo, $lock);
        respond_error(409, 'That appointment slot is no longer available.');
    }

    $duplicate = $pdo->prepare("
        SELECT appointment_id
        FROM appointments
        WHERE patient_id = ?
          AND scheduled_date = ?
          AND scheduled_time = ?
          AND status IN ('pending', 'confirmed')
        LIMIT 1
    ");
    $duplicate->execute([$patientId, $date, $time]);
    if ($duplicate->fetch()) {
        respond_error(409, 'You already have an appointment at this date and time.');
    }

    $dentistId = null;
    $notes = null;
    if ($preferredDentist !== '' && $preferredDentist !== 'No preference') {
        $dentist = $pdo->prepare("
            SELECT user_id
            FROM users
            WHERE role = 'dentist'
              AND full_name = ?
              AND is_active = 1
            LIMIT 1
        ");
        $dentist->execute([$preferredDentist]);
        $dentistRow = $dentist->fetch();

        if ($dentistRow) {
            $dentistId = (int) $dentistRow['user_id'];
        } else {
            $notes = 'Preferred dentist: ' . $preferredDentist;
        }
    }

    if ($dentistId !== null) {
        $occupied = $pdo->prepare("
            SELECT appointment_id
            FROM appointments
            WHERE dentist_id = ?
              AND scheduled_date = ?
              AND scheduled_time = ?
              AND status IN ('pending', 'confirmed')
            LIMIT 1
        ");
        $occupied->execute([$dentistId, $date, $time]);
        if ($occupied->fetch()) {
            respond_error(409, 'That dentist is no longer available at the selected time.');
        }
    }

    $insert = $pdo->prepare('
        INSERT INTO appointments (
            patient_id,
            dentist_id,
            service_type,
            scheduled_date,
            scheduled_time,
            status,
            notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $insert->execute([
        $patientId,
        $dentistId,
        $service,
        $date,
        $time,
        'pending',
        $notes,
    ]);

    $appointmentId = (int) $pdo->lastInsertId();
    $pdo->commit();
    appointment_unlock($pdo, $lock);

    appointment_ok(['appointment_id' => $appointmentId, 'status' => 'pending'], 'Appointment booked.', 201);
}

function reschedule_appointment(PDO $pdo, int $patientId, array $input): void
{
    $appointmentId = filter_var(
        $input['appointment_id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );
    $date = isset($input['scheduled_date']) && is_string($input['scheduled_date'])
        ? trim($input['scheduled_date'])
        : '';
    $timeInput = isset($input['scheduled_time']) && is_string($input['scheduled_time'])
        ? trim($input['scheduled_time'])
        : '';
    $time = normalized_time($timeInput);

    if (!$appointmentId) {
        respond_error(400, 'A valid appointment is required.');
    }
    if (!valid_date($date) || $date < date('Y-m-d')) {
        respond_error(400, 'Please choose today or a future date.');
    }
    if ($time === null) {
        respond_error(400, 'Please choose a valid appointment time.');
    }

    $lock = appointment_lock($pdo, $date, $time);
    $pdo->beginTransaction();

    $appointment = $pdo->prepare("
        SELECT appointment_id, dentist_id
        FROM appointments
        WHERE appointment_id = ?
          AND patient_id = ?
          AND status IN ('pending', 'confirmed')
        LIMIT 1
        FOR UPDATE
    ");
    $appointment->execute([(int) $appointmentId, $patientId]);
    $row = $appointment->fetch();

    if (!$row) {
        $pdo->rollBack();
        appointment_unlock($pdo, $lock);
        respond_error(404, 'Appointment not found or cannot be rescheduled.');
    }

    if (appointment_slot_taken($pdo, $date, $time, (int) $appointmentId, null)) {
        $pdo->rollBack();
        appointment_unlock($pdo, $lock);
        respond_error(409, 'That appointment slot is no longer available.');
    }

    if ($row['dentist_id'] !== null) {
        $occupied = $pdo->prepare("
            SELECT appointment_id
            FROM appointments
            WHERE dentist_id = ?
              AND scheduled_date = ?
              AND scheduled_time = ?
              AND status IN ('pending', 'confirmed')
              AND appointment_id <> ?
            LIMIT 1
        ");
        $occupied->execute([
            (int) $row['dentist_id'],
            $date,
            $time,
            (int) $appointmentId,
        ]);
        if ($occupied->fetch()) {
            $pdo->rollBack();
            appointment_unlock($pdo, $lock);
            respond_error(409, 'That dentist is no longer available at the selected time.');
        }
    }

    $update = $pdo->prepare("
        UPDATE appointments
        SET scheduled_date = ?,
            scheduled_time = ?,
            status = 'pending'
        WHERE appointment_id = ?
          AND patient_id = ?
    ");
    $update->execute([$date, $time, (int) $appointmentId, $patientId]);

    $pdo->commit();
    appointment_unlock($pdo, $lock);

    appointment_ok(['appointment_id' => (int) $appointmentId, 'scheduled_date' => $date, 'scheduled_time' => $time], 'Appointment rescheduled.');
}

