<?php
/**
 * Notification sending service: Aromin-Sison Dental Clinic System.
 *
 * Sends email notifications to patients, with template resolution
 * and result logging.
 *
 * Usage:
 *   $result = NotificationSendService::send($patientId, $data);
 */

namespace ASDC;

use PDO;

class NotificationSendService
{
    /**
     * Send a notification to a patient.
     *
     * @param int   $patientId
     * @param array{template_key?: string, channel?: string, subject?: string, body?: string, replacements?: array} $data
     * @return array{success: true, patient_id: int, results: array}|array{success: false, error: string, code: int}
     */
    public static function send(int $patientId, array $data): array
    {
        if (!$patientId) {
            return ['success' => false, 'error' => 'patient_id is required.', 'code' => 400];
        }

        $pdo = Database::pdo();

        // Look up patient
        $stmt = $pdo->prepare('SELECT patient_id, first_name, last_name, contact_number, email FROM patients WHERE patient_id = ?');
        $stmt->execute([$patientId]);
        $patient = $stmt->fetch();

        if (!$patient) {
            return ['success' => false, 'error' => 'Patient not found.', 'code' => 404];
        }

        $templateKey  = trim($data['template_key'] ?? '');
        $channel      = 'email';
        $subject      = trim($data['subject'] ?? '');
        $body         = trim($data['body'] ?? '');
        $replacements = $data['replacements'] ?? [];

        // Load template if provided
        $templateId = null;
        if ($templateKey) {
            $template = NotificationTemplateService::getByKey($templateKey);
            if (!$template) {
                return ['success' => false, 'error' => "Template '$templateKey' not found or inactive.", 'code' => 404];
            }
            $templateId = $template['template_id'];
            if (!$subject) $subject = $template['subject'];
            if (!$body)    $body    = $template['body'];
        }

        // Validate
        if (!$body) {
            return ['success' => false, 'error' => 'body is required (or provide template_key).', 'code' => 400];
        }

        // Default replacements
        $defaults = ['patient_name' => $patient['first_name'] . ' ' . $patient['last_name']];
        $replacements = array_merge($defaults, $replacements);

        $renderedBody    = TemplateRenderer::render($body, $replacements);
        $renderedSubject = $subject ? TemplateRenderer::render($subject, $replacements) : null;

        $channelsToSend = ['email'];
        $results = [];

        foreach ($channelsToSend as $ch) {
            $recipient = $patient['email'];
            $status    = 'pending';
            $error     = null;

            if (!$recipient) {
                $status = 'failed';
                $error  = 'Patient has no email address on file.';
            } else {
                if ($ch === 'email') {
                    $r = Mailer::sendEmail($recipient, $renderedSubject ?: 'Notification — Aromin-Sison Dental Clinic', $renderedBody);
                } else {
                    $r = ['ok' => false, 'error' => 'Unsupported notification channel.'];
                }
                $status = $r['ok'] ? 'sent' : 'failed';
                $error  = $r['error'] ?? null;
            }

            // Log
            $logStmt = $pdo->prepare('INSERT INTO notification_logs (patient_id, template_id, channel, recipient, subject, body, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $logStmt->execute([
                $patientId,
                $templateId,
                $ch,
                $recipient ?? '',
                $renderedSubject,
                $renderedBody,
                $status,
                $error,
            ]);

            $results[] = [
                'channel'   => $ch,
                'recipient' => $recipient ?? null,
                'status'    => $status,
                'error'     => $error,
                'log_id'    => (int) $pdo->lastInsertId(),
            ];
        }

        return ['success' => true, 'patient_id' => $patientId, 'results' => $results];
    }
}
