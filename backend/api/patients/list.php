<?php
/**
 * GET /backend/api/patients/list.php
 * Returns all patients: this is the pattern for the Patient Management table
 * in the admin dashboard. Copy this structure for appointments, contracts, etc.
 *
 * Protected: requires an authenticated staff/clinician session (receptionist
 * or dentist). Add the same require_role() guard to every data endpoint.
 */

require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_role('receptionist', 'dentist');

$stmt = $pdo->query('
    SELECT patient_id, first_name, last_name, contact_number, email, registered_at
    FROM patients
    ORDER BY registered_at DESC
');
$patients = $stmt->fetchAll();

echo json_encode(['success' => true, 'patients' => $patients]);
