<?php
/**
 * Patient payment submission endpoint.
 * Delegates to ASDC\PaymentApprovalService / ASDC\ReceiptUploader.
 *
 * GET  /backend/api/patients/payments.php         -> this patient's own submissions
 * POST /backend/api/patients/payments.php          (multipart/form-data)
 *   Fields: amount, method, note?, receipt (file)
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

$method = \ASDC\ApiResponse::method('GET', 'POST');
require_role('patient');

$patientId = \ASDC\PatientService::resolvePatientId((int) $_SESSION['user_id']);

if ($method === 'GET') {
    try {
        $rows = \ASDC\PaymentApprovalService::listForPatient($patientId);
        \ASDC\ApiResponse::ok(['submissions' => $rows]);
    } catch (\PDOException $e) {
        error_log('Patient payment list failed: ' . $e->getMessage());
        \ASDC\ApiResponse::error(500, 'server_error', 'Unable to load your payment submissions.');
    }
}

\ASDC\CsrfToken::requireValid();

$amount = filter_var($_POST['amount'] ?? null, FILTER_VALIDATE_FLOAT);
$fields = [];
if ($amount === false || $amount <= 0 || $amount > 99999999.99) {
    $fields['amount'] = 'Enter the amount you paid.';
}
$method_ = is_string($_POST['method'] ?? null) ? trim($_POST['method']) : '';
if (!in_array(strtolower($method_), ['cash','card','gcash','bank transfer','over the counter','online (qr)'], true)) {
    $fields['method'] = 'Select a payment method.';
}
if ($fields) {
    \ASDC\ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);
}
if (!is_string($_POST['note'] ?? '') || mb_strlen($_POST['note'] ?? '') > 255) \ASDC\ApiResponse::error(422, 'validation_failed', 'Payment note must be at most 255 characters.');

$receiptPath = \ASDC\ReceiptUploader::store($_FILES['receipt'] ?? null, $patientId);

$submission = \ASDC\PaymentApprovalService::submit($patientId, [
    'amount' => $amount,
    'method' => $method_,
    'note'   => is_string($_POST['note'] ?? null) ? trim($_POST['note']) : '',
    'user_id' => (int) $_SESSION['user_id'],
], $receiptPath);

\ASDC\ApiResponse::ok(['submission' => $submission], 'Payment submitted for review', 201);
