<?php
/**
 * Payment approval endpoint (shared staff workflow).
 * Delegates to ASDC\PaymentApprovalService.
 *
 * GET  /backend/api/payments/payments.php?status=pending   -> list (default: all)
 * POST /backend/api/payments/payments.php
 *   Body: { payment_id, action: "approve"|"reject", reject_reason? }
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

$method = \ASDC\ApiResponse::method('GET', 'POST');
require_role('receptionist', 'dentist');

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

\ASDC\ApiResponse::error(410, 'payments_removed', 'Payment processing has been removed. Historical records are read-only.');
