<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

require_role('receptionist', 'dentist');
$method = \ASDC\ApiResponse::method('GET', 'POST');
$pdo = \ASDC\Database::pdo();
$userId = (int) $_SESSION['user_id'];
$role = (string) $_SESSION['role'];

$select = "SELECT case_id AS id,title,treatment_category AS category,short_description AS description,
                  case_date,publication_date,status,is_featured,consent_confirmed,
                  collage_image_path IS NOT NULL AS has_case_image,
                  before_image_path IS NOT NULL AS has_before_image,
                  after_image_path IS NOT NULL AS has_after_image,
                  created_by,reviewed_at,created_at,updated_at
           FROM promotional_cases";
if ($method === 'GET') {
    $stmt = $pdo->query($select . ' ORDER BY updated_at DESC,case_id DESC');
    \ASDC\ApiResponse::ok(['cases' => $stmt->fetchAll()]);
}

\ASDC\CsrfToken::requireValid();
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$multipart = stripos($contentType, 'multipart/form-data') !== false;
$body = $multipart ? $_POST : \ASDC\ApiResponse::requireJson();
$action = trim((string) ($body['action'] ?? 'save'));

if ($action !== 'save') {
    $caseId = \ASDC\InputValidator::positiveId($body['case_id'] ?? null);
    if (!$caseId) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid case.');
    $stmt = $pdo->prepare('SELECT status,collage_image_path,before_image_path,after_image_path FROM promotional_cases WHERE case_id=?');
    $stmt->execute([$caseId]);
    $existing = $stmt->fetch();
    if (!$existing) \ASDC\ApiResponse::error(404, 'not_found', 'Promotional case not found.');

    if ($action === 'delete') {
        $pdo->prepare('DELETE FROM promotional_cases WHERE case_id=?')->execute([$caseId]);
        foreach (['collage_image_path','before_image_path','after_image_path'] as $imageColumn) {
            \ASDC\PromotionalCaseImageUploader::delete($existing[$imageColumn] ?? null);
        }
        \ASDC\ApiResponse::ok([], 'Case deleted.');
    }

    if ($action === 'publish') {
        if ((string) ($body['consent_confirmed'] ?? '') !== '1') {
            \ASDC\ApiResponse::error(422, 'consent_required', 'Confirm documented permission and the case-content review before publishing.');
        }
        $stmt = $pdo->prepare("UPDATE promotional_cases SET status='published',consent_confirmed=1,consent_verified_by=?,consent_verified_at=NOW(),reviewed_by=?,reviewed_at=NOW(),publication_date=COALESCE(publication_date,CURRENT_DATE()) WHERE case_id=? AND status<>'archived'");
        $stmt->execute([$userId, $userId, $caseId]);
        if (!$stmt->rowCount()) \ASDC\ApiResponse::error(409, 'invalid_transition', 'Archived cases cannot be published.');
        \ASDC\ApiResponse::ok([], 'Case approved and published.');
    }
    if ($action === 'unpublish') {
        $pdo->prepare("UPDATE promotional_cases SET status='unpublished',is_featured=0,reviewed_by=?,reviewed_at=NOW() WHERE case_id=? AND status<>'archived'")->execute([$userId, $caseId]);
        \ASDC\ApiResponse::ok([], 'Case unpublished.');
    }
    if ($action === 'archive') {
        $pdo->prepare("UPDATE promotional_cases SET status='archived',is_featured=0,reviewed_by=?,reviewed_at=NOW() WHERE case_id=?")->execute([$userId, $caseId]);
        \ASDC\ApiResponse::ok([], 'Case archived.');
    }
    if ($action === 'feature' || $action === 'unfeature') {
        $featured = $action === 'feature' ? 1 : 0;
        $stmt = $pdo->prepare("UPDATE promotional_cases SET is_featured=? WHERE case_id=? AND status='published' AND consent_confirmed=1");
        $stmt->execute([$featured, $caseId]);
        if (!$stmt->rowCount() && $featured) \ASDC\ApiResponse::error(409, 'invalid_transition', 'Only an approved published case can be featured.');
        \ASDC\ApiResponse::ok([], $featured ? 'Case added to the public section.' : 'Case removed from the public section.');
    }
    \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a supported case action.');
}

$caseId = \ASDC\InputValidator::positiveId($body['case_id'] ?? null);
$title = trim((string) ($body['title'] ?? ''));
$category = trim((string) ($body['category'] ?? ''));
$description = trim((string) ($body['description'] ?? ''));
$caseDate = trim((string) ($body['case_date'] ?? ''));
$categories = ['General Dentistry','Orthodontics','Cosmetic Dentistry','Restorative Dentistry','Oral Surgery','Other'];
$fields = [];
if ($title === '' || mb_strlen($title) > 150) $fields['title'] = 'Enter a case title up to 150 characters.';
if (!in_array($category, $categories, true)) $fields['category'] = 'Choose a treatment category.';
if ($description === '' || mb_strlen($description) > 1200) $fields['description'] = 'Enter a short description up to 1,200 characters.';
if ($caseDate !== '') {
    $parsed = date_parse_from_format('Y-m-d', $caseDate);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $caseDate) || !$parsed || $parsed['warning_count'] || $parsed['error_count'] || !checkdate((int) substr($caseDate, 5, 2), (int) substr($caseDate, 8, 2), (int) substr($caseDate, 0, 4))) {
        $fields['case_date'] = 'Choose a valid case date.';
    }
}
if ($fields) \ASDC\ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);

$existing = null;
if ($caseId) {
    $stmt = $pdo->prepare('SELECT * FROM promotional_cases WHERE case_id=?');
    $stmt->execute([$caseId]);
    $existing = $stmt->fetch();
    if (!$existing) \ASDC\ApiResponse::error(404, 'not_found', 'Promotional case not found.');
    if ($existing['status'] === 'archived') \ASDC\ApiResponse::error(409, 'invalid_transition', 'Archived cases are read-only.');
} elseif ($role !== 'dentist' && $role !== 'receptionist') {
    \ASDC\ApiResponse::error(403, 'FORBIDDEN', 'You cannot submit promotional cases.');
}

$collageUpload = \ASDC\PromotionalCaseImageUploader::store($multipart ? ($_FILES['case_image'] ?? null) : null);
$collagePath = $collageUpload ?: ($existing['collage_image_path'] ?? null);
$beforePath = $existing['before_image_path'] ?? null;
$afterPath = $existing['after_image_path'] ?? null;
$status = 'draft';

if ($existing) {
    $stmt = $pdo->prepare("UPDATE promotional_cases SET title=?,treatment_category=?,short_description=?,collage_image_path=?,before_image_path=?,after_image_path=?,case_date=?,status=?,is_featured=0,consent_confirmed=0,consent_verified_by=NULL,consent_verified_at=NULL,publication_date=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE case_id=?");
    $stmt->execute([$title,$category,$description,$collagePath,$beforePath,$afterPath,$caseDate !== '' ? $caseDate : null,$status,$caseId]);
    if ($collageUpload) \ASDC\PromotionalCaseImageUploader::delete($existing['collage_image_path']);
    \ASDC\ApiResponse::ok(['case_id' => $caseId, 'status' => $status], 'Case saved as a draft.');
}

$stmt = $pdo->prepare('INSERT INTO promotional_cases(title,treatment_category,short_description,collage_image_path,before_image_path,after_image_path,case_date,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)');
$stmt->execute([$title,$category,$description,$collagePath,$beforePath,$afterPath,$caseDate !== '' ? $caseDate : null,$status,$userId]);
$newId = (int) $pdo->lastInsertId();
\ASDC\ApiResponse::ok(['case_id' => $newId, 'status' => $status], 'Case saved as a draft.', 201);
