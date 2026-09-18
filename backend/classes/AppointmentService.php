<?php
/**
 * Staff-facing appointment operations: Aromin-Sison Dental Clinic System.
 *
 * Week listing, approve/reschedule/cancel for both appointments and requests.
 *
 * Usage:
 *   $week = AppointmentService::getWeek($start);
 *   AppointmentService::cancel($type, $id);
 *   AppointmentService::reschedule($type, $id, $date, $time);
 *   AppointmentService::approve($type, $id);
 */

namespace ASDC;

use PDO;
use Throwable;

class AppointmentService
{
    /**
     * Fetch a full week of appointments and pending requests.
     *
     * @return array{week_start: string, week_end: string, appointments: array, requests: array}
     */
    public static function getWeek(string $start): array
    {
        $start = InputValidator::date($start);
        if (!$start) {
            ApiResponse::error(422, 'validation_failed', 'Start must use YYYY-MM-DD.', ['start' => 'Invalid date.']);
        }

        $end = date('Y-m-d', strtotime($start . ' +6 days'));
        $pdo  = Database::pdo();
        $scope = DataScope::current();

        [$apptWhere, $apptParams] = $scope->appointmentFilter();
        $apptStmt = $pdo->prepare(
            "SELECT a.appointment_id, a.patient_id,
                    CONCAT(p.first_name,' ',p.last_name) patient_name,
                    p.contact_number, p.email,
                    a.dentist_id, d.full_name dentist_name,
                    a.service_type, a.scheduled_date, a.scheduled_time,
                    a.status, a.notes
             FROM appointments a
             JOIN patients p ON p.patient_id=a.patient_id
             LEFT JOIN users d ON d.user_id=a.dentist_id
             WHERE a.scheduled_date BETWEEN ? AND ?
               AND {$apptWhere}
             ORDER BY a.scheduled_date, a.scheduled_time"
        );
        $apptStmt->execute(array_merge([$start, $end], $apptParams));

        [$reqWhere, $reqParams] = $scope->requestFilter();
        $reqStmt = $pdo->prepare(
            "SELECT r.request_id,
                    CONCAT(r.first_name,' ',r.last_name) patient_name,
                    r.contact_number, r.email,
                    r.preferred_dentist_id, d.full_name dentist_name,
                    r.service_type, r.requested_date scheduled_date,
                    r.requested_time scheduled_time, r.status, r.notes
             FROM appointment_requests r
             LEFT JOIN users d ON d.user_id=r.preferred_dentist_id
             WHERE r.requested_date BETWEEN ? AND ?
               AND r.status IN ('pending','rescheduled')
               AND {$reqWhere}
             ORDER BY r.requested_date, r.requested_time"
        );
        $reqStmt->execute(array_merge([$start, $end], $reqParams));

        return [
            'week_start'  => $start,
            'week_end'    => $end,
            'appointments' => $apptStmt->fetchAll(),
            'requests'     => $reqStmt->fetchAll(),
        ];
    }

    /**
     * Cancel an appointment or request by ID.
     */
    public static function cancel(string $type, int $id, string $status = 'cancelled'): void
    {
        $pdo = Database::pdo();
        $scope = DataScope::current();
        $table = $type === 'request' ? 'appointment_requests' : 'appointments';
        $key   = $type === 'request' ? 'request_id' : 'appointment_id';
        $ownerCol = $type === 'request' ? 'preferred_dentist_id' : 'dentist_id';

        // Ownership check for dentists
        if ($scope->isDentist()) {
            $check = $pdo->prepare("SELECT {$ownerCol} FROM {$table} WHERE {$key}=?");
            $check->execute([$id]);
            $row = $check->fetch();
            if (!$row || (int) $row[$ownerCol] !== $scope->getUserId()) {
                ApiResponse::error(403, 'forbidden', 'You do not have permission to cancel this appointment.');
            }
        }
        if ($type === 'appointment') {
            $check = $pdo->prepare(
                'SELECT 1 FROM appointments a
                  JOIN patients p ON p.patient_id=a.patient_id
                 WHERE a.appointment_id=? AND p.archived_at IS NULL'
            );
            $check->execute([$id]);
            if (!$check->fetchColumn()) ApiResponse::error(409, 'archived_patient', 'Archived patient appointments are retained for history only.');
        }

        if (!in_array($status, ['cancelled', 'rejected', 'completed', 'no_show'], true)
            || ($type === 'request' && !in_array($status, ['cancelled', 'rejected'], true))) ApiResponse::error(422, 'validation_failed', 'Invalid status.');
        $extra = $type === 'request' ? ', reviewed_by=?, reviewed_at=NOW()' : '';
        $params = $type === 'request' ? [$status, (int) $_SESSION['user_id'], $id] : [$status, $id];
        $allowed = $type === 'request' ? "('pending','rescheduled')" : ($status === 'rejected' ? "('pending')" : (in_array($status, ['completed','no_show'], true) ? "('confirmed')" : "('pending','confirmed')"));
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("UPDATE {$table} SET status=?{$extra} WHERE {$key}=? AND status IN $allowed");
            $stmt->execute($params);
            if (!$stmt->rowCount()) { $pdo->rollBack(); ApiResponse::error(409, 'state_changed', 'This appointment no longer permits that action.'); }
            if ($type === 'appointment') {
                if ($status === 'completed') ClinicalRecordService::recordCompletedAppointment($pdo, $id);
                PortalEvent::appointment($id, $status);
            } else {
                PortalEvent::appointmentRequest($id, $status);
            }
            $pdo->commit();
        } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        ApiResponse::ok([$key => $id, 'status' => $status], 'Appointment updated.');
    }

    /**
     * Reschedule an appointment or request to a new date/time.
     */
    public static function reschedule(string $type, int $id, string $date, string $time): void
    {
        [$date, $time] = InputValidator::slot(['scheduled_date' => $date, 'scheduled_time' => $time], 'scheduled_date', 'scheduled_time');
        $pdo  = Database::pdo();
        $scope = DataScope::current();
        $lock = AppointmentSlotManager::lock($pdo, $date, $time);

        try {
            $pdo->beginTransaction();

            if ($type === 'request') {
                $stmt = $pdo->prepare(
                    "SELECT request_id, preferred_dentist_id FROM appointment_requests
                     WHERE request_id=? AND status IN ('pending','rescheduled') FOR UPDATE"
                );
                $stmt->execute([$id]);
                $reqRow = $stmt->fetch();
                if (!$reqRow) {
                    $pdo->rollBack();
                    ApiResponse::error(404, 'not_found', 'Active appointment request not found.');
                }
                if ($scope->isDentist() && (int) $reqRow['preferred_dentist_id'] !== $scope->getUserId()) {
                    $pdo->rollBack();
                    ApiResponse::error(403, 'forbidden', 'You do not have permission to reschedule this request.');
                }
                if (AppointmentSlotManager::isTaken($pdo, $date, $time, null, $id)) {
                    $pdo->rollBack();
                    ApiResponse::error(409, 'slot_unavailable', 'That appointment slot is no longer available.');
                }
                $stmt = $pdo->prepare(
                    "UPDATE appointment_requests
                     SET requested_date=?, requested_time=?, status='rescheduled',
                         reviewed_by=?, reviewed_at=NOW()
                     WHERE request_id=?"
                );
                $stmt->execute([$date, $time, (int) $_SESSION['user_id'], $id]);
            } else {
                $stmt = $pdo->prepare(
                    "SELECT a.appointment_id, a.dentist_id, a.scheduled_date, a.scheduled_time FROM appointments a
                     JOIN patients p ON p.patient_id=a.patient_id
                     WHERE a.appointment_id=? AND a.status IN ('pending','confirmed') AND p.archived_at IS NULL FOR UPDATE"
                );
                $stmt->execute([$id]);
                $apptRow = $stmt->fetch();
                if (!$apptRow) {
                    $pdo->rollBack();
                    ApiResponse::error(404, 'not_found', 'Active appointment not found.');
                }
                if ($scope->isDentist() && (int) $apptRow['dentist_id'] !== $scope->getUserId()) {
                    $pdo->rollBack();
                    ApiResponse::error(403, 'forbidden', 'You do not have permission to reschedule this appointment.');
                }
                if (AppointmentSlotManager::isTaken($pdo, $date, $time, $id, null)) {
                    $pdo->rollBack();
                    ApiResponse::error(409, 'slot_unavailable', 'That appointment slot is no longer available.');
                }
                $stmt = $pdo->prepare(
                    "UPDATE appointments SET scheduled_date=?, scheduled_time=? WHERE appointment_id=?"
                );
                $stmt->execute([$date, $time, $id]);
            }

            if ($type === 'appointment') PortalEvent::appointment($id, 'rescheduled', [
                'previous_date' => $apptRow['scheduled_date'] ?? null,
                'previous_time' => $apptRow['scheduled_time'] ?? null,
            ]);
            else PortalEvent::appointmentRequest($id, 'rescheduled');
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log($e->getMessage());
            ApiResponse::error(500, 'reschedule_failed', 'Unable to reschedule the appointment.');
        } finally {
            AppointmentSlotManager::unlock($pdo, $lock);
        }

        ApiResponse::ok(['id' => $id, 'scheduled_date' => $date, 'scheduled_time' => $time], 'Appointment rescheduled.');
    }

    /**
     * Approve an appointment or appointment request.
     *
     * - For appointment: confirm a pending appointment.
     * - For request: find-or-create patient, insert confirmed appointment, mark request approved.
     */
    public static function approve(string $type, int $id, ?int $dentistId = null): void
    {
        if ($type === 'appointment') {
            self::approveAppointment($id, $dentistId);
        } else {
            self::approveRequest($id, $dentistId);
        }
    }

    /* ------------------------------------------------------------------
     *  Private helpers
     * ----------------------------------------------------------------*/

    private static function approveAppointment(int $id, ?int $dentistId): void
    {
        $pdo = Database::pdo();
        $scope = DataScope::current();

        if ($dentistId !== null) {
            if (!$scope->isReceptionist()) ApiResponse::error(403, 'forbidden', 'Only receptionists can assign dentists.');
            if (!self::isActiveDentist($pdo, $dentistId)) ApiResponse::error(422, 'validation_failed', 'Choose an active dentist.');
        }

        $stmt = $pdo->prepare(
            "SELECT a.scheduled_date, a.scheduled_time, a.dentist_id FROM appointments a
             JOIN patients p ON p.patient_id=a.patient_id
             WHERE a.appointment_id=? AND a.status='pending' AND p.archived_at IS NULL"
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            ApiResponse::error(404, 'not_found', 'Pending appointment not found.');
        }

        if ($scope->isDentist() && (int) $row['dentist_id'] !== $scope->getUserId()) {
            ApiResponse::error(403, 'forbidden', 'You do not have permission to approve this appointment.');
        }

        $lock = AppointmentSlotManager::lock($pdo, $row['scheduled_date'], $row['scheduled_time']);
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare(
                "SELECT a.appointment_id, a.scheduled_date, a.scheduled_time FROM appointments a
                 JOIN patients p ON p.patient_id=a.patient_id
                 WHERE a.appointment_id=? AND a.status='pending' AND p.archived_at IS NULL FOR UPDATE"
            );
            $stmt->execute([$id]);
            $locked = $stmt->fetch();

            if (!$locked
                || $locked['scheduled_date'] !== $row['scheduled_date']
                || $locked['scheduled_time'] !== $row['scheduled_time']
            ) {
                $pdo->rollBack();
                ApiResponse::error(409, 'state_changed', 'Appointment state changed; retry the action.');
            }

            $assignedDentistId = $dentistId ?: (int) ($locked['dentist_id'] ?? 0);
            if (!$assignedDentistId || !self::isActiveDentist($pdo, $assignedDentistId)) {
                $pdo->rollBack();
                ApiResponse::error(422, 'validation_failed', 'Choose an active dentist before confirming this appointment.');
            }

            if (AppointmentSlotManager::isTaken($pdo, $row['scheduled_date'], $row['scheduled_time'], $id, null)) {
                $pdo->rollBack();
                ApiResponse::error(409, 'slot_unavailable', 'That appointment slot is no longer available.');
            }

            $pdo->prepare("UPDATE appointments SET status='confirmed', dentist_id=? WHERE appointment_id=?")->execute([$assignedDentistId, $id]);
            PortalEvent::appointment($id, 'confirmed');
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            ApiResponse::error(500, 'approval_failed', 'Unable to approve the appointment.');
        } finally {
            AppointmentSlotManager::unlock($pdo, $lock);
        }

        ApiResponse::ok(['appointment_id' => $id, 'status' => 'confirmed'], 'Appointment approved.');
    }

    private static function approveRequest(int $id, ?int $dentistId = null): void
    {
        $pdo = Database::pdo();
        $scope = DataScope::current();

        if ($dentistId !== null) {
            if (!$scope->isReceptionist()) ApiResponse::error(403, 'forbidden', 'Only receptionists can assign dentists.');
            if (!self::isActiveDentist($pdo, $dentistId)) ApiResponse::error(422, 'validation_failed', 'Choose an active dentist.');
        }

        $stmt = $pdo->prepare(
            "SELECT * FROM appointment_requests WHERE request_id=? AND status IN ('pending','rescheduled')"
        );
        $stmt->execute([$id]);
        $request = $stmt->fetch();
        if (!$request) {
            ApiResponse::error(404, 'not_found', 'Pending appointment request not found.');
        }

        if ($scope->isDentist() && (int) $request['preferred_dentist_id'] !== $scope->getUserId()) {
            ApiResponse::error(403, 'forbidden', 'You do not have permission to approve this request.');
        }

        $initialRequest = $request;
        $lock = AppointmentSlotManager::lock($pdo, $request['requested_date'], $request['requested_time']);

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare(
                "SELECT * FROM appointment_requests
                 WHERE request_id=? AND status IN ('pending','rescheduled') FOR UPDATE"
            );
            $stmt->execute([$id]);
            $request = $stmt->fetch();

            if (!$request
                || $request['requested_date'] !== $initialRequest['requested_date']
                || $request['requested_time'] !== $initialRequest['requested_time']
            ) {
                $pdo->rollBack();
                ApiResponse::error(409, 'state_changed', 'Appointment request state changed; retry the action.');
            }

            if (AppointmentSlotManager::isTaken($pdo, $request['requested_date'], $request['requested_time'], null, $id)) {
                $pdo->rollBack();
                ApiResponse::error(409, 'slot_unavailable', 'That appointment slot is no longer available.');
            }

            $assignedDentistId = $dentistId ?: (int) ($request['preferred_dentist_id'] ?? 0);
            if (!$assignedDentistId || !self::isActiveDentist($pdo, $assignedDentistId)) {
                $pdo->rollBack();
                ApiResponse::error(422, 'validation_failed', 'Choose an active dentist before confirming this appointment request.');
            }

            $patient = self::findOrCreatePatient($pdo, $request);

            $insert = $pdo->prepare(
                "INSERT INTO appointments(patient_id, dentist_id, service_type, scheduled_date, scheduled_time, status, notes)
                 VALUES(?,?,?,?,?,'confirmed',?)"
            );
            $insert->execute([
                (int) $patient,
                $assignedDentistId,
                $request['service_type'],
                $request['requested_date'],
                $request['requested_time'],
                $request['notes'],
            ]);
            $appointmentId = (int) $pdo->lastInsertId();

            $pdo->prepare(
                "UPDATE appointment_requests SET status='approved', appointment_id=?, reviewed_by=?, reviewed_at=NOW() WHERE request_id=?"
            )->execute([$appointmentId, (int) $_SESSION['user_id'], $id]);

            PortalEvent::appointment($appointmentId, 'confirmed');
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log($e->getMessage());
            ApiResponse::error(500, 'approval_failed', 'Unable to approve the appointment request.');
        } finally {
            AppointmentSlotManager::unlock($pdo, $lock);
        }

        ApiResponse::ok(['request_id' => $id, 'appointment_id' => $appointmentId, 'status' => 'approved'], 'Appointment request approved.');
    }

    private static function isActiveDentist(PDO $pdo, int $dentistId): bool
    {
        $stmt = $pdo->prepare("SELECT 1 FROM users WHERE user_id=? AND role='dentist' AND is_active=1");
        $stmt->execute([$dentistId]);
        return (bool) $stmt->fetchColumn();
    }

    private static function findOrCreatePatient(PDO $pdo, array $request): int
    {
        if ($request['email']) {
            $stmt = $pdo->prepare('SELECT patient_id FROM patients WHERE email=? AND archived_at IS NULL ORDER BY user_id IS NOT NULL DESC LIMIT 1');
            $stmt->execute([$request['email']]);
            $patient = $stmt->fetchColumn();
            if ($patient) return (int) $patient;
        }

        if ($request['contact_number']) {
            $stmt = $pdo->prepare('SELECT patient_id FROM patients WHERE contact_number=? AND archived_at IS NULL ORDER BY user_id IS NOT NULL DESC LIMIT 1');
            $stmt->execute([$request['contact_number']]);
            $patient = $stmt->fetchColumn();
            if ($patient) return (int) $patient;
        }

        $stmt = $pdo->prepare('INSERT INTO patients(first_name,last_name,contact_number,email) VALUES(?,?,?,?)');
        $stmt->execute([$request['first_name'], $request['last_name'], $request['contact_number'], $request['email']]);
        return (int) $pdo->lastInsertId();
    }
}
