<?php
// Run with: php tests/server_data_regression.php
require_once __DIR__ . '/../backend/classes/DataScope.php';
require_once __DIR__ . '/../backend/classes/SmsGateway.php';

[$where, $params] = \ASDC\DataScope::forUser(42, 'patient')->patientFilter();
if ($where !== 'p.user_id = ?' || $params !== [42]) {
    throw new RuntimeException('Patient profile queries must be scoped to the signed-in user.');
}
[$where, $params] = \ASDC\DataScope::forUser(7, 'receptionist')->patientFilter();
if ($where !== '1=1' || $params !== []) {
    throw new RuntimeException('Receptionist patient access changed unexpectedly.');
}
$result = \ASDC\SmsGateway::sendSms('unused', 'No message should be sent.');
if ($result['ok'] !== false || empty($result['error'])) {
    throw new RuntimeException('An unconfigured SMS provider must report failure.');
}
echo "PASS: patient profile scoping and unavailable SMS delivery.\n";
