<?php
/**
 * Braces contracts endpoint: list (GET), create (POST), update (PATCH).
 * Delegates to ASDC\ContractService.
 *
 * GET    /backend/api/contracts/contracts.php
 *   -> both shared staff roles see clinic-wide contracts.
 * POST   /backend/api/contracts/contracts.php   (receptionist only)
 *   Body: { patient_id, dentist_id?, total_amount, downpayment?, monthly_payment, duration_months, start_date?, status? }
 * PATCH  /backend/api/contracts/contracts.php   (receptionist only)
 *   Body: { contract_id, dentist_id?, total_amount, monthly_payment, duration_months, status? }
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

$method = \ASDC\ApiResponse::method('GET', 'POST', 'PATCH');

if ($method === 'GET') {
    require_role('receptionist', 'dentist');
    try {
        $rows = \ASDC\ContractService::listAll(\ASDC\DataScope::current());
        \ASDC\ApiResponse::ok(['contracts' => $rows]);
    } catch (\PDOException $e) {
        error_log('Contract list failed: ' . $e->getMessage());
        \ASDC\ApiResponse::error(500, 'server_error', 'Unable to load contracts.');
    }
}

require_role('receptionist');
\ASDC\CsrfToken::requireValid();
$body = \ASDC\ApiResponse::requireJson();
// Validate foreign keys and money before any write; never accept a patient account as a dentist.
if (!empty($body['dentist_id'])) {
    $check = \ASDC\Database::pdo()->prepare('SELECT dentist_id FROM dentists WHERE dentist_id=? AND is_active=1');
    $check->execute([$body['dentist_id']]);
    if (!$check->fetchColumn()) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose an active dentist.');
}
if ($method === 'POST') {
    $check = \ASDC\Database::pdo()->prepare('SELECT patient_id FROM patients WHERE patient_id=? AND archived_at IS NULL');
    $check->execute([$body['patient_id'] ?? 0]);
    if (!$check->fetchColumn()) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose an existing patient.');
}
foreach (['total_amount','monthly_payment','downpayment'] as $moneyKey) {
    if (isset($body[$moneyKey]) && (!is_numeric($body[$moneyKey]) || (float) $body[$moneyKey] < 0 || (float) $body[$moneyKey] > 99999999.99)) \ASDC\ApiResponse::error(422, 'validation_failed', 'Invalid payment amount.');
}
if (isset($body['status']) && !in_array($body['status'], ['active','completed','defaulted','cancelled'], true)) \ASDC\ApiResponse::error(422, 'validation_failed', 'Invalid contract status.');

if ($method === 'POST') {
    $fields = [];
    $patientId = \ASDC\InputValidator::positiveId($body['patient_id'] ?? null);
    if (!$patientId) $fields['patient_id'] = 'A valid patient is required.';
    $months = filter_var($body['duration_months'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 60]]);
    if ($months === false) $fields['duration_months'] = 'Enter a duration between 1 and 60 months.';
    $monthly = filter_var($body['monthly_payment'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($monthly === false || $monthly <= 0) $fields['monthly_payment'] = 'Enter a monthly payment amount.';
    $totalInput = filter_var($body['total_amount'] ?? null, FILTER_VALIDATE_FLOAT);
    $total = ($totalInput !== false && $totalInput > 0) ? $totalInput : ($months && $monthly ? $months * $monthly : 0);
    if ($total <= 0) $fields['total_amount'] = 'Enter the total contract amount.';
    $downpayment = filter_var($body['downpayment'] ?? 0, FILTER_VALIDATE_FLOAT) ?: 0;
    $status = $body['status'] ?? 'active';
    if ($downpayment > $total) $fields['downpayment'] = 'Downpayment cannot exceed the contract total.';
    $dentistId = \ASDC\InputValidator::positiveId($body['dentist_id'] ?? null);
    $startDate = \ASDC\InputValidator::date($body['start_date'] ?? null) ?: date('Y-m-d');

    if ($fields) {
        \ASDC\ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);
    }

    $contract = \ASDC\ContractService::create([
        'patient_id' => $patientId, 'dentist_id' => $dentistId,
        'total_amount' => $total, 'downpayment' => $downpayment, 'monthly_payment' => $monthly,
        'duration_months' => $months, 'start_date' => $startDate, 'status' => $status,
    ]);
    \ASDC\ApiResponse::ok(['contract' => $contract], 'Contract created', 201);
}

if ($method === 'PATCH') {
    $contractId = \ASDC\InputValidator::positiveId($body['contract_id'] ?? null);
    if (!$contractId) {
        \ASDC\ApiResponse::error(422, 'validation_failed', 'A valid contract is required.');
    }
    $fields = [];
    $months = filter_var($body['duration_months'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 60]]);
    if ($months === false) $fields['duration_months'] = 'Enter a duration between 1 and 60 months.';
    $monthly = filter_var($body['monthly_payment'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($monthly === false || $monthly <= 0) $fields['monthly_payment'] = 'Enter a monthly payment amount.';
    $totalInput = filter_var($body['total_amount'] ?? null, FILTER_VALIDATE_FLOAT);
    $total = ($totalInput !== false && $totalInput > 0) ? $totalInput : ($months && $monthly ? $months * $monthly : 0);
    if ($total <= 0) $fields['total_amount'] = 'Enter the total contract amount.';
    $status = in_array($body['status'] ?? null, ['active', 'completed', 'defaulted', 'cancelled'], true) ? $body['status'] : null;
    $dentistId = \ASDC\InputValidator::positiveId($body['dentist_id'] ?? null);

    if ($fields) {
        \ASDC\ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);
    }

    $contract = \ASDC\ContractService::update($contractId, [
        'dentist_id' => $dentistId, 'total_amount' => $total,
        'monthly_payment' => $monthly, 'duration_months' => $months, 'status' => $status,
    ]);
    \ASDC\ApiResponse::ok(['contract' => $contract], 'Contract updated');
}
