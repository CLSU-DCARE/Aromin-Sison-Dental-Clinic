<?php
/**
 * Staff billing history and direct payment collection.
 *
 * GET  /backend/api/payments/payments.php?status=pending   -> list (default: all)
 * GET  /backend/api/payments/payments.php?view=accounts    -> open balances
 * POST /backend/api/payments/payments.php
 *   Body: { action: "record", account_id: "C-1"|"T-1", amount, payment_method, payment_date, note? }
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

$method = \ASDC\ApiResponse::method('GET', 'POST');
require_role('receptionist', 'dentist');

if ($method === 'GET') {
    session_write_close();
    try {
        $patientId = null;
        if (isset($_GET['patient_id'])) {
            $patientId = \ASDC\InputValidator::positiveId($_GET['patient_id']);
            if (!$patientId) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid patient.');
        }
        if (($_GET['view'] ?? '') === 'patients') {
            \ASDC\ApiResponse::ok(['patients'=>\ASDC\StaffPaymentService::patientSummaries()]);
        }
        if (($_GET['view'] ?? '') === 'patient') {
            if (!$patientId) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid patient.');
            \ASDC\ApiResponse::ok(\ASDC\StaffPaymentService::patientBilling($patientId));
        }
        if (($_GET['view'] ?? '') === 'accounts') {
            \ASDC\ApiResponse::ok(['accounts' => \ASDC\StaffPaymentService::accounts($patientId)]);
        }
        $status = $_GET['status'] ?? '';
        $rows = $status === 'pending'
            ? \ASDC\PaymentApprovalService::listPending()
            : \ASDC\PaymentApprovalService::listAll();
        \ASDC\ApiResponse::ok(['payments' => $rows]);
    } catch (\PDOException $e) {
        error_log('Payment list failed: ' . $e->getMessage());
        \ASDC\ApiResponse::error(500, 'server_error', 'Unable to load payment submissions.');
    }
}

try {
    \ASDC\CsrfToken::requireValid();
    $body = \ASDC\ApiResponse::requireJson();
    if (($body['action'] ?? '') !== 'record') {
        \ASDC\ApiResponse::error(410, 'payments_removed', 'Online payment submission and review are no longer available.');
    }
    $payment = \ASDC\StaffPaymentService::record($body);
    \ASDC\ApiResponse::ok(['payment' => $payment], 'Payment recorded.', 201);
} catch (\InvalidArgumentException $e) {
    \ASDC\ApiResponse::error(422, 'validation_failed', $e->getMessage());
} catch (\DomainException $e) {
    \ASDC\ApiResponse::error(409, 'billing_conflict', $e->getMessage());
} catch (\Throwable $e) {
    error_log('Staff payment failed: ' . $e->getMessage());
    \ASDC\ApiResponse::error(500, 'server_error', 'Unable to record payment. Check payment history before retrying.');
}
