<?php
/**
 * Braces contracts endpoint: list (GET), create (POST), update (PATCH).
 * Delegates to ASDC\ContractService.
 *
 * GET    /backend/api/contracts/contracts.php
 *   -> receptionist sees all contracts; dentist sees only their own.
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
    $status = in_array($body['status'] ?? 'active', ['active', 'completed', 'defaulted', 'cancelled'], true) ? $body['status'] : 'active';
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
