<?php
/**
 * Auto-trigger notification helper: Aromin-Sison Dental Clinic System.
 *
 * Call this from any endpoint after a successful DB action to automatically
 * send the appropriate notification to the patient.
 *
 * Usage:
 *   require_once __DIR__ . '/../../config/notifications.php';
 *   notify_event($pdo, 'appointment.booked', $patientId, [
 *       'date'    => '2026-09-01',
 *       'time'    => '10:00 AM',
 *       'service' => 'Cleaning',
 *       'dentist' => 'Dr. Aromin',
 *   ]);
 *
 * Events:
 *   'appointment.booked'      → appointment_confirmation
 *   'appointment.cancelled'   → appointment_cancellation
 *   'payment.approved'        → payment_received
 *   'payment.due'             → payment_due
 */

require_once __DIR__ . '/mail.php';

if (!function_exists('notify_event')) {
    /**
     * Fire a notification for a given event.
     *
     * @param PDO    $pdo          Database connection
     * @param string $event        Event key (e.g. 'appointment.booked')
     * @param int    $patientId    Patient to notify
     * @param array  $replacements Placeholder values to fill in the template
     * @return array               ['ok' => true/false, 'results' => [...]]
     */
    function notify_event($pdo, $event, $patientId, array $replacements = []) {
        $eventMap = [
            'appointment.booked'    => 'appointment_confirmation',
            'appointment.cancelled' => 'appointment_cancellation',
            'payment.approved'      => 'payment_received',
            'payment.due'           => 'payment_due',
        ];

        $templateKey = $eventMap[$event] ?? null;
        if (!$templateKey) {
            return ['ok' => false, 'error' => "Unknown event: $event"];
        }

        // Look up the patient
        $stmt = $pdo->prepare('SELECT patient_id, first_name, last_name, contact_number, email FROM patients WHERE patient_id = ?');
        $stmt->execute([$patientId]);
        $patient = $stmt->fetch();
        if (!$patient) {
            return ['ok' => false, 'error' => 'Patient not found.'];
        }

        // Load the template
        $stmt = $pdo->prepare('SELECT template_id, channel, subject, body FROM notification_templates WHERE template_key = ? AND is_active = 1');
        $stmt->execute([$templateKey]);
        $template = $stmt->fetch();
        if (!$template) {
            return ['ok' => false, 'error' => "Template '$templateKey' not found or inactive."];
        }

        // Default replacements from patient record
        $defaults = [
            'patient_name' => $patient['first_name'] . ' ' . $patient['last_name'],
        ];
        $replacements = array_merge($defaults, $replacements);

        $renderedBody    = render_template($template['body'], $replacements);
        $renderedSubject = $template['subject'] ? render_template($template['subject'], $replacements) : null;

        // Determine channels
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
                    $r = send_email($recipient, $renderedSubject ?: 'Notification — Aromin-Sison Dental Clinic', $renderedBody);
                } else {
                    $r = send_sms($recipient, $renderedBody);
                }
                $status = $r['ok'] ? 'sent' : 'failed';
                $error  = $r['error'] ?? null;
            }

            // Log to notification_logs
            $logStmt = $pdo->prepare('
                INSERT INTO notification_logs (patient_id, template_id, channel, recipient, subject, body, status, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ');
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
