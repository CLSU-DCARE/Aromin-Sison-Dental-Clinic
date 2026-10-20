<?php
require_once __DIR__ . '/../../autoload.php';

$caseId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$kind = $_GET['image'] ?? '';
if (!$caseId || !in_array($kind, ['case','before','after'], true)) { http_response_code(404); exit; }

$problem = \ASDC\AuthMiddleware::inspectSession(false);
$isStaff = $problem === null && in_array($_SESSION['role'] ?? '', ['receptionist','dentist'], true);
$sql = 'SELECT collage_image_path,before_image_path,after_image_path,status,is_featured,consent_confirmed,created_by FROM promotional_cases WHERE case_id=?';
$stmt = \ASDC\Database::pdo()->prepare($sql);
$stmt->execute([$caseId]);
$case = $stmt->fetch();
if (!$case) { http_response_code(404); exit; }

$public = $case['status'] === 'published' && (int) $case['is_featured'] === 1 && (int) $case['consent_confirmed'] === 1;
$allowedStaff = $isStaff;
if (!$public && !$allowedStaff) { http_response_code(404); exit; }

$filename = $kind === 'case' ? $case['collage_image_path'] : $case[$kind . '_image_path'];
if (!$filename || !preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/', $filename)) { http_response_code(404); exit; }
$path = dirname(__DIR__, 2) . '/storage/promotional-cases/' . $filename;
if (!is_file($path)) { http_response_code(404); exit; }
$mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
if (!in_array($mime, ['image/jpeg','image/png','image/webp'], true)) { http_response_code(404); exit; }

header_remove('Content-Type');
header('Content-Type: ' . $mime);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store, max-age=0');
header('Content-Length: ' . filesize($path));
header('Content-Disposition: inline; filename="case-' . $caseId . '-' . $kind . '.' . pathinfo($filename, PATHINFO_EXTENSION) . '"');
readfile($path);
