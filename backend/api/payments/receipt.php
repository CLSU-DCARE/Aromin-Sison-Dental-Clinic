<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/auth.php';
require_role('receptionist', 'dentist', 'patient');
\ASDC\ApiResponse::method('GET');
$rawId = is_string($_GET['payment_id'] ?? null) ? trim($_GET['payment_id']) : ($_GET['payment_id'] ?? null);
$isTreatment = is_string($rawId) && preg_match('/^T-(\d+)$/i', $rawId, $match);
if ($isTreatment) {
    $id = (int) $match[1];
    [$where, $params] = \ASDC\DataScope::current()->patientFilter();
    $stmt = \ASDC\Database::pdo()->prepare(
        "SELECT tp.receipt_path
         FROM treatment_payments tp
         JOIN treatment_bills tb ON tb.bill_id = tp.bill_id
         JOIN patients p ON p.patient_id = tb.patient_id
         WHERE tp.payment_id = ? AND {$where}"
    );
    $stmt->execute(array_merge([$id], $params));
} else {
    if (is_string($rawId) && preg_match('/^C-(\d+)$/i', $rawId, $match)) {
        $id = (int) $match[1];
    } else {
        $id = \ASDC\InputValidator::positiveId($rawId);
    }
    [$where, $params] = \ASDC\DataScope::current()->contractFilter();
    $stmt = \ASDC\Database::pdo()->prepare("SELECT cp.receipt_path FROM contract_payments cp JOIN braces_contracts c ON c.contract_id=cp.contract_id WHERE cp.payment_id=? AND $where");
    $stmt->execute(array_merge([$id ?: 0], $params));
}
$relative = $stmt->fetchColumn();
$root = realpath(__DIR__ . '/../../uploads/receipts');
$path = $relative ? realpath(__DIR__ . '/../../' . $relative) : false;
if (!$root || !$path || !str_starts_with($path, $root . DIRECTORY_SEPARATOR) || !is_file($path)) \ASDC\ApiResponse::error(404, 'not_found', 'Receipt not found.');
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
if (!in_array($mime, ['image/png','image/jpeg','image/webp'], true)) \ASDC\ApiResponse::error(404, 'not_found', 'Receipt not found.');
header('Content-Type: ' . $mime);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
header('Content-Disposition: inline; filename="receipt.' . pathinfo($path, PATHINFO_EXTENSION) . '"');
session_write_close();
readfile($path);
