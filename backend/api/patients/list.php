<?php
/**
 * Patient list endpoint (admin dashboard).
 * Delegates to ASDC\PatientService.
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/headers.php';

require_role('receptionist', 'dentist');

$patients = \ASDC\PatientService::listAll();
echo json_encode(['success' => true, 'patients' => $patients]);
