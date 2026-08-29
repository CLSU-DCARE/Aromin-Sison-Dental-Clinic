<?php
/**
 * GET /backend/api/notifications/list.php
 * Query params:
 *   ?patient_id=1   — filter by patient (optional)
 *   ?channel=email  — filter by channel: email|sms (optional)
 *   ?status=sent    — filter by status: sent|failed|pending (optional)
 *   ?limit=50       — max rows returned (default 50, max 200)
 *   ?offset=0       — pagination offset (default 0)
 *
 * Returns notification log entries with patient + template info.
 * Protected: requires admin, staff, or dentist role.
 */

require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json');

require_role('admin', 'staff', 'dentist');

// ── Parse query params ──
$patientId = isset($_GET['patient_id']) ? intval($_GET['patient_id']) : null;
$channel   = isset($_GET['channel'])   ? strtolower(trim($_GET['channel'])) : null;
$status    = isset($_GET['status'])    ? strtolower(trim($_GET['status'])) : null;
$limit     = min(max(intval($_GET['limit'] ?? 50), 1), 200);
$offset    = max(intval($_GET['offset'] ?? 0), 0);

// ── Build query ──
$where  = [];
$params = [];

if ($patientId) {
    $where[]  = 'nl.patient_id = ?';
    $params[] = $patientId;
}
if ($channel && in_array($channel, ['email', 'sms'], true)) {
    $where[]  = 'nl.channel = ?';
    $params[] = $channel;
}
if ($status && in_array($status, ['sent', 'failed', 'pending'], true)) {
    $where[]  = 'nl.status = ?';
    $params[] = $status;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$sql = "
    SELECT
        nl.log_id,
        nl.patient_id,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        nl.channel,
        nl.recipient,
        nl.subject,
        nl.body,
        nl.status,
        nl.error_message,
        nl.sent_at,
        nt.template_key,
        nt.name AS template_name
    FROM notification_logs nl
    JOIN patients p ON p.patient_id = nl.patient_id
    LEFT JOIN notification_templates nt ON nt.template_id = nl.template_id
    $whereClause
    ORDER BY nl.sent_at DESC
    LIMIT $limit OFFSET $offset
";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$logs = $stmt->fetchAll();

// ── Total count for pagination ──
$countSql = "SELECT COUNT(*) FROM notification_logs nl $whereClause";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$total = intval($countStmt->fetchColumn());

echo json_encode([
    'success' => true,
    'total'   => $total,
    'limit'   => $limit,
    'offset'  => $offset,
    'logs'    => $logs,
]);
