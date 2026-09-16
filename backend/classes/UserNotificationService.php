<?php

namespace ASDC;

class UserNotificationService
{
    public static function listForUser(int $userId): array
    {
        $stmt = Database::pdo()->prepare('SELECT notification_id AS id, title, message AS `desc`, type AS kind, created_at AS time, (read_at IS NULL) AS unread FROM user_notifications WHERE user_id=? ORDER BY notification_id DESC LIMIT 100');
        $stmt->execute([$userId]);
        return array_map(static function ($row) { $row['unread'] = (bool) $row['unread']; return $row; }, $stmt->fetchAll());
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
}
