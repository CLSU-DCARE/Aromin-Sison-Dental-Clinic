<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

$method = \ASDC\ApiResponse::method('GET', 'POST');
require_role('receptionist');

if ($method === 'GET') {
    header('Cache-Control: no-store');
    $patientId = \ASDC\InputValidator::positiveId($_GET['patient_id'] ?? null);
    if ($patientId) {
        \ASDC\ApiResponse::ok(\ASDC\PatientService::archivedDetails($patientId));
    }
    \ASDC\ApiResponse::ok(['patients' => \ASDC\PatientService::listArchived()]);
}

\ASDC\CsrfToken::requireValid();
$body = \ASDC\ApiResponse::requireJson();
$patientId = \ASDC\InputValidator::positiveId($body['patient_id'] ?? null);
$action = is_string($body['action'] ?? null) ? strtolower(trim($body['action'])) : '';
if (!$patientId || $action !== 'restore') {
    \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose an archived patient to restore.');
}

\ASDC\ApiResponse::ok(\ASDC\PatientService::restore($patientId), 'Patient restored.');
