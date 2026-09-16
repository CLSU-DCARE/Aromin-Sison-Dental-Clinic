<?php

namespace ASDC;

class UserNotificationService
{
    public static function listForUser(int $userId): array
    {
        $stmt = Database::pdo()->prepare('SELECT notification_id AS id, title, message AS `desc`, type AS kind, patient_id, created_at AS time, (read_at IS NULL) AS unread FROM user_notifications WHERE user_id=? ORDER BY notification_id DESC LIMIT 100');
        $stmt->execute([$userId]);
        return array_map(static function ($row) {
            $row['unread'] = (bool) $row['unread'];
            if (($row['kind'] ?? '') === 'appt' && !str_contains((string) $row['desc'], 'Patient:') && !empty($row['patient_id'])) {
                $row['desc'] = self::appointmentDetails((int) $row['patient_id'], (string) $row['title'], (string) $row['desc']);
            }
            return $row;
        }, $stmt->fetchAll());
    }
    public static function create($userId, $title, $message, $type='general', ?int $patientId = null)
    {
        $pdo = Database::pdo();

        $stmt = $pdo->prepare("
            INSERT INTO user_notifications
            (user_id,title,message,type,patient_id)
            VALUES (?,?,?,?,?)
        ");

        return $stmt->execute([
            $userId,
            $title,
            $message,
            $type,
            $patientId
        ]);
    }

    private static function appointmentDetails(int $patientId, string $title, string $fallback): string
    {
        $stmt = Database::pdo()->prepare(
            "SELECT a.appointment_id, a.service_type, a.scheduled_date,
                    a.scheduled_time, a.status, a.notes,
                    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                    p.email, p.contact_number,
                    d.full_name AS dentist_name
             FROM appointments a
             JOIN patients p ON p.patient_id = a.patient_id
             LEFT JOIN users d ON d.user_id = a.dentist_id
             WHERE a.patient_id = ?
             ORDER BY a.appointment_id DESC
             LIMIT 1"
        );
        $stmt->execute([$patientId]);
        $row = $stmt->fetch();
        if (!$row) return $fallback;

        $lines = [
            self::messageForTitle($title),
            'Patient: ' . $row['patient_name'],
            'Service: ' . $row['service_type'],
            'Schedule: ' . self::fmtDate($row['scheduled_date']) . ' at ' . self::fmtTime($row['scheduled_time']),
            'Dentist: ' . ($row['dentist_name'] ?: 'Clinic assignment'),
            'Status: ' . self::label($row['status']),
            'Appointment ID: #' . $row['appointment_id'],
        ];
        if ($row['contact_number']) $lines[] = 'Contact number: ' . $row['contact_number'];
        if ($row['email']) $lines[] = 'Email: ' . $row['email'];

        return implode("\n", $lines);
    }

    private static function messageForTitle(string $title): string
    {
        $normalized = strtolower($title);
        if (str_contains($normalized, 'approved') || str_contains($normalized, 'confirmed')) {
            return 'Your appointment has been approved. Please review the schedule and dentist assignment.';
        }
        if (str_contains($normalized, 'rescheduled')) {
            return 'The appointment schedule was updated. Please review the new date and time.';
        }
        if (str_contains($normalized, 'completed')) {
            return 'This visit has been marked completed.';
        }
        if (str_contains($normalized, 'cancelled')) {
            return 'This appointment has been cancelled.';
        }
        if (str_contains($normalized, 'request')) {
            return 'Your appointment request was received by the clinic and is waiting for approval.';
        }
        return 'Please review the appointment details.';
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
