<?php
/**
 * Notification facade/orchestrator: Aromin-Sison Dental Clinic System.
 *
 * Ties together template lookup, rendering, sending, and logging.
 * Usage:
 *   $result = NotificationService::notifyEvent($pdo, 'appointment.booked', $patientId, $replacements);
 */

namespace ASDC;

use PDO;

class NotificationService
{
    private const EVENT_MAP = [
        'appointment.booked'    => 'appointment_confirmed_patient',
        'appointment.cancelled' => 'appointment_cancelled_patient',
        'payment.approved'      => 'payment_recorded_patient',
        'payment.due'           => 'balance_due_reminder_patient',
    ];

    /**
     * Fire a notification for a given event.
     */
    public static function notifyEvent(PDO $pdo, string $event, int $patientId, array $replacements = []): array
    {
        $templateKey = self::EVENT_MAP[$event] ?? null;
        if (!$templateKey) {
            return ['ok' => false, 'error' => "Unknown event: $event"];
        }
        $result = NotificationSendService::send($patientId, [
            'template_key' => $templateKey,
            'replacements' => $replacements,
        ]);
        return $result['success']
            ? ['ok' => true, 'results' => $result['results']]
            : ['ok' => false, 'error' => $result['error'] ?? 'Notification failed.'];
    }
}
