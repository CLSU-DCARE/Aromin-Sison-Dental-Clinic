<?php
/**
 * POST /backend/api/notifications/send.php
 * Body (JSON):
 *   {
 *     "patient_id": 1,                              // required
 *     "template_key": "appointment_reminder",        // optional — uses a stored template
 *     "channel": "email",                            // required if no template: "email" | "sms" | "both"
 *     "subject": "Custom Subject",                   // optional — overrides template subject
 *     "body": "Custom message body...",              // required if no template
 *     "replacements": {                              // optional — {placeholders} to fill
 *       "patient_name": "Juan",
 *       "date": "2026-09-01",
 *       "time": "10:00 AM",
 *       "service": "Cleaning",
 *       "dentist": "Dr. Aromin"
 *     }
 *   }
 *
 * Sends an email and/or SMS to the specified patient, logs the result in
 * notification_logs, and returns the log entry.
 *
 * Protected: requires receptionist or dentist role.
 */

require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/mail.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_role('receptionist', 'dentist');

$input = json_decode(file_get_contents('php://input'), true);

$patientId    = intval($input['patient_id'] ?? 0);
$templateKey  = trim($input['template_key'] ?? '');
$channel      = strtolower(trim($input['channel'] ?? ''));
$subject      = trim($input['subject'] ?? '');
$body         = trim($input['body'] ?? '');
$replacements = $input['replacements'] ?? [];

if (!$patientId) {
    http_response_code(400);
    echo json_encode(['error' => 'patient_id is required.']);
    exit;
}

// ── Look up the patient ──
$stmt = $pdo->prepare('SELECT patient_id, first_name, last_name, contact_number, email FROM patients WHERE patient_id = ?');
$stmt->execute([$patientId]);
$patient = $stmt->fetch();

if (!$patient) {
    http_response_code(404);
    echo json_encode(['error' => 'Patient not found.']);
    exit;
}

// ── Load template if template_key is provided ──
$templateId = null;
if ($templateKey) {
    $stmt = $pdo->prepare('SELECT template_id, channel, subject, body FROM notification_templates WHERE template_key = ? AND is_active = 1');
    $stmt->execute([$templateKey]);
    $template = $stmt->fetch();

    if (!$template) {
        http_response_code(404);
        echo json_encode(['error' => "Template '$templateKey' not found or inactive."]);
        exit;
    }

    $templateId = $template['template_id'];
    if (!$channel) $channel = $template['channel'];
    if (!$subject) $subject = $template['subject'];
    if (!$body)    $body    = $template['body'];
}

// ── Validate ──
if (!$channel || !in_array($channel, ['email', 'sms', 'both'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'channel must be "email", "sms", or "both".']);
    exit;
}
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'body is required (or provide template_key).']);
    exit;
}

// ── Default replacements from patient record ──
$defaults = [
    'patient_name' => $patient['first_name'] . ' ' . $patient['last_name'],
];
$replacements = array_merge($defaults, $replacements);

// ── Render the body ──
$renderedBody = render_template($body, $replacements);
$renderedSubject = $subject ? render_template($subject, $replacements) : null;

// ── Determine channels to send ──
$channelsToSend = ($channel === 'both') ? ['email', 'sms'] : [$channel];
$results = [];

foreach ($channelsToSend as $ch) {
    $recipient = ($ch === 'email') ? $patient['email'] : $patient['contact_number'];
    $status    = 'pending';
    $error     = null;

    if (!$recipient) {
        $status = 'failed';
        $error  = 'Patient has no ' . ($ch === 'email' ? 'email address' : 'contact number') . ' on file.';
    } else {
        if ($ch === 'email') {
            $r = send_email($recipient, $renderedSubject ?: 'Notification — Aromin-Sison Dental Clinic', $renderedBody);
        } else {
            $r = send_sms($recipient, $renderedBody);
        }
        $status = $r['ok'] ? 'sent' : 'failed';
        $error  = $r['error'] ?? null;
    }

    // ── Log to notification_logs ──
    $logStmt = $pdo->prepare('
        INSERT INTO notification_logs (patient_id, template_id, channel, recipient, subject, body, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $logStmt->execute([
        $patientId,
        $templateId,
        $ch,
        $recipient ?? '',
        $ch === 'email' ? $renderedSubject : null,
        $renderedBody,
        $status,
        $error,
    ]);

    $logId = $pdo->lastInsertId();

    $results[] = [
        'channel'   => $ch,
        'recipient' => $recipient ?? null,
        'status'    => $status,
        'error'     => $error,
        'log_id'    => intval($logId),
    ];
}

echo json_encode([
    'success'   => true,
    'patient_id' => $patientId,
    'results'   => $results,
]);
