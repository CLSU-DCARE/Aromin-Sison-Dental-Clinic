<?php
/**
 * Payment approval endpoint (receptionist-only).
 * Delegates to ASDC\PaymentApprovalService.
 *
 * GET  /backend/api/payments/payments.php?status=pending   -> list (default: all)
 * POST /backend/api/payments/payments.php
 *   Body: { payment_id, action: "approve"|"reject" }
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

$method = \ASDC\ApiResponse::method('GET', 'POST');
require_role('receptionist');

if ($method === 'GET') {
    try {
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

\ASDC\CsrfToken::requireValid();
$body = \ASDC\ApiResponse::requireJson();

$paymentId = is_string($body['payment_id'] ?? null)
    ? trim($body['payment_id'])
    : \ASDC\InputValidator::positiveId($body['payment_id'] ?? null);
$action = is_string($body['action'] ?? null) ? strtolower(trim($body['action'])) : '';

if (!$paymentId || !in_array($action, ['approve', 'reject'], true)) {
    \ASDC\ApiResponse::error(422, 'validation_failed', 'A valid payment and action are required.');
}

$reviewerId = (int) $_SESSION['user_id'];
$result = $action === 'approve'
    ? \ASDC\PaymentApprovalService::approve($paymentId, $reviewerId)
    : \ASDC\PaymentApprovalService::reject($paymentId, $reviewerId);

\ASDC\ApiResponse::ok(['payment' => $result], $action === 'approve' ? 'Payment approved' : 'Payment rejected');
