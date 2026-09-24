<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

$method = \ASDC\ApiResponse::method('GET', 'POST');

if ($method === 'GET') {
    require_role('receptionist', 'dentist');
} else {
    require_role('receptionist');
}

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
if (!$patientId || !in_array($action, ['restore', 'purge'], true)) {
    \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose an archived patient action.');
}

if ($action === 'restore') {
    \ASDC\ApiResponse::ok(\ASDC\PatientService::restore($patientId), 'Patient restored.');
}

\ASDC\ApiResponse::ok(\ASDC\PatientService::purgeArchived($patientId), 'Archived patient permanently deleted.');
