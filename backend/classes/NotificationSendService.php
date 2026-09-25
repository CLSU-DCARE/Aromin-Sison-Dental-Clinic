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
     * @param array{template_key?: string, channel?: string, subject?: string, body?: string, replacements?: array, appointment_id?: int} $data
     * @return array{success: true, patient_id: int, results: array}|array{success: false, error: string, code: int}
     */
    public static function send(int $patientId, array $data): array
    {
        if (!$patientId) {
            return ['success' => false, 'error' => 'patient_id is required.', 'code' => 400];
        }

        NotificationSchema::ensureLogAppointmentColumn();

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
        $appointmentId = $data['appointment_id'] ?? null;

        // Load template if provided
        $templateId = null;
        if ($templateKey) {
            if (!self::isPatientEmailTemplate($templateKey)) {
                return ['success' => false, 'error' => 'This template is not available for patient email notifications.', 'code' => 400];
            }
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

        // Default replacements for manual sends. Specific workflow sends can override these.
        $defaults = self::defaultReplacements($pdo, $patient);
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
                    $r = Mailer::sendEmail($recipient, $renderedSubject ?: 'Notification - Aromin-Sison Dental Clinic', $renderedBody);
                } else {
                    $r = ['ok' => false, 'error' => 'Unsupported notification channel.'];
                }
                $status = $r['ok'] ? 'sent' : 'failed';
                $error  = $r['error'] ?? null;
            }

            // Log
            $logStmt = $pdo->prepare('INSERT INTO notification_logs (patient_id, template_id, appointment_id, channel, recipient, subject, body, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $logStmt->execute([
                $patientId,
                $templateId,
                $appointmentId,
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

    private static function isPatientEmailTemplate(string $templateKey): bool
    {
        $key = strtolower(trim($templateKey));
        if (preg_match('/(?:admin|receptionist|staff)/', $key)) return false;
        return str_ends_with($key, '_patient') || in_array($key, ['payment_rejected', 'braces_progress_updated'], true);
    }

    private static function defaultReplacements(PDO $pdo, array $patient): array
    {
        $patientName = trim(($patient['first_name'] ?? '') . ' ' . ($patient['last_name'] ?? ''));
        $defaults = [
            'patient_id' => '#P-' . ($patient['patient_id'] ?? ''),
            'patient_name' => $patientName,
            'contact_number' => $patient['contact_number'] ?: 'Not provided',
            'email' => $patient['email'] ?: 'Not provided',
            'appointment_id' => 'Not selected',
            'service' => 'Not selected',
            'appointment_date' => 'Not selected',
            'appointment_time' => 'Not selected',
            'requested_date' => 'Not selected',
            'requested_time' => 'Not selected',
            'previous_date' => 'Not selected',
            'previous_time' => 'Not selected',
            'new_date' => 'Not selected',
            'new_time' => 'Not selected',
            'dentist_name' => 'To be assigned',
            'reason' => 'Not provided',
            'service_treatment' => 'Not selected',
            'payment_amount' => 'PHP 0.00',
            'total_amount' => 'PHP 0.00',
            'amount_paid' => 'PHP 0.00',
            'remaining_balance' => 'PHP 0.00',
            'amount' => 'PHP 0.00',
            'balance' => 'PHP 0.00',
            'dentist' => 'To be assigned',
            'date' => 'Not selected',
            'time' => 'Not selected',
        ];

        $stmt = $pdo->prepare(
            "SELECT a.appointment_id, a.service_type, a.scheduled_date, a.scheduled_time,
                    u.full_name AS dentist_name
             FROM appointments a
             LEFT JOIN dentists u ON u.dentist_id = a.dentist_id
             WHERE a.patient_id = ?
             ORDER BY a.scheduled_date DESC, a.scheduled_time DESC, a.appointment_id DESC
             LIMIT 1"
        );
        $stmt->execute([(int) $patient['patient_id']]);
        $appointment = $stmt->fetch();
        if ($appointment) {
            $dentist = trim((string) ($appointment['dentist_name'] ?? '')) ?: 'To be assigned';
            $defaults['appointment_id'] = '#A-' . $appointment['appointment_id'];
            $defaults['service'] = $appointment['service_type'] ?: 'Not selected';
            $defaults['appointment_date'] = $appointment['scheduled_date'] ?: 'Not selected';
            $defaults['appointment_time'] = $appointment['scheduled_time'] ?: 'Not selected';
            $defaults['requested_date'] = $defaults['appointment_date'];
            $defaults['requested_time'] = $defaults['appointment_time'];
            $defaults['new_date'] = $defaults['appointment_date'];
            $defaults['new_time'] = $defaults['appointment_time'];
            $defaults['dentist_name'] = $dentist;
            $defaults['dentist'] = $dentist;
            $defaults['date'] = $defaults['appointment_date'];
            $defaults['time'] = $defaults['appointment_time'];
        }

        if (!$appointment) {
            $stmt = $pdo->prepare(
                "SELECT r.request_id, r.service_type, r.requested_date, r.requested_time,
                        u.full_name AS dentist_name
                 FROM appointment_requests r
                 LEFT JOIN dentists u ON u.dentist_id = r.preferred_dentist_id
                 WHERE (r.email = ? AND r.email <> '')
                    OR (r.contact_number = ? AND r.contact_number <> '')
                 ORDER BY r.requested_date DESC, r.requested_time DESC, r.request_id DESC
                 LIMIT 1"
            );
            $stmt->execute([(string) ($patient['email'] ?? ''), (string) ($patient['contact_number'] ?? '')]);
            $request = $stmt->fetch();
            if ($request) {
                $dentist = trim((string) ($request['dentist_name'] ?? '')) ?: 'To be assigned';
                $defaults['appointment_id'] = '#R-' . $request['request_id'];
                $defaults['service'] = $request['service_type'] ?: 'Not selected';
                $defaults['appointment_date'] = $request['requested_date'] ?: 'Not selected';
                $defaults['appointment_time'] = $request['requested_time'] ?: 'Not selected';
                $defaults['requested_date'] = $defaults['appointment_date'];
                $defaults['requested_time'] = $defaults['appointment_time'];
                $defaults['new_date'] = $defaults['appointment_date'];
                $defaults['new_time'] = $defaults['appointment_time'];
                $defaults['dentist_name'] = $dentist;
                $defaults['dentist'] = $dentist;
                $defaults['date'] = $defaults['appointment_date'];
                $defaults['time'] = $defaults['appointment_time'];
            }
        }

        $stmt = $pdo->prepare(
            "SELECT total_amount, balance_amount, current_stage
             FROM braces_contracts
             WHERE patient_id = ?
             ORDER BY contract_id DESC
             LIMIT 1"
        );
        $stmt->execute([(int) $patient['patient_id']]);
        $contract = $stmt->fetch();
        if ($contract) {
            $total = (float) ($contract['total_amount'] ?? 0);
            $balance = max(0, (float) ($contract['balance_amount'] ?? 0));
            $paid = max(0, $total - $balance);
            $defaults['service_treatment'] = 'Braces Treatment Plan';
            $defaults['total_amount'] = 'PHP ' . number_format($total, 2);
            $defaults['amount_paid'] = 'PHP ' . number_format($paid, 2);
            $defaults['remaining_balance'] = 'PHP ' . number_format($balance, 2);
            $defaults['balance'] = $defaults['remaining_balance'];
        }

        return $defaults;
    }
}
