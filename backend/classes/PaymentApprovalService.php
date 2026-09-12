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
        $contract = ContractService::activeContractForPatient($patientId);
        if (!$contract) {
            ApiResponse::error(422, 'no_contract', 'You do not have an active braces contract to submit a payment for.');
        }

        $method = self::METHOD_MAP[strtolower(trim($data['method'] ?? ''))] ?? 'other';

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO contract_payments
                (contract_id, amount_paid, payment_date, payment_method, status, receipt_path, note, submitted_by)
             VALUES (?, ?, CURRENT_DATE(), ?, \'pending\', ?, ?, ?)'
        );
        $stmt->execute([
            $contract['contract_id'], (float) $data['amount'], $method,
            $receiptPath, $data['note'] !== '' ? $data['note'] : null, $data['user_id'],
        ]);

        return self::present(self::findRaw((int) $pdo->lastInsertId()) + self::patientInfo($patientId));
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
             ORDER BY cp.created_at ASC, cp.payment_id ASC"
        );
        $stmt->execute([$status]);
        return array_map([self::class, 'present'], $stmt->fetchAll());
    }

    public static function approve(int $paymentId, int $reviewerId): array
    {
        $row = self::findRaw($paymentId);
        if (!$row) ApiResponse::error(404, 'not_found', 'Payment submission not found.');
        if ($row['status'] !== 'pending') ApiResponse::error(409, 'already_reviewed', 'This submission was already reviewed.');

        $orNumber = 'OR-' . date('Ymd') . '-' . str_pad((string) $paymentId, 3, '0', STR_PAD_LEFT);

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            "UPDATE contract_payments
                SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), or_number = ?
              WHERE payment_id = ?"
        );
        $stmt->execute([$reviewerId, $orNumber, $paymentId]);

        ContractService::applyPayment((int) $row['contract_id'], (float) $row['amount_paid']);

        self::notifyPatient((int) $row['contract_id'], 'payment_received', [
            'amount' => '₱' . number_format((float) $row['amount_paid'], 2),
        ]);

        return self::present(self::findRaw($paymentId));
    }

    public static function reject(int $paymentId, int $reviewerId): array
    {
        $row = self::findRaw($paymentId);
        if (!$row) ApiResponse::error(404, 'not_found', 'Payment submission not found.');
        if ($row['status'] !== 'pending') ApiResponse::error(409, 'already_reviewed', 'This submission was already reviewed.');

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            "UPDATE contract_payments SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW() WHERE payment_id = ?"
        );
        $stmt->execute([$reviewerId, $paymentId]);

        self::notifyPatient((int) $row['contract_id'], 'payment_rejected', [
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
            'receipt_url' => $row['receipt_path'] ? '../backend/' . $row['receipt_path'] : null,
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
