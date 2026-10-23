<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

require_role('receptionist', 'dentist');
session_write_close();
\ASDC\ApiResponse::method('GET');
header('Cache-Control: no-store');

$patientId = \ASDC\InputValidator::positiveId($_GET['patient_id'] ?? null);
if (!$patientId) {
    \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid patient.');
}

\ASDC\ApiResponse::ok(\ASDC\PatientService::activeDetails($patientId));
