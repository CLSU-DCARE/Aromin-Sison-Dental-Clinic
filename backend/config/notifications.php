<?php
/**
 * Auto-trigger notification helper: Aromin-Sison Dental Clinic System.
 *
 * Backward-compatible wrapper around ASDC\NotificationService.
 * New code should use: \ASDC\NotificationService::notifyEvent($pdo, $event, $patientId, $replacements);
 * Classes are auto-loaded via backend/autoload.php.
 */

if (!function_exists('notify_event')) {
    function notify_event($pdo, $event, $patientId, array $replacements = []): array
    {
        return \ASDC\NotificationService::notifyEvent($pdo, $event, $patientId, $replacements);
    }
}
