<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; } // Test script: never run it from a web browser.
// Run with: php tests/server_data_regression.php
require_once __DIR__ . '/../backend/classes/DataScope.php';

[$where, $params] = \ASDC\DataScope::forUser(42, 'patient')->patientFilter();
if ($where !== 'p.user_id = ? AND p.archived_at IS NULL' || $params !== [42]) {
    throw new RuntimeException('Patient profile queries must be scoped to the signed-in user.');
}
[$where, $params] = \ASDC\DataScope::forUser(7, 'receptionist')->patientFilter();
if ($where !== 'p.archived_at IS NULL' || $params !== []) {
    throw new RuntimeException('Receptionist patient access changed unexpectedly.');
}
[$where, $params] = \ASDC\DataScope::forUser(8, 'dentist')->patientFilter();
if ($where !== 'p.archived_at IS NULL' || $params !== []) {
    throw new RuntimeException('Dentists must retain clinic-wide patient access.');
}
[$where, $params] = \ASDC\DataScope::forUser(8, 'dentist')->appointmentFilter();
if ($where !== 'a.patient_id IN (SELECT patient_id FROM patients WHERE archived_at IS NULL)' || $params !== []) {
    throw new RuntimeException('Dentists must retain clinic-wide appointment access.');
}
[$where, $params] = \ASDC\DataScope::forUser(8, 'dentist')->contractFilter();
if ($where !== 'c.patient_id IN (SELECT patient_id FROM patients WHERE archived_at IS NULL)' || $params !== []) {
    throw new RuntimeException('Dentists must retain clinic-wide contract access.');
}
echo "PASS: patient scoping and clinic-wide dentist access.\n";
