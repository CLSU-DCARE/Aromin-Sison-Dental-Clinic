<?php
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
echo "PASS: patient profile scoping.\n";
