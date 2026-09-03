<?php
/**
 * GET  /backend/api/notifications/templates.php          — list all templates
 * POST /backend/api/notifications/templates.php          — create or update a template
 *
 * POST body (JSON):
 *   {
 *     "template_key": "appointment_reminder",   // required for update; omit to create new
 *     "name": "Appointment Reminder",           // required
 *     "channel": "both",                        // "email" | "sms" | "both"
 *     "subject": "Subject line...",             // optional (NULL for SMS-only)
 *     "body": "Message with {placeholders}...", // required
 *     "is_active": true                         // optional, default true
 *   }
 *
 * Placeholders: {patient_name}, {date}, {time}, {service}, {dentist}, {amount}, {balance}
 *
 * Protected: requires receptionist role.
 */

require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json');

require_role('receptionist');

// ── GET: list templates ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $activeOnly = isset($_GET['active_only']) && $_GET['active_only'] === '1';
    $where = $activeOnly ? 'WHERE is_active = 1' : '';

    $stmt = $pdo->query("
        SELECT template_id, template_key, name, channel, subject, body, is_active, created_at, updated_at
        FROM notification_templates
        $where
        ORDER BY name ASC
    ");
    $templates = $stmt->fetchAll();

    echo json_encode(['success' => true, 'templates' => $templates]);
    exit;
}

// ── POST: create or update ──
$input = json_decode(file_get_contents('php://input'), true);

$templateKey = trim($input['template_key'] ?? '');
$name        = trim($input['name'] ?? '');
$channel     = strtolower(trim($input['channel'] ?? 'both'));
$subject     = isset($input['subject']) ? trim($input['subject']) : null;
$body        = trim($input['body'] ?? '');
$isActive    = $input['is_active'] ?? true;

if (!$name) {
    http_response_code(400);
    echo json_encode(['error' => 'name is required.']);
    exit;
}
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'body is required.']);
    exit;
}
if (!in_array($channel, ['email', 'sms', 'both'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'channel must be "email", "sms", or "both".']);
    exit;
}

// Generate a slug-style key from the name if not provided
if (!$templateKey) {
    $templateKey = preg_replace('/[^a-z0-9]+/', '_', strtolower($name));
    $templateKey = trim($templateKey, '_');
}

// Check if template already exists
$stmt = $pdo->prepare('SELECT template_id FROM notification_templates WHERE template_key = ?');
$stmt->execute([$templateKey]);
$existing = $stmt->fetch();

if ($existing) {
    // Update
    $stmt = $pdo->prepare('
        UPDATE notification_templates
        SET name = ?, channel = ?, subject = ?, body = ?, is_active = ?
        WHERE template_key = ?
    ');
    $stmt->execute([$name, $channel, $subject, $body, $isActive ? 1 : 0, $templateKey]);
    $action = 'updated';
} else {
    // Insert
    $stmt = $pdo->prepare('
        INSERT INTO notification_templates (template_key, name, channel, subject, body, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$templateKey, $name, $channel, $subject, $body, $isActive ? 1 : 0]);
    $action = 'created';
}

echo json_encode([
    'success'      => true,
    'action'       => $action,
    'template_key' => $templateKey,
]);
