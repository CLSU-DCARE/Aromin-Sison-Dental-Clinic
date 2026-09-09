<?php
/**
 * Patient braces endpoint.
 * Delegates to ASDC\BracesService.
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/headers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

require_role('patient');

try {
    $patientId = \ASDC\PatientService::resolvePatientId((int) $_SESSION['user_id']);
    $data = \ASDC\BracesService::getBracesData($patientId);
    echo json_encode(array_merge(['success' => true], $data));
} catch (\PDOException $error) {
    error_log('Patient braces load failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to load braces information.']);
}
