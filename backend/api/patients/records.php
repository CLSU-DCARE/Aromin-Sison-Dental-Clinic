<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';
$method = \ASDC\ApiResponse::method('GET', 'POST', 'PATCH');
require_role('receptionist', 'dentist', 'patient');
try {
    if ($method === 'GET') { header('Cache-Control: no-store'); \ASDC\ApiResponse::ok(['records' => \ASDC\ClinicalRecordService::listAll()]); }
    require_role('dentist');
    \ASDC\CsrfToken::requireValid();
    \ASDC\ApiResponse::ok(\ASDC\ClinicalRecordService::save(\ASDC\ApiResponse::requireJson(), $method === 'PATCH'), 'Treatment record saved.', $method === 'POST' ? 201 : 200);
} catch (\Throwable $e) { error_log($e->getMessage()); \ASDC\ApiResponse::error(500, 'record_failed', 'Unable to save or load treatment records.'); }
