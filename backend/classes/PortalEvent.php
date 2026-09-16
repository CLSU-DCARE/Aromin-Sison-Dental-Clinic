<?php
namespace ASDC;

/** Write inside the caller's transaction so inbox events follow committed changes. */
class PortalEvent
{
    public static function patient(int $patientId, string $title, string $message, string $type = 'info'): void
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE is_active=1 AND (
            role='receptionist' OR user_id IN (SELECT user_id FROM patients WHERE patient_id=?)
            OR (role='dentist' AND (user_id IN (SELECT dentist_id FROM appointments WHERE patient_id=?)
            OR user_id IN (SELECT dentist_id FROM braces_contracts WHERE patient_id=?))))");
        $stmt->execute([$patientId, $patientId, $patientId]);
        foreach ($stmt->fetchAll(\PDO::FETCH_COLUMN) as $userId) {
            if ((int) $userId !== (int) ($_SESSION['user_id'] ?? 0)) {
                UserNotificationService::create((int) $userId, $title, $message, $type, $patientId);
            }
        }
    }

    public static function appointment(int $id, string $action): void
    {
        $stmt = Database::pdo()->prepare('SELECT patient_id, service_type, scheduled_date, scheduled_time FROM appointments WHERE appointment_id=?');
        $stmt->execute([$id]);
        if ($row = $stmt->fetch()) self::patient((int) $row['patient_id'], 'Appointment ' . $action,
            $row['service_type'] . ' · ' . $row['scheduled_date'] . ' ' . substr($row['scheduled_time'], 0, 5), 'appt');
    }
}
