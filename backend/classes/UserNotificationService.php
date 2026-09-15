<?php

namespace ASDC;

class UserNotificationService
{
    public static function create($userId, $title, $message, $type='general')
    {
        $pdo = Database::pdo();

        $stmt = $pdo->prepare("
            INSERT INTO user_notifications
            (user_id,title,message,type)
            VALUES (?,?,?,?)
        ");

        return $stmt->execute([
            $userId,
            $title,
            $message,
            $type
        ]);
    }
}