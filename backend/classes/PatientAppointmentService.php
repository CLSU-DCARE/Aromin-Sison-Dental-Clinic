<?php
/**
 * Patient-facing appointment operations: Aromin-Sison Dental Clinic System.
 *
 * List, create, and reschedule appointments for authenticated patients.
 *
 * Usage:
 *   $data = PatientAppointmentService::listAppointments($patientId);
 *   $data = PatientAppointmentService::create($patientId, $input);
 *   $data = PatientAppointmentService::reschedule($patientId, $input);
 */

namespace ASDC;

use PDO;
use DateTime;

class PatientAppointmentService
{
    /**
     * List a patient's upcoming and past appointments.
     *
     * @return array{schedule: array, upcoming: array, history: array}
     */
    public static function listAppointments(int $patientId): array
    {
        $pdo = Database::pdo();

        $schedule = self::select(
            $pdo,
            $patientId,
            "a.status IN ('pending', 'confirmed')
             AND (
                 a.scheduled_date > CURRENT_DATE()
                 OR (a.scheduled_date = CURRENT_DATE() AND a.scheduled_time >= CURRENT_TIME())
             )",
            'a.scheduled_date ASC, a.scheduled_time ASC'
        );

        $history = self::select(
            $pdo,
            $patientId,
            "a.status IN ('completed', 'cancelled', 'no_show', 'rejected')
             OR a.scheduled_date < CURRENT_DATE()
             OR (a.scheduled_date = CURRENT_DATE() AND a.scheduled_time < CURRENT_TIME())",
            'a.scheduled_date DESC, a.scheduled_time DESC'
        );

        $upcoming = array_map(
            static fn(array $a) => [
                'appointment_id' => $a['appointment_id'],
                'd'  => $a['d'],
                'm'  => $a['m'],
                'svc' => $a['svc'],
                'meta' => $a['meta'],
                'status' => $a['status'],
                'tag'  => $a['tag'],
            ],
            $schedule
        );

        return ['schedule' => $schedule, 'upcoming' => $upcoming, 'history' => $history];
    }

    /**
     * Book a new appointment for a patient.
     *
     * @return array{appointment_id: int, status: string}
     */
    public static function create(int $patientId, array $input): array
    {
        $service   = self::trimmed($input, 'service_type');
        $date      = self::trimmed($input, 'scheduled_date');
        $timeInput = self::trimmed($input, 'scheduled_time');
        $preferred = self::trimmed($input, 'preferred_dentist') ?: 'No preference';
        $time      = InputValidator::time($timeInput);

        $allowedServices = ['Braces Adjustment', 'Cleaning & Check-up', 'Consultation', 'Teeth Whitening'];

        if (!in_array($service, $allowedServices, true)) {
            ApiResponse::error(400, 'request_failed', 'Please choose a valid service.');
        }
        if (!InputValidator::date($date) || $date < date('Y-m-d')) {
            ApiResponse::error(400, 'request_failed', 'Please choose today or a future date.');
        }
        if ($time === null) {
            ApiResponse::error(400, 'request_failed', 'Please choose a valid appointment time.');
        }

        $pdo  = Database::pdo();
        $lock = AppointmentSlotManager::lock($pdo, $date, $time);

        try {
        $pdo->beginTransaction();

        if (AppointmentSlotManager::isTaken($pdo, $date, $time)) {
            $pdo->rollBack();
            AppointmentSlotManager::unlock($pdo, $lock);
            ApiResponse::error(409, 'slot_unavailable', 'That appointment slot is no longer available.');
        }

        $dup = $pdo->prepare(
            "SELECT appointment_id FROM appointments
             WHERE patient_id=? AND scheduled_date=? AND scheduled_time=?
               AND status IN ('pending','confirmed') LIMIT 1"
        );
        $dup->execute([$patientId, $date, $time]);
        if ($dup->fetch()) {
            $pdo->rollBack();
            AppointmentSlotManager::unlock($pdo, $lock);
            ApiResponse::error(409, 'slot_unavailable', 'You already have an appointment at this date and time.');
        }

        $dentistId = null;
        $notes = null;

        if ($preferred !== '' && $preferred !== 'No preference') {
            $dentist = $pdo->prepare(
                "SELECT user_id FROM users WHERE role='dentist' AND full_name=? AND is_active=1 LIMIT 1"
            );
            $dentist->execute([$preferred]);
            $row = $dentist->fetch();
            if ($row) {
                $dentistId = (int) $row['user_id'];
            } else {
                $pdo->rollBack();
                ApiResponse::error(422, 'validation_failed', 'Choose an active dentist or no preference.');
            }
        }

        if ($dentistId !== null) {
            $occ = $pdo->prepare(
                "SELECT appointment_id FROM appointments
                 WHERE dentist_id=? AND scheduled_date=? AND scheduled_time=?
                   AND status IN ('pending','confirmed') LIMIT 1"
            );
            $occ->execute([$dentistId, $date, $time]);
            if ($occ->fetch()) {
                $pdo->rollBack();
                AppointmentSlotManager::unlock($pdo, $lock);
                ApiResponse::error(409, 'slot_unavailable', 'That dentist is no longer available at the selected time.');
            }
        }

        $insert = $pdo->prepare(
            "INSERT INTO appointments(patient_id,dentist_id,service_type,scheduled_date,scheduled_time,status,notes)
             VALUES(?,?,?,?,?, 'pending',?)"
        );
        $insert->execute([$patientId, $dentistId, $service, $date, $time, $notes]);
        $appointmentId = (int) $pdo->lastInsertId();

        PortalEvent::appointment($appointmentId, 'requested');
        $pdo->commit();
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        finally { AppointmentSlotManager::unlock($pdo, $lock); }

        return ['appointment_id' => $appointmentId, 'status' => 'pending'];
    }

    /**
     * Reschedule an existing patient appointment.
     *
     * @return array{appointment_id: int, scheduled_date: string, scheduled_time: string}
     */
    public static function reschedule(int $patientId, array $input): array
    {
        $appointmentId = InputValidator::positiveId($input['appointment_id'] ?? null);
        $date          = self::trimmed($input, 'scheduled_date');
        $timeInput     = self::trimmed($input, 'scheduled_time');
        $time          = InputValidator::time($timeInput);

        if (!$appointmentId) {
            ApiResponse::error(400, 'request_failed', 'A valid appointment is required.');
        }
        if (!InputValidator::date($date) || $date < date('Y-m-d')) {
            ApiResponse::error(400, 'request_failed', 'Please choose today or a future date.');
        }
        if ($time === null) {
            ApiResponse::error(400, 'request_failed', 'Please choose a valid appointment time.');
        }

        $pdo  = Database::pdo();
        $lock = AppointmentSlotManager::lock($pdo, $date, $time);

        try {
        $pdo->beginTransaction();

        $appt = $pdo->prepare(
            "SELECT appointment_id, dentist_id FROM appointments
             WHERE appointment_id=? AND patient_id=? AND status IN ('pending','confirmed')
             AND TIMESTAMP(scheduled_date,scheduled_time) > NOW()
             LIMIT 1 FOR UPDATE"
        );
        $appt->execute([$appointmentId, $patientId]);
        $row = $appt->fetch();

        if (!$row) {
            $pdo->rollBack();
            AppointmentSlotManager::unlock($pdo, $lock);
            ApiResponse::error(404, 'not_found', 'Appointment not found or cannot be rescheduled.');
        }

        if (AppointmentSlotManager::isTaken($pdo, $date, $time, $appointmentId, null)) {
            $pdo->rollBack();
            AppointmentSlotManager::unlock($pdo, $lock);
            ApiResponse::error(409, 'slot_unavailable', 'That appointment slot is no longer available.');
        }

        if ($row['dentist_id'] !== null) {
            $occ = $pdo->prepare(
                "SELECT appointment_id FROM appointments
                 WHERE dentist_id=? AND scheduled_date=? AND scheduled_time=?
                   AND status IN ('pending','confirmed') AND appointment_id<>? LIMIT 1"
            );
            $occ->execute([$row['dentist_id'], $date, $time, $appointmentId]);
            if ($occ->fetch()) {
                $pdo->rollBack();
                AppointmentSlotManager::unlock($pdo, $lock);
                ApiResponse::error(409, 'slot_unavailable', 'That dentist is no longer available at the selected time.');
            }
        }

        $pdo->prepare(
            "UPDATE appointments SET scheduled_date=?, scheduled_time=?, status='pending'
             WHERE appointment_id=? AND patient_id=?"
        )->execute([$date, $time, $appointmentId, $patientId]);

        PortalEvent::appointment($appointmentId, 'reschedule requested');
        $pdo->commit();
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        finally { AppointmentSlotManager::unlock($pdo, $lock); }

        return ['appointment_id' => $appointmentId, 'scheduled_date' => $date, 'scheduled_time' => $time];
    }

    /* ------------------------------------------------------------------
     *  Private helpers
     * ----------------------------------------------------------------*/

    private static function trimmed(array $input, string $key): string
    {
        return isset($input[$key]) && is_string($input[$key]) ? trim($input[$key]) : '';
    }

    public static function cancel(int $patientId, array $input): array
    {
        $id = InputValidator::positiveId($input['appointment_id'] ?? null);
        if (!$id) ApiResponse::error(422, 'validation_failed', 'Choose an appointment.');
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("UPDATE appointments SET status='cancelled' WHERE appointment_id=? AND patient_id=? AND status IN ('pending','confirmed') AND TIMESTAMP(scheduled_date,scheduled_time)>NOW()");
            $stmt->execute([$id, $patientId]);
            if (!$stmt->rowCount()) { $pdo->rollBack(); ApiResponse::error(404, 'not_found', 'Appointment not found or no longer cancellable.'); }
            PortalEvent::appointment($id, 'cancelled');
            $pdo->commit();
            return ['appointment_id' => $id, 'status' => 'cancelled'];
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }

    private static function statusLabel(string $status): string
    {
        return $status === 'no_show' ? 'No-Show' : ucfirst($status);
    }

    private static function statusTag(string $status): string
    {
        if (in_array($status, ['confirmed', 'completed'], true)) return 'green';
        if ($status === 'pending') return 'amber';
        return 'red';
    }

    private static function formatAppointment(array $row): array
    {
        $date  = new DateTime($row['scheduled_date']);
        $time  = DateTime::createFromFormat('H:i:s', $row['scheduled_time']);
        $label = $time ? $time->format('g:i A') : $row['scheduled_time'];
        $dentist = $row['dentist_name'] ?: 'Clinic assignment';
        $status  = self::statusLabel($row['status']);

        return [
            'appointment_id' => (int) $row['appointment_id'],
            'scheduled_date' => $row['scheduled_date'],
            'scheduled_time' => $row['scheduled_time'],
            'date' => $date->format('M j, Y'),
            'time' => $label,
            'd'    => $date->format('d'),
            'm'    => $date->format('M'),
            'svc'  => $row['service_type'],
            'dentist' => $dentist,
            'meta' => $label . ' · ' . $dentist,
            'status' => $status,
            'status_code' => $row['status'],
            'notes' => $row['notes'] ?? '',
            'tag'    => self::statusTag($row['status']),
        ];
    }

    private static function select(PDO $pdo, int $patientId, string $where, string $order): array
    {
        $stmt = $pdo->prepare("
            SELECT a.appointment_id, a.service_type, a.scheduled_date,
                   a.scheduled_time, a.status, a.notes, d.full_name AS dentist_name
            FROM appointments a
            LEFT JOIN users d ON d.user_id = a.dentist_id
            WHERE a.patient_id = ? AND ($where)
            ORDER BY $order
        ");
        $stmt->execute([$patientId]);
        return array_map([self::class, 'formatAppointment'], $stmt->fetchAll());
    }
}
