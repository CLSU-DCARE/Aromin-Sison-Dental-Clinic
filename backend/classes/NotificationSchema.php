<?php
namespace ASDC;

class NotificationSchema
{
    private static bool $checked = false;

    public static function ensureLogAppointmentColumn(): void
    {
        if (self::$checked) {
            return;
        }

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT COUNT(*)
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND COLUMN_NAME = ?'
        );
        $stmt->execute(['notification_logs', 'appointment_id']);

        if ((int) $stmt->fetchColumn() === 0) {
            $pdo->exec('ALTER TABLE notification_logs ADD COLUMN appointment_id INT NULL AFTER template_id');
        }

        self::$checked = true;
    }
}
