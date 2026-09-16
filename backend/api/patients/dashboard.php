<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('GET');
\ASDC\AuthMiddleware::requireRole('patient');
$patientId = \ASDC\PatientService::resolvePatientId((int) $_SESSION['user_id']);
// Do not hold the PHP session lock while reading the dashboard.
session_write_close();
try {
    \ASDC\ApiResponse::ok(\ASDC\PatientDashboardService::snapshot($patientId));
} catch (\Throwable $error) {
    error_log('Patient dashboard refresh failed: ' . $error->getMessage());
    \ASDC\ApiResponse::error(500, 'server_error', 'Unable to refresh your dashboard. Retrying shortly.');
}
