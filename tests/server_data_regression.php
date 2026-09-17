<?php
// Run with: php tests/server_data_regression.php
require_once __DIR__ . '/../backend/classes/DataScope.php';

[$where, $params] = \ASDC\DataScope::forUser(42, 'patient')->patientFilter();
if ($where !== 'p.user_id = ?' || $params !== [42]) {
    throw new RuntimeException('Patient profile queries must be scoped to the signed-in user.');
}
[$where, $params] = \ASDC\DataScope::forUser(7, 'receptionist')->patientFilter();
if ($where !== '1=1' || $params !== []) {
    throw new RuntimeException('Receptionist patient access changed unexpectedly.');
}
echo "PASS: patient profile scoping.\n";
