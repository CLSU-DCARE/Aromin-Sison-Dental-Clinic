<?php
namespace ASDC;

/** Write inside the caller's transaction so inbox events follow committed changes. */
class PortalEvent
{
    public static function patient(
        int $patientId,
        string $title,
        string $message,
        string $type = 'info',
        bool $includeActor = false
    ): void {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE is_active=1 AND (
            role='receptionist' OR user_id IN (SELECT user_id FROM patients WHERE patient_id=?)
            OR (role='dentist' AND (user_id IN (SELECT dentist_id FROM appointments WHERE patient_id=?)
            OR user_id IN (SELECT dentist_id FROM braces_contracts WHERE patient_id=?))))");
        $stmt->execute([$patientId, $patientId, $patientId]);
        foreach ($stmt->fetchAll(\PDO::FETCH_COLUMN) as $userId) {
            if ($includeActor || (int) $userId !== (int) ($_SESSION['user_id'] ?? 0)) {
                UserNotificationService::create((int) $userId, $title, $message, $type, $patientId);
            }
        }
    }

    public static function appointment(int $id, string $action): void
    {
        $stmt = Database::pdo()->prepare(
            "SELECT a.appointment_id, a.patient_id, a.service_type, a.scheduled_date,
                    a.scheduled_time, a.status, a.notes,
                    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                    p.email, p.contact_number,
                    d.full_name AS dentist_name
             FROM appointments a
             JOIN patients p ON p.patient_id = a.patient_id
             LEFT JOIN users d ON d.user_id = a.dentist_id
             WHERE a.appointment_id = ?"
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return;

        $title = match ($action) {
            'requested' => 'Appointment request received',
            'confirmed' => 'Appointment approved',
            'rescheduled' => 'Appointment rescheduled',
            'reschedule requested' => 'Appointment reschedule requested',
            'cancelled' => 'Appointment cancelled',
            'rejected' => 'Appointment rejected',
            'completed' => 'Appointment completed',
            'no_show' => 'Appointment marked as no-show',
            default => 'Appointment ' . self::label($action),
        };

        self::patient((int) $row['patient_id'], $title, self::appointmentMessage($row, $action), 'appt', true);
    }

    public static function appointmentRequest(int $id, string $action): void
    {
        $stmt = Database::pdo()->prepare(
            "SELECT r.request_id, r.first_name, r.last_name, r.email, r.contact_number,
                    r.service_type, r.requested_date, r.requested_time, r.status,
                    r.notes, d.full_name AS dentist_name
             FROM appointment_requests r
             LEFT JOIN users d ON d.user_id = r.preferred_dentist_id
             WHERE r.request_id = ?"
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return;

        $patientName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        $message = implode("\n", array_filter([
            'Patient: ' . ($patientName ?: 'Walk-in request'),
            'Service: ' . $row['service_type'],
            'Requested schedule: ' . self::fmtDate($row['requested_date']) . ' at ' . self::fmtTime($row['requested_time']),
            'Preferred dentist: ' . ($row['dentist_name'] ?: 'Clinic assignment'),
            'Status: ' . self::label($row['status']),
            $row['contact_number'] ? 'Contact number: ' . $row['contact_number'] : null,
            $row['email'] ? 'Email: ' . $row['email'] : null,
            $row['notes'] ? 'Message: ' . $row['notes'] : null,
        ]));

        self::staff('Appointment request ' . self::label($action), $message, 'appt');
    }

    private static function staff(string $title, string $message, string $type): void
    {
        $stmt = Database::pdo()->query("SELECT user_id FROM users WHERE is_active=1 AND role IN ('receptionist','dentist')");
        foreach ($stmt->fetchAll(\PDO::FETCH_COLUMN) as $userId) {
            if ((int) $userId !== (int) ($_SESSION['user_id'] ?? 0)) {
                UserNotificationService::create((int) $userId, $title, $message, $type);
            }
        }
    }

    private static function appointmentMessage(array $row, string $action): string
    {
        $lines = [];

        if ($action === 'requested') {
            $lines[] = 'Your appointment request was received by the clinic and is waiting for approval.';
        } elseif ($action === 'confirmed') {
            $lines[] = 'Your appointment has been approved. Please arrive on time or contact the clinic if you need changes.';
        } elseif (in_array($action, ['rescheduled', 'reschedule requested'], true)) {
            $lines[] = 'The appointment schedule was updated. Please review the new date and time.';
        } elseif ($action === 'cancelled') {
            $lines[] = 'This appointment has been cancelled.';
        } elseif ($action === 'completed') {
            $lines[] = 'This visit has been marked completed.';
        } elseif ($action === 'no_show') {
            $lines[] = 'This visit was marked as no-show.';
        } else {
            $lines[] = 'Please review the appointment details.';
        }

        $lines = array_merge($lines, [
            'Patient: ' . $row['patient_name'],
            'Service: ' . $row['service_type'],
            'Schedule: ' . self::fmtDate($row['scheduled_date']) . ' at ' . self::fmtTime($row['scheduled_time']),
            'Dentist: ' . ($row['dentist_name'] ?: 'Clinic assignment'),
            'Status: ' . self::label($row['status']),
            'Appointment ID: #' . $row['appointment_id'],
        ]);

        if ($row['contact_number']) $lines[] = 'Contact number: ' . $row['contact_number'];
        if ($row['email']) $lines[] = 'Email: ' . $row['email'];
        if ($row['notes']) $lines[] = 'Notes: ' . $row['notes'];

        return implode("\n", $lines);
    }

    private static function fmtDate(?string $value): string
    {
        if (!$value) return 'Not set';
        $date = \DateTime::createFromFormat('Y-m-d', $value);
        return $date ? $date->format('F j, Y') : $value;
    }

    private static function fmtTime(?string $value): string
    {
        if (!$value) return 'Not set';
        $time = \DateTime::createFromFormat('H:i:s', $value);
        if (!$time) $time = \DateTime::createFromFormat('H:i', $value);
        return $time ? $time->format('g:i A') : $value;
    }

    private static function label(?string $value): string
    {
        return ucwords(str_replace('_', ' ', (string) $value));
    }
}
