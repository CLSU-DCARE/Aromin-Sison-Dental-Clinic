<?php
/**
 * Payment submission & approval service: Aromin-Sison Dental Clinic System.
 *
 * Patient-facing: submit a payment receipt for review.
 * Receptionist-facing: list pending submissions, approve/reject them.
 * Approving applies the amount to the contract's balance (via
 * ContractService::applyPayment) and logs a real notification to the
 * patient — this is what actually connects "Patient submits payment" to
 * "Receptionist approves" to "Patient sees updated balance" end to end.
 *
 * Usage:
 *   PaymentApprovalService::submit($patientId, $data, $receiptPath);
 *   PaymentApprovalService::listPending();
 *   PaymentApprovalService::approve($paymentId, $reviewerId);
 *   PaymentApprovalService::reject($paymentId, $reviewerId);
 */

namespace ASDC;

class PaymentApprovalService
{
    private const METHOD_MAP = [
        'over the counter' => 'cash',
        'cash'             => 'cash',
        'online (qr)'      => 'gcash',
        'gcash'            => 'gcash',
        'card'             => 'card',
        'bank transfer'    => 'bank_transfer',
    ];

    /**
     * Patient submits a payment for review against their active contract.
     * Returns the presented submission row.
     */
    public static function submit(int $patientId, array $data, string $receiptPath): array
    {
        $method = self::METHOD_MAP[strtolower(trim($data['method'] ?? ''))] ?? 'other';

        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
        $contract = self::lockActiveContractForPatient($patientId);
        if (!$contract) {
            $pdo->rollBack();
            ApiResponse::error(422, 'no_contract', 'You do not have an active braces contract to submit a payment for.');
        }

        $amount = (float) $data['amount'];
        $pendingTotal = self::pendingTotal((int) $contract['contract_id']);
        $availableBalance = max(0, (float) $contract['balance_amount'] - $pendingTotal);
        if ($amount > $availableBalance) {
            $pdo->rollBack();
            ApiResponse::error(409, 'payment_exceeds_balance', 'This payment exceeds the remaining balance after pending submissions.');
        }

        $stmt = $pdo->prepare(
            'INSERT INTO contract_payments
                (contract_id, amount_paid, payment_date, payment_method, status, receipt_path, note, submitted_by)
             VALUES (?, ?, CURRENT_DATE(), ?, \'pending\', ?, ?, ?)'
        );
        $stmt->execute([
            $contract['contract_id'], $amount, $method,
            $receiptPath, $data['note'] !== '' ? $data['note'] : null, $data['user_id'],
        ]);

        $result = self::present(self::findRaw((int) $pdo->lastInsertId()) + self::patientInfo($patientId));
        PortalEvent::patient($patientId, 'Payment submitted', 'A payment receipt is awaiting review.', 'pay');
        $pdo->commit();
        return $result;
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }

    private static function patientInfo(int $patientId): array
    {
        $stmt = Database::pdo()->prepare('SELECT first_name, last_name, patient_id FROM patients WHERE patient_id = ?');
        $stmt->execute([$patientId]);
        return $stmt->fetch() ?: [];
    }

    /** All of this patient's own submissions (any status), newest first. */
    public static function listForPatient(int $patientId): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT cp.* FROM contract_payments cp
             JOIN braces_contracts c ON c.contract_id = cp.contract_id
             WHERE c.patient_id = ?
             ORDER BY cp.created_at DESC, cp.payment_id DESC"
        );
        $stmt->execute([$patientId]);
        return array_map([self::class, 'present'], $stmt->fetchAll());
    }

    /** All pending submissions clinic-wide, for the receptionist's
     *  Payment Approvals table. */
    public static function listPending(): array
    {
        return self::listByStatus('pending');
    }

    public static function listAll(): array
    {
        $stmt = Database::pdo()->query(
            "SELECT cp.*, p.first_name, p.last_name, p.patient_id
             FROM contract_payments cp
             JOIN braces_contracts c ON c.contract_id = cp.contract_id
             JOIN patients p ON p.patient_id = c.patient_id
             WHERE p.archived_at IS NULL
             ORDER BY cp.created_at DESC, cp.payment_id DESC"
        );
        return array_map([self::class, 'present'], $stmt->fetchAll());
    }

    private static function listByStatus(string $status): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT cp.*, p.first_name, p.last_name, p.patient_id
             FROM contract_payments cp
             JOIN braces_contracts c ON c.contract_id = cp.contract_id
             JOIN patients p ON p.patient_id = c.patient_id
             WHERE cp.status = ?
               AND p.archived_at IS NULL
             ORDER BY cp.created_at ASC, cp.payment_id ASC"
        );
        $stmt->execute([$status]);
        return array_map([self::class, 'present'], $stmt->fetchAll());
    }

    public static function approve(int $paymentId, int $reviewerId): array
    {
        return self::review($paymentId, $reviewerId, true);
    }

    public static function reject(int $paymentId, int $reviewerId): array
    {
        return self::review($paymentId, $reviewerId, false);
    }

    private static function review(int $paymentId, int $reviewerId, bool $approve): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT * FROM contract_payments WHERE payment_id = ? FOR UPDATE');
            $stmt->execute([$paymentId]);
            $row = $stmt->fetch();
            if (!$row || $row['status'] !== 'pending') {
                $pdo->rollBack();
                if (!$row) ApiResponse::error(404, 'not_found', 'Payment submission not found.');
                ApiResponse::error(409, 'already_reviewed', 'This submission was already reviewed.');
            }
            if ($approve) {
                $contract = self::lockContract((int) $row['contract_id']);
                if (!$contract || $contract['status'] !== 'active') {
                    $pdo->rollBack();
                    ApiResponse::error(409, 'inactive_contract', 'Payments can only be approved for active contracts.');
                }

                $amount = (float) $row['amount_paid'];
                $pendingTotal = self::pendingTotal((int) $row['contract_id'], $paymentId);
                $availableBalance = max(0, (float) $contract['balance_amount'] - $pendingTotal);
                if ($amount > $availableBalance) {
                    $pdo->rollBack();
                    ApiResponse::error(409, 'payment_exceeds_balance', 'This payment exceeds the remaining balance after pending submissions.');
                }
            }
            $status = $approve ? 'approved' : 'rejected';
            $orNumber = $approve ? 'OR-' . date('Ymd') . '-' . str_pad((string) $paymentId, 3, '0', STR_PAD_LEFT) : null;
            $stmt = $pdo->prepare('UPDATE contract_payments SET status = ?, reviewed_by = ?, reviewed_at = NOW(), or_number = ? WHERE payment_id = ?');
            $stmt->execute([$status, $reviewerId, $orNumber, $paymentId]);
            if ($approve) ContractService::applyPayment((int) $row['contract_id'], (float) $row['amount_paid']);
            $contract = ContractService::findRaw((int) $row['contract_id']);
            PortalEvent::patient((int) $contract['patient_id'], 'Payment ' . $status, 'Payment review completed. View your billing details for the receipt and balance.', 'pay');
            $pdo->commit();
        } catch (\Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        // Delivery runs after the status and balance have committed together.
        self::notifyPatient((int) $row['contract_id'], $approve ? 'payment_received' : 'payment_rejected', [
            'amount' => '₱' . number_format((float) $row['amount_paid'], 2),
        ]);
        return self::present(self::findRaw($paymentId));
    }

    /* ------------------------------------------------------------------
     *  Private helpers
     * ----------------------------------------------------------------*/

    private static function findRaw(int $paymentId): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM contract_payments WHERE payment_id = ? LIMIT 1');
        $stmt->execute([$paymentId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private static function lockActiveContractForPatient(int $patientId): ?array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT * FROM braces_contracts
             WHERE patient_id = ?
               AND patient_id IN (SELECT patient_id FROM patients WHERE archived_at IS NULL)
               AND status = 'active'
             ORDER BY contract_id DESC
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([$patientId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private static function lockContract(int $contractId): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT c.* FROM braces_contracts c
              JOIN patients p ON p.patient_id=c.patient_id
             WHERE c.contract_id = ? AND p.archived_at IS NULL
             FOR UPDATE'
        );
        $stmt->execute([$contractId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private static function pendingTotal(int $contractId, ?int $excludePaymentId = null): float
    {
        $sql = "SELECT payment_id, amount_paid FROM contract_payments WHERE contract_id = ? AND status = 'pending'";
        $params = [$contractId];
        if ($excludePaymentId !== null) {
            $sql .= ' AND payment_id <> ?';
            $params[] = $excludePaymentId;
        }
        $sql .= ' FOR UPDATE';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);

        $total = 0.0;
        foreach ($stmt->fetchAll() as $row) {
            $total += (float) $row['amount_paid'];
        }
        return $total;
    }

    private static function notifyPatient(int $contractId, string $templateKey, array $replacements): void
    {
        try {
            $stmt = Database::pdo()->prepare('SELECT patient_id FROM braces_contracts WHERE contract_id = ?');
            $stmt->execute([$contractId]);
            $patientId = $stmt->fetchColumn();
            if ($patientId) {
                NotificationSendService::send((int) $patientId, [
                    'template_key' => $templateKey,
                    'replacements' => $replacements,
                ]);
            }
        } catch (\Throwable $e) {
            error_log('Payment notification failed: ' . $e->getMessage());
        }
    }

    private static function present(array $row): array
    {
        $name = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        return [
            'id'         => (int) $row['payment_id'],
            'contract_id' => (int) $row['contract_id'],
            'pid'        => isset($row['patient_id']) ? '#P-' . $row['patient_id'] : null,
            'patient'    => $name ?: null,
            'amount'     => '₱' . number_format((float) $row['amount_paid'], 2),
            'method'     => ucwords(str_replace('_', ' ', $row['payment_method'])),
            'note'       => $row['note'] ?? '',
            'receipt_url' => $row['receipt_path'] ? '../backend/api/payments/receipt.php?payment_id=' . (int) $row['payment_id'] : null,
            'status'     => $row['status'],
            'submittedAt' => self::fmtDateTime($row['created_at']),
            'reviewedAt'  => $row['reviewed_at'] ? self::fmtDateTime($row['reviewed_at']) : null,
            'orNumber'    => $row['or_number'] ?? null,
        ];
    }

    private static function fmtDateTime(?string $value): ?string
    {
        if (!$value) return null;
        $dt = \DateTime::createFromFormat('Y-m-d H:i:s', $value);
        return $dt ? $dt->format('F j, Y \a\t g:i A') : $value;
    }
}
