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
        $amount = (float) $data['amount'];
        $contract = self::lockActiveContractForPatient($patientId);
        if ($contract) {
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
        } else {
            $bill = self::lockOrCreateTreatmentBill($patientId, $amount);
            $pendingTotal = self::pendingTreatmentTotal((int) $bill['bill_id']);
            $availableBalance = max(0, (float) $bill['balance_amount'] - $pendingTotal);
            if ($amount > $availableBalance) {
                $pdo->rollBack();
                ApiResponse::error(409, 'payment_exceeds_balance', 'This payment exceeds the remaining balance after pending submissions.');
            }

            $stmt = $pdo->prepare(
                'INSERT INTO treatment_payments
                    (bill_id, amount_paid, payment_date, payment_method, status, receipt_path, note, submitted_by)
                 VALUES (?, ?, CURRENT_DATE(), ?, \'pending\', ?, ?, ?)'
            );
            $stmt->execute([
                $bill['bill_id'], $amount, $method,
                $receiptPath, $data['note'] !== '' ? $data['note'] : null, $data['user_id'],
            ]);

            $result = self::presentTreatment(self::findTreatmentRaw((int) $pdo->lastInsertId()) + self::patientInfo($patientId));
        }
        PortalEvent::patient($patientId, 'Payment submitted', 'Your payment receipt was submitted and is awaiting review.', 'pay');
        PortalEvent::staffNotice(
            'Payment receipt submitted',
            trim(($result['patient'] ?? 'A patient') . ' submitted a payment receipt for ' . ($result['amount'] ?? 'review') . '.'),
            'pay',
            $patientId
        );
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
            "SELECT cp.*, c.start_date, c.duration_months, c.total_amount, c.monthly_payment, c.balance_amount
             FROM contract_payments cp
             JOIN braces_contracts c ON c.contract_id = cp.contract_id
             WHERE c.patient_id = ?
             ORDER BY cp.created_at DESC, cp.payment_id DESC"
        );
        $stmt->execute([$patientId]);
        $contractPayments = array_map([self::class, 'present'], $stmt->fetchAll());
        $treatmentPayments = self::listTreatmentForPatient($patientId);
        return self::sortPayments(array_merge($contractPayments, $treatmentPayments));
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
            "SELECT cp.*, c.start_date, c.duration_months, c.total_amount, c.monthly_payment, c.balance_amount,
                    p.first_name, p.last_name, p.patient_id
             FROM contract_payments cp
             JOIN braces_contracts c ON c.contract_id = cp.contract_id
             JOIN patients p ON p.patient_id = c.patient_id
             WHERE p.archived_at IS NULL
             ORDER BY cp.created_at DESC, cp.payment_id DESC"
        );
        $contractPayments = array_map([self::class, 'present'], $stmt->fetchAll());
        $treatmentPayments = self::listTreatmentAll();
        return self::sortPayments(array_merge($contractPayments, $treatmentPayments));
    }

    private static function listByStatus(string $status): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT cp.*, c.start_date, c.duration_months, c.total_amount, c.monthly_payment, c.balance_amount,
                    p.first_name, p.last_name, p.patient_id
             FROM contract_payments cp
             JOIN braces_contracts c ON c.contract_id = cp.contract_id
             JOIN patients p ON p.patient_id = c.patient_id
             WHERE cp.status = ?
               AND p.archived_at IS NULL
             ORDER BY cp.created_at ASC, cp.payment_id ASC"
        );
        $stmt->execute([$status]);
        $contractPayments = array_map([self::class, 'present'], $stmt->fetchAll());
        $treatmentPayments = self::listTreatmentByStatus($status);
        return self::sortPayments(array_merge($contractPayments, $treatmentPayments));
    }

    public static function approve($paymentId, int $reviewerId): array
    {
        return self::review($paymentId, $reviewerId, true);
    }

    public static function reject($paymentId, int $reviewerId): array
    {
        return self::review($paymentId, $reviewerId, false);
    }

    private static function review($paymentId, int $reviewerId, bool $approve): array
    {
        $ref = self::paymentRef($paymentId);
        if ($ref['type'] === 'treatment') {
            return self::reviewTreatment($ref['id'], $reviewerId, $approve);
        }
        $paymentId = $ref['id'];
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
            if ($approve) {
                $billing = self::billingContext((int) $row['contract_id'], (float) $row['amount_paid']);
                $fullyPaid = (float) ($billing['raw_balance'] ?? 0) <= 0;
                PortalEvent::patient(
                    (int) $contract['patient_id'],
                    $fullyPaid ? 'Balance Fully Paid' : 'Payment Recorded',
                    self::renderTemplate($fullyPaid ? 'balance_fully_paid_patient' : 'payment_recorded_patient', $billing['message_fallback'], $billing['replacements']),
                    'pay',
                    true
                );
                PortalEvent::staffNotice(
                    $fullyPaid ? 'Balance Fully Paid' : 'Payment Received',
                    self::renderTemplate($fullyPaid ? 'balance_fully_paid_staff' : 'payment_received_staff', $billing['message_fallback'], $billing['replacements']),
                    'pay',
                    (int) $contract['patient_id'],
                    true
                );
            } else {
                PortalEvent::patient((int) $contract['patient_id'], 'Payment rejected', 'Your payment submission could not be approved. Please review your billing details and contact the clinic if needed.', 'pay', true);
            }
            $pdo->commit();
        } catch (\Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        // Delivery runs after the status and balance have committed together.
        if ($approve) {
            $billing = self::billingContext((int) $row['contract_id'], (float) $row['amount_paid']);
            self::notifyPatient(
                (int) $row['contract_id'],
                ((float) ($billing['raw_balance'] ?? 0) <= 0) ? 'balance_fully_paid_patient' : 'payment_recorded_patient',
                $billing['replacements']
            );
        }
        if (!$approve) self::notifyPatient((int) $row['contract_id'], 'payment_rejected', [
            'amount' => '₱' . number_format((float) $row['amount_paid'], 2),
        ]);
        return self::present(self::findRaw($paymentId));
    }

    private static function reviewTreatment(int $paymentId, int $reviewerId, bool $approve): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT * FROM treatment_payments WHERE payment_id = ? FOR UPDATE');
            $stmt->execute([$paymentId]);
            $row = $stmt->fetch();
            if (!$row || $row['status'] !== 'pending') {
                $pdo->rollBack();
                if (!$row) ApiResponse::error(404, 'not_found', 'Payment submission not found.');
                ApiResponse::error(409, 'already_reviewed', 'This submission was already reviewed.');
            }

            $bill = self::lockTreatmentBill((int) $row['bill_id']);
            if (!$bill || $bill['status'] !== 'active') {
                $pdo->rollBack();
                ApiResponse::error(409, 'inactive_bill', 'Payments can only be approved for active billing accounts.');
            }

            if ($approve) {
                $amount = (float) $row['amount_paid'];
                $pendingTotal = self::pendingTreatmentTotal((int) $row['bill_id'], $paymentId);
                $availableBalance = max(0, (float) $bill['balance_amount'] - $pendingTotal);
                if ($amount > $availableBalance) {
                    $pdo->rollBack();
                    ApiResponse::error(409, 'payment_exceeds_balance', 'This payment exceeds the remaining balance after pending submissions.');
                }
            }

            $status = $approve ? 'approved' : 'rejected';
            $orNumber = $approve ? 'OR-' . date('Ymd') . '-T' . str_pad((string) $paymentId, 3, '0', STR_PAD_LEFT) : null;
            $stmt = $pdo->prepare('UPDATE treatment_payments SET status = ?, reviewed_by = ?, reviewed_at = NOW(), or_number = ? WHERE payment_id = ?');
            $stmt->execute([$status, $reviewerId, $orNumber, $paymentId]);

            if ($approve) {
                self::applyTreatmentPayment((int) $row['bill_id'], (float) $row['amount_paid']);
                $billing = self::treatmentBillingContext((int) $row['bill_id'], (float) $row['amount_paid']);
                $fullyPaid = (float) ($billing['raw_balance'] ?? 0) <= 0;
                PortalEvent::patient(
                    (int) $bill['patient_id'],
                    $fullyPaid ? 'Balance Fully Paid' : 'Payment Recorded',
                    self::renderTemplate($fullyPaid ? 'balance_fully_paid_patient' : 'payment_recorded_patient', $billing['message_fallback'], $billing['replacements']),
                    'pay',
                    true
                );
                PortalEvent::staffNotice(
                    $fullyPaid ? 'Balance Fully Paid' : 'Payment Received',
                    self::renderTemplate($fullyPaid ? 'balance_fully_paid_staff' : 'payment_received_staff', $billing['message_fallback'], $billing['replacements']),
                    'pay',
                    (int) $bill['patient_id'],
                    true
                );
            } else {
                PortalEvent::patient((int) $bill['patient_id'], 'Payment rejected', 'Your payment submission could not be approved. Please review your billing details and contact the clinic if needed.', 'pay', true);
            }
            $pdo->commit();
        } catch (\Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }

        if ($approve) {
            $billing = self::treatmentBillingContext((int) $row['bill_id'], (float) $row['amount_paid']);
            self::notifyPatientById(
                (int) $billing['patient_id'],
                ((float) ($billing['raw_balance'] ?? 0) <= 0) ? 'balance_fully_paid_patient' : 'payment_recorded_patient',
                $billing['replacements']
            );
        }
        if (!$approve) self::notifyPatientById((int) $bill['patient_id'], 'payment_rejected', [
            'amount' => 'PHP ' . number_format((float) $row['amount_paid'], 2),
        ]);
        return self::presentTreatment(self::findTreatmentRaw($paymentId));
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

    private static function findTreatmentRaw(int $paymentId): ?array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT tp.*, tb.patient_id, tb.service_treatment, tb.total_amount, tb.balance_amount,
                    p.first_name, p.last_name
             FROM treatment_payments tp
             JOIN treatment_bills tb ON tb.bill_id = tp.bill_id
             JOIN patients p ON p.patient_id = tb.patient_id
             WHERE tp.payment_id = ?
             LIMIT 1"
        );
        $stmt->execute([$paymentId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private static function paymentRef($paymentId): array
    {
        if (is_string($paymentId) && preg_match('/^T-(\d+)$/i', trim($paymentId), $m)) {
            return ['type' => 'treatment', 'id' => (int) $m[1]];
        }
        if (is_string($paymentId) && preg_match('/^C-(\d+)$/i', trim($paymentId), $m)) {
            return ['type' => 'contract', 'id' => (int) $m[1]];
        }
        $id = InputValidator::positiveId($paymentId);
        if (!$id) ApiResponse::error(422, 'validation_failed', 'A valid payment is required.');
        return ['type' => 'contract', 'id' => $id];
    }

    private static function sortPayments(array $rows): array
    {
        usort($rows, fn($a, $b) => strcmp((string) ($b['_sort'] ?? ''), (string) ($a['_sort'] ?? '')));
        return array_map(function ($row) {
            unset($row['_sort']);
            return $row;
        }, $rows);
    }

    private static function listTreatmentForPatient(int $patientId): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT tp.*, tb.patient_id, tb.service_treatment, tb.total_amount, tb.balance_amount,
                    p.first_name, p.last_name
             FROM treatment_payments tp
             JOIN treatment_bills tb ON tb.bill_id = tp.bill_id
             JOIN patients p ON p.patient_id = tb.patient_id
             WHERE tb.patient_id = ?
             ORDER BY tp.created_at DESC, tp.payment_id DESC"
        );
        $stmt->execute([$patientId]);
        return array_map([self::class, 'presentTreatment'], $stmt->fetchAll());
    }

    private static function listTreatmentAll(): array
    {
        $stmt = Database::pdo()->query(
            "SELECT tp.*, tb.patient_id, tb.service_treatment, tb.total_amount, tb.balance_amount,
                    p.first_name, p.last_name
             FROM treatment_payments tp
             JOIN treatment_bills tb ON tb.bill_id = tp.bill_id
             JOIN patients p ON p.patient_id = tb.patient_id
             WHERE p.archived_at IS NULL
             ORDER BY tp.created_at DESC, tp.payment_id DESC"
        );
        return array_map([self::class, 'presentTreatment'], $stmt->fetchAll());
    }

    private static function listTreatmentByStatus(string $status): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT tp.*, tb.patient_id, tb.service_treatment, tb.total_amount, tb.balance_amount,
                    p.first_name, p.last_name
             FROM treatment_payments tp
             JOIN treatment_bills tb ON tb.bill_id = tp.bill_id
             JOIN patients p ON p.patient_id = tb.patient_id
             WHERE tp.status = ?
               AND p.archived_at IS NULL
             ORDER BY tp.created_at ASC, tp.payment_id ASC"
        );
        $stmt->execute([$status]);
        return array_map([self::class, 'presentTreatment'], $stmt->fetchAll());
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

    private static function lockOrCreateTreatmentBill(int $patientId, float $amount): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT * FROM treatment_bills
             WHERE patient_id = ?
               AND status = 'active'
             ORDER BY bill_id DESC
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([$patientId]);
        $bill = $stmt->fetch();
        if ($bill) return $bill;

        $context = self::latestTreatmentContext($patientId);
        $stmt = Database::pdo()->prepare(
            'INSERT INTO treatment_bills
                (patient_id, appointment_id, service_treatment, total_amount, balance_amount, status)
             VALUES (?, ?, ?, ?, ?, \'active\')'
        );
        $stmt->execute([
            $patientId,
            $context['appointment_id'],
            $context['service_treatment'],
            $amount,
            $amount,
        ]);

        return self::lockTreatmentBill((int) Database::pdo()->lastInsertId());
    }

    private static function latestTreatmentContext(int $patientId): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT a.appointment_id, a.service_type
             FROM appointments a
             WHERE a.patient_id = ?
             ORDER BY a.scheduled_date DESC, a.scheduled_time DESC, a.appointment_id DESC
             LIMIT 1"
        );
        $stmt->execute([$patientId]);
        $appointment = $stmt->fetch();
        if ($appointment) {
            return [
                'appointment_id' => (int) $appointment['appointment_id'],
                'service_treatment' => $appointment['service_type'] ?: 'Dental Treatment',
            ];
        }

        $stmt = Database::pdo()->prepare(
            "SELECT treatment_given
             FROM treatment_records
             WHERE patient_id = ?
             ORDER BY date_recorded DESC, record_id DESC
             LIMIT 1"
        );
        $stmt->execute([$patientId]);
        $record = $stmt->fetch();
        return [
            'appointment_id' => null,
            'service_treatment' => ($record && trim((string) $record['treatment_given']) !== '')
                ? trim((string) $record['treatment_given'])
                : 'Dental Treatment',
        ];
    }

    private static function lockTreatmentBill(int $billId): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT tb.*, p.first_name, p.last_name, p.contact_number, p.email
             FROM treatment_bills tb
             JOIN patients p ON p.patient_id = tb.patient_id
             WHERE tb.bill_id = ?
               AND p.archived_at IS NULL
             FOR UPDATE'
        );
        $stmt->execute([$billId]);
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

    private static function pendingTreatmentTotal(int $billId, ?int $excludePaymentId = null): float
    {
        $sql = "SELECT payment_id, amount_paid FROM treatment_payments WHERE bill_id = ? AND status = 'pending'";
        $params = [$billId];
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

    private static function applyTreatmentPayment(int $billId, float $amount): void
    {
        $bill = self::lockTreatmentBill($billId);
        if (!$bill) return;
        $newBalance = max(0, (float) $bill['balance_amount'] - $amount);
        $status = $newBalance <= 0 ? 'paid' : 'active';
        $stmt = Database::pdo()->prepare('UPDATE treatment_bills SET balance_amount = ?, status = ? WHERE bill_id = ?');
        $stmt->execute([$newBalance, $status, $billId]);
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

    private static function notifyPatientById(int $patientId, string $templateKey, array $replacements): void
    {
        try {
            NotificationSendService::send($patientId, [
                'template_key' => $templateKey,
                'replacements' => $replacements,
            ]);
        } catch (\Throwable $e) {
            error_log('Payment notification failed: ' . $e->getMessage());
        }
    }

    private static function billingContext(int $contractId, float $paymentAmount = 0): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT c.contract_id, c.patient_id, c.total_amount, c.balance_amount, c.current_stage,
                    p.first_name, p.last_name, p.contact_number, p.email
             FROM braces_contracts c
             JOIN patients p ON p.patient_id = c.patient_id
             WHERE c.contract_id = ?"
        );
        $stmt->execute([$contractId]);
        $row = $stmt->fetch() ?: [];

        $total = (float) ($row['total_amount'] ?? 0);
        $balance = max(0, (float) ($row['balance_amount'] ?? 0));
        $paid = max(0, $total - $balance);
        $patientName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));

        $replacements = [
            'patient_id' => '#P-' . ($row['patient_id'] ?? ''),
            'patient_name' => $patientName,
            'service_treatment' => 'Braces Treatment Plan',
            'payment_amount' => 'PHP ' . number_format($paymentAmount, 2),
            'total_amount' => 'PHP ' . number_format($total, 2),
            'amount_paid' => 'PHP ' . number_format($paid, 2),
            'remaining_balance' => 'PHP ' . number_format($balance, 2),
            'contact_number' => $row['contact_number'] ?: 'Not provided',
            'email' => $row['email'] ?: 'Not provided',
        ];

        return [
            'raw_balance' => $balance,
            'replacements' => $replacements,
            'message_fallback' => implode("\n", [
                'Patient ID: ' . $replacements['patient_id'],
                'Patient: ' . $replacements['patient_name'],
                'Service/Treatment: ' . $replacements['service_treatment'],
                'Payment Amount: ' . $replacements['payment_amount'],
                'Total Amount: ' . $replacements['total_amount'],
                'Amount Paid: ' . $replacements['amount_paid'],
                'Remaining Balance: ' . $replacements['remaining_balance'],
                'Contact Number: ' . $replacements['contact_number'],
                'Email: ' . $replacements['email'],
            ]),
        ];
    }

    private static function treatmentBillingContext(int $billId, float $paymentAmount = 0): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT tb.bill_id, tb.patient_id, tb.service_treatment, tb.total_amount, tb.balance_amount,
                    p.first_name, p.last_name, p.contact_number, p.email
             FROM treatment_bills tb
             JOIN patients p ON p.patient_id = tb.patient_id
             WHERE tb.bill_id = ?"
        );
        $stmt->execute([$billId]);
        $row = $stmt->fetch() ?: [];

        $total = (float) ($row['total_amount'] ?? 0);
        $balance = max(0, (float) ($row['balance_amount'] ?? 0));
        $paid = max(0, $total - $balance);
        $patientName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));

        $replacements = [
            'patient_id' => '#P-' . ($row['patient_id'] ?? ''),
            'patient_name' => $patientName,
            'service_treatment' => $row['service_treatment'] ?: 'Dental Treatment',
            'payment_amount' => 'PHP ' . number_format($paymentAmount, 2),
            'total_amount' => 'PHP ' . number_format($total, 2),
            'amount_paid' => 'PHP ' . number_format($paid, 2),
            'remaining_balance' => 'PHP ' . number_format($balance, 2),
            'contact_number' => $row['contact_number'] ?: 'Not provided',
            'email' => $row['email'] ?: 'Not provided',
        ];

        return [
            'patient_id' => (int) ($row['patient_id'] ?? 0),
            'raw_balance' => $balance,
            'replacements' => $replacements,
            'message_fallback' => implode("\n", [
                'Patient ID: ' . $replacements['patient_id'],
                'Patient: ' . $replacements['patient_name'],
                'Service/Treatment: ' . $replacements['service_treatment'],
                'Payment Amount: ' . $replacements['payment_amount'],
                'Total Amount: ' . $replacements['total_amount'],
                'Amount Paid: ' . $replacements['amount_paid'],
                'Remaining Balance: ' . $replacements['remaining_balance'],
                'Contact Number: ' . $replacements['contact_number'],
                'Email: ' . $replacements['email'],
            ]),
        ];
    }

    private static function renderTemplate(string $templateKey, string $fallback, array $replacements): string
    {
        $template = NotificationTemplateService::getByKey($templateKey);
        if (!$template || empty($template['body'])) return $fallback;
        return TemplateRenderer::render($template['body'], $replacements);
    }

    private static function present(array $row): array
    {
        $name = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        $due = self::dueDateForRow($row);
        return [
            'id'         => 'C-' . (int) $row['payment_id'],
            'payment_id' => (int) $row['payment_id'],
            'billing_type' => 'braces',
            'contract_id' => (int) $row['contract_id'],
            'pid'        => isset($row['patient_id']) ? '#P-' . $row['patient_id'] : null,
            'patient'    => $name ?: null,
            'amount'     => '₱' . number_format((float) $row['amount_paid'], 2),
            'method'     => ucwords(str_replace('_', ' ', $row['payment_method'])),
            'dueDate'    => $due['date'],
            'dueStatus'  => $due['status'],
            'note'       => $row['note'] ?? '',
            'receipt_url' => $row['receipt_path'] ? '../backend/api/payments/receipt.php?payment_id=' . (int) $row['payment_id'] : null,
            'status'     => $row['status'],
            'submittedAt' => self::fmtDateTime($row['created_at']),
            'reviewedAt'  => $row['reviewed_at'] ? self::fmtDateTime($row['reviewed_at']) : null,
            'orNumber'    => $row['or_number'] ?? null,
            '_sort'       => $row['created_at'] ?? '',
        ];
    }

    private static function presentTreatment(array $row): array
    {
        $name = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        $balance = (float) ($row['balance_amount'] ?? 0);
        $dueStatus = $balance <= 0 ? 'paid' : 'upcoming';
        $dueDate = $balance <= 0 ? 'Fully paid' : 'Upon clinic confirmation';
        return [
            'id'          => 'T-' . (int) $row['payment_id'],
            'payment_id'  => (int) $row['payment_id'],
            'billing_type' => 'treatment',
            'bill_id'     => (int) $row['bill_id'],
            'pid'         => isset($row['patient_id']) ? '#P-' . $row['patient_id'] : null,
            'patient'     => $name ?: null,
            'service'     => $row['service_treatment'] ?? 'Dental Treatment',
            'amount'      => 'â‚±' . number_format((float) $row['amount_paid'], 2),
            'method'      => ucwords(str_replace('_', ' ', $row['payment_method'])),
            'dueDate'     => $dueDate,
            'dueStatus'   => $dueStatus,
            'note'        => $row['note'] ?? '',
            'receipt_url' => $row['receipt_path'] ? '../backend/api/payments/receipt.php?payment_id=T-' . (int) $row['payment_id'] : null,
            'status'      => $row['status'],
            'submittedAt' => self::fmtDateTime($row['created_at']),
            'reviewedAt'  => $row['reviewed_at'] ? self::fmtDateTime($row['reviewed_at']) : null,
            'orNumber'    => $row['or_number'] ?? null,
            '_sort'       => $row['created_at'] ?? '',
        ];
    }

    private static function dueDateForRow(array $row): array
    {
        if (isset($row['balance_amount']) && (float) $row['balance_amount'] <= 0) {
            return ['date' => 'Fully paid', 'status' => 'paid'];
        }

        if (empty($row['start_date']) || empty($row['duration_months']) || empty($row['contract_id'])) {
            return ['date' => 'Not set', 'status' => 'upcoming'];
        }

        $start = \DateTime::createFromFormat('Y-m-d', $row['start_date']);
        if (!$start) {
            return ['date' => 'Not set', 'status' => 'upcoming'];
        }

        $durationMonths = max(1, (int) $row['duration_months']);
        $monthly = max(0, (float) ($row['monthly_payment'] ?? 0));
        $paid = max(0, (float) ($row['total_amount'] ?? 0) - (float) ($row['balance_amount'] ?? 0));
        $coveredMonths = $monthly > 0 ? (int) floor($paid / $monthly) : 0;
        $monthIndex = min(max(1, $coveredMonths + 1), $durationMonths);
        $due = clone $start;
        $due->modify('+' . $monthIndex . ' months');

        $today = new \DateTime('today');
        $status = 'upcoming';
        if ($due < $today) {
            $status = 'overdue';
        } elseif ($due->format('Y-m-d') === $today->format('Y-m-d')) {
            $status = 'due-today';
        }

        return ['date' => $due->format('M j, Y'), 'status' => $status];
    }

    private static function fmtDateTime(?string $value): ?string
    {
        if (!$value) return null;
        $dt = \DateTime::createFromFormat('Y-m-d H:i:s', $value);
        return $dt ? $dt->format('F j, Y \a\t g:i A') : $value;
    }
}
