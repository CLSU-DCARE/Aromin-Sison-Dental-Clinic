<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

require_role('receptionist');

$method = \ASDC\ApiResponse::method('GET', 'POST');
$pdo = \ASDC\Database::pdo();

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT promo_id AS id,title,description AS `desc`,status,start_date,end_date FROM promotions ORDER BY promo_id DESC");
    \ASDC\ApiResponse::ok(['promotions' => $stmt->fetchAll()]);
}

$body = \ASDC\ApiResponse::requireJson();
$title = trim((string) ($body['title'] ?? ''));
$description = trim((string) ($body['description'] ?? ''));
$statusInput = strtolower(trim((string) ($body['status'] ?? 'live')));
$statusMap = ['live' => 'live', 'scheduled' => 'scheduled', 'ended' => 'expired', 'expired' => 'expired'];
$status = $statusMap[$statusInput] ?? null;

$fields = [];
if ($title === '' || mb_strlen($title) > 150) $fields['title'] = 'Enter a title up to 150 characters.';
if ($description === '' || mb_strlen($description) > 10000) $fields['description'] = 'Enter a description up to 10,000 characters.';
if (!$status) $fields['status'] = 'Choose Live, Scheduled, or Ended.';
if ($fields) \ASDC\ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);

$startDate = $status === 'live' ? date('Y-m-d') : null;
$endDate = $status === 'expired' ? date('Y-m-d') : null;

$stmt = $pdo->prepare(
    'INSERT INTO promotions(title,description,status,start_date,end_date) VALUES(?,?,?,?,?)'
);
$stmt->execute([$title, $description, $status, $startDate, $endDate]);
$promoId = (int) $pdo->lastInsertId();

\ASDC\ApiResponse::ok([
    'promotion' => [
        'id' => $promoId,
        'title' => $title,
        'desc' => $description,
        'status' => $status,
        'start_date' => $startDate,
        'end_date' => $endDate,
    ],
], 'Promotion saved.', 201);
