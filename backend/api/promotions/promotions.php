<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

require_role('receptionist');

$method = \ASDC\ApiResponse::method('GET', 'POST', 'DELETE');
$pdo = \ASDC\Database::pdo();

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT promo_id AS id,title,description AS `desc`,image_path,status,start_date,end_date FROM promotions ORDER BY promo_id DESC");
    \ASDC\ApiResponse::ok(['promotions' => $stmt->fetchAll()]);
}

if ($method === 'DELETE') {
    \ASDC\CsrfToken::requireValid();
    $body = \ASDC\ApiResponse::requireJson();
    $promoId = \ASDC\InputValidator::positiveId($body['promo_id'] ?? $body['id'] ?? null);
    if (!$promoId) {
        \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid promotion to delete.');
    }

    $stmt = $pdo->prepare('SELECT image_path FROM promotions WHERE promo_id = ?');
    $stmt->execute([$promoId]);
    $promotion = $stmt->fetch();
    if (!$promotion) {
        \ASDC\ApiResponse::error(404, 'not_found', 'Promotion not found.');
    }

    $stmt = $pdo->prepare('DELETE FROM promotions WHERE promo_id = ?');
    $stmt->execute([$promoId]);

    if (!empty($promotion['image_path'])) {
        $path = realpath(dirname(__DIR__, 2) . '/' . $promotion['image_path']);
        $uploadRoot = realpath(dirname(__DIR__, 2) . '/uploads/promotions');
        if ($path && $uploadRoot && strpos($path, $uploadRoot) === 0 && is_file($path)) {
            @unlink($path);
        }
    }

    \ASDC\ApiResponse::ok([], 'Promotion deleted.');
}

\ASDC\CsrfToken::requireValid();

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isMultipart = stripos($contentType, 'multipart/form-data') !== false;
$body = $isMultipart ? $_POST : \ASDC\ApiResponse::requireJson();
$title = trim((string) ($body['title'] ?? ''));
$description = trim((string) ($body['description'] ?? ''));
$statusInput = strtolower(trim((string) ($body['status'] ?? 'live')));
$statusMap = ['live' => 'live', 'scheduled' => 'scheduled', 'ended' => 'expired', 'expired' => 'expired'];
$status = $statusMap[$statusInput] ?? null;
$startDate = trim((string) ($body['start_date'] ?? ''));
$endDate = trim((string) ($body['end_date'] ?? ''));

$fields = [];
if ($title === '' || mb_strlen($title) > 150) $fields['title'] = 'Enter a title up to 150 characters.';
if ($description === '' || mb_strlen($description) > 10000) $fields['description'] = 'Enter a description up to 10,000 characters.';
if (!$status) $fields['status'] = 'Choose Live, Scheduled, or Ended.';
if ($startDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) $fields['start_date'] = 'Choose a valid start date.';
if ($endDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) $fields['end_date'] = 'Choose a valid end date.';
if ($startDate !== '' && $endDate !== '' && $endDate < $startDate) $fields['end_date'] = 'End date must be after the start date.';
if ($fields) \ASDC\ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);

$imagePath = \ASDC\PromotionImageUploader::store($_FILES['image'] ?? null);
$startDate = $startDate !== '' ? $startDate : ($status === 'live' ? date('Y-m-d') : null);
$endDate = $endDate !== '' ? $endDate : ($status === 'expired' ? date('Y-m-d') : null);

$stmt = $pdo->prepare(
    'INSERT INTO promotions(title,description,image_path,status,start_date,end_date) VALUES(?,?,?,?,?,?)'
);
$stmt->execute([$title, $description, $imagePath, $status, $startDate, $endDate]);
$promoId = (int) $pdo->lastInsertId();

\ASDC\ApiResponse::ok([
    'promotion' => [
        'id' => $promoId,
        'title' => $title,
        'desc' => $description,
        'image_path' => $imagePath,
        'status' => $status,
        'start_date' => $startDate,
        'end_date' => $endDate,
    ],
], 'Promotion saved.', 201);
