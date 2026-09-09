<?php
/**
 * Notification facade/orchestrator: Aromin-Sison Dental Clinic System.
 *
 * Ties together template lookup, rendering, sending, and logging.
 * Used by the notify_event() helper and other endpoints.
 *
 * Usage:
 *   $result = NotificationService::notifyEvent($pdo, 'appointment.booked', $patientId, $replacements);
 */

namespace ASDC;

use PDO;

class NotificationService
{
    private const EVENT_MAP = [
        'appointment.booked'    => 'appointment_confirmation',
        'appointment.cancelled' => 'appointment_cancellation',
        'payment.approved'      => 'payment_received',
        'payment.due'           => 'payment_due',
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

        $stmt = $pdo->prepare('SELECT patient_id, first_name, last_name, contact_number, email FROM patients WHERE patient_id = ?');
        $stmt->execute([$patientId]);
        $patient = $stmt->fetch();
        if (!$patient) {
            return ['ok' => false, 'error' => 'Patient not found.'];
        }

        $template = NotificationTemplateService::getByKey($templateKey);
        if (!$template) {
            return ['ok' => false, 'error' => "Template '$templateKey' not found or inactive."];
        }

        $defaults = ['patient_name' => $patient['first_name'] . ' ' . $patient['last_name']];
        $replacements = array_merge($defaults, $replacements);

        $renderedBody    = TemplateRenderer::render($template['body'], $replacements);
        $renderedSubject = $template['subject'] ? TemplateRenderer::render($template['subject'], $replacements) : null;

        $channels = ($template['channel'] === 'both') ? ['email', 'sms'] : [$template['channel']];
        $results  = [];

        foreach ($channels as $ch) {
            $recipient = ($ch === 'email') ? $patient['email'] : $patient['contact_number'];
            $status    = 'pending';
            $error     = null;

            if (!$recipient) {
                $status = 'failed';
                $error  = 'Patient has no ' . ($ch === 'email' ? 'email' : 'phone') . ' on file.';
            } else {
                if ($ch === 'email') {
                    $r = Mailer::sendEmail($recipient, $renderedSubject ?: 'Notification — Aromin-Sison Dental Clinic', $renderedBody);
                } else {
                    $r = SmsGateway::sendSms($recipient, $renderedBody);
                }
                $status = $r['ok'] ? 'sent' : 'failed';
                $error  = $r['error'] ?? null;
            }

            $logStmt = $pdo->prepare('INSERT INTO notification_logs (patient_id, template_id, channel, recipient, subject, body, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $logStmt->execute([
                $patientId,
                $template['template_id'],
                $ch,
                $recipient ?? '',
                $ch === 'email' ? $renderedSubject : null,
                $renderedBody,
                $status,
                $error,
            ]);

            $results[] = [
                'channel'   => $ch,
                'recipient' => $recipient ?? null,
                'status'    => $status,
                'error'     => $error,
            ];
        }

        return ['ok' => true, 'results' => $results];
    }
}
