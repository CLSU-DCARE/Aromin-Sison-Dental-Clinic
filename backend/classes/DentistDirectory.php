<?php

namespace ASDC;

class DentistDirectory
{
    private const ALLOWED_NAMES = [
        'Dr. Arsenia Aromin',
        'Dr. Kathrine Sison',
    ];

    public static function allowedNames(): array
    {
        return self::ALLOWED_NAMES;
    }

    public static function listActive(): array
    {
        $placeholders = implode(',', array_fill(0, count(self::ALLOWED_NAMES), '?'));
        $stmt = Database::pdo()->prepare(
            "SELECT dentist_id, full_name
             FROM dentists
             WHERE is_active = 1
               AND full_name IN ($placeholders)
             ORDER BY FIELD(full_name, $placeholders)"
        );
        $stmt->execute(array_merge(self::ALLOWED_NAMES, self::ALLOWED_NAMES));
        return $stmt->fetchAll();
    }

    public static function isAllowed(int $dentistId): bool
    {
        $placeholders = implode(',', array_fill(0, count(self::ALLOWED_NAMES), '?'));
        $stmt = Database::pdo()->prepare(
            "SELECT 1
             FROM dentists
             WHERE dentist_id = ?
               AND is_active = 1
               AND full_name IN ($placeholders)"
        );
        $stmt->execute(array_merge([$dentistId], self::ALLOWED_NAMES));
        return (bool) $stmt->fetchColumn();
    }
}
