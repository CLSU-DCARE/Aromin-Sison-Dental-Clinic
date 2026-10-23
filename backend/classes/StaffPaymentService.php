<?php
namespace ASDC;

/** Direct clinic collections; patient submissions and historical reviews stay retired. */
class StaffPaymentService
{
    public static function accounts(?int $patientId = null, bool $includeSettled = false): array
    {
        PaymentApprovalService::ensureGeneralTreatmentBillingTables();
        $accounts = [];
        foreach (['C' => ['braces_contracts', 'contract_id', 'contract_payments', "'Braces Treatment Plan'"],
                  'T' => ['treatment_bills', 'bill_id', 'treatment_payments', 'b.service_treatment']] as $type => $config) {
            [$table, $key, $payments, $service] = $config;
            $filter = $includeSettled ? '' : " AND b.status='active' AND b.balance_amount>0";
            if ($patientId !== null) $filter .= ' AND p.patient_id=?';
            $stmt = Database::pdo()->prepare("SELECT b.$key AS account_id, p.patient_id,
                CONCAT(p.first_name, ' ', p.last_name) AS patient, $service AS service,
                b.total_amount, b.balance_amount, b.status,
                COALESCE((SELECT SUM(amount_paid) FROM $payments WHERE $key=b.$key AND status='approved'),0) AS paid_amount,
                COALESCE((SELECT SUM(amount_paid) FROM $payments WHERE $key=b.$key AND status='pending'),0) AS pending_amount
                FROM $table b JOIN patients p ON p.patient_id=b.patient_id
                WHERE p.archived_at IS NULL $filter
                ORDER BY p.last_name, p.first_name, b.$key DESC");
            $stmt->execute($patientId !== null ? [$patientId] : []);
            $rows = $stmt->fetchAll();
            foreach ($rows as $row) {
                $row['id'] = $type . '-' . $row['account_id'];
                $row['available_amount'] = max(0, round((float)$row['balance_amount'] - (float)$row['pending_amount'], 2));
                $accounts[] = $row;
            }
        }
        return $accounts;
    }

    public static function patientSummaries(): array
    {
        $patients = [];
        foreach (Database::pdo()->query("SELECT patient_id, CONCAT(first_name, ' ', last_name) AS patient FROM patients WHERE archived_at IS NULL ORDER BY last_name, first_name")->fetchAll() as $patient) {
            $id = (int)$patient['patient_id'];
            $patients[$id] = ['patient_id'=>$id, 'patient'=>$patient['patient'], 'paid_amount'=>0, 'balance_amount'=>0, 'pending_amount'=>0, 'accounts'=>0];
        }
        foreach (self::accounts(null, true) as $account) {
            $id = (int)$account['patient_id'];
            if (!isset($patients[$id])) $patients[$id] = ['patient_id'=>$id, 'patient'=>$account['patient'], 'paid_amount'=>0, 'balance_amount'=>0, 'pending_amount'=>0, 'accounts'=>0];
            $patients[$id]['paid_amount'] += (float)$account['paid_amount'];
            $patients[$id]['pending_amount'] += (float)$account['pending_amount'];
            if ($account['status'] !== 'cancelled') $patients[$id]['balance_amount'] += max(0, (float)$account['balance_amount']);
            $patients[$id]['accounts']++;
        }
        return array_values($patients);
    }

    public static function patientBilling(int $patientId): array
    {
        $stmt = Database::pdo()->prepare('SELECT patient_id, first_name, last_name, contact_number, email, registered_at, is_active FROM patients WHERE patient_id=? AND archived_at IS NULL');
        $stmt->execute([$patientId]);
        $patient = $stmt->fetch();
        if (!$patient) ApiResponse::error(404, 'not_found', 'Patient not found.');
        return ['patient'=>$patient, 'accounts'=>self::accounts($patientId, true), 'payments'=>PaymentApprovalService::listForPatient($patientId)];
    }

    public static function record(array $data): array
    {
        AuthMiddleware::requireRole('receptionist', 'dentist');
        $account = $data['account_id'] ?? '';
        if (!is_string($account) || !preg_match('/^([CT])-([1-9][0-9]*)$/D', $account, $match)) {
            throw new \InvalidArgumentException('Select a valid billing account.');
        }
        $raw = $data['amount'] ?? '';
        if (!is_scalar($raw) || !preg_match('/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/D', (string)$raw) || (float)$raw <= 0) {
            throw new \InvalidArgumentException('Enter a positive amount with at most two decimal places.');
        }
        $cents = (int)round((float)$raw * 100);
        $method = $data['payment_method'] ?? '';
        if (!in_array($method, ['cash', 'card', 'gcash', 'bank_transfer', 'other'], true)) {
            throw new \InvalidArgumentException('Select a valid payment method.');
        }
        $date = $data['payment_date'] ?? '';
        $parsed = is_string($date) ? \DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;
        if (!$parsed || $parsed->format('Y-m-d') !== $date || $date > date('Y-m-d')) {
            throw new \InvalidArgumentException('Enter a valid payment date that is not in the future.');
        }
        $note = $data['note'] ?? '';
        if (!is_string($note) || strlen(trim($note)) > 255) {
            throw new \InvalidArgumentException('Notes must be 255 bytes or fewer.');
        }
        PaymentApprovalService::ensureGeneralTreatmentBillingTables();
        $braces = $match[1] === 'C';
        $table = $braces ? 'braces_contracts' : 'treatment_bills';
        $key = $braces ? 'contract_id' : 'bill_id';
        $payments = $braces ? 'contract_payments' : 'treatment_payments';
        $id = (int)$match[2];
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT b.* FROM $table b JOIN patients p ON p.patient_id=b.patient_id
                WHERE b.$key=? AND p.archived_at IS NULL FOR UPDATE");
            $stmt->execute([$id]);
            $bill = $stmt->fetch();
            if (!$bill || $bill['status'] !== 'active') throw new \DomainException('This billing account is no longer active. Refresh the accounts.');
            if (isset($data['patient_id']) && (int)$data['patient_id'] !== (int)$bill['patient_id']) throw new \DomainException('The selected billing account does not belong to this patient.');
            $stmt = $pdo->prepare("SELECT amount_paid FROM $payments WHERE $key=? AND status='pending' FOR UPDATE");
            $stmt->execute([$id]);
            $pending = 0;
            foreach ($stmt->fetchAll() as $row) $pending += (int)round((float)$row['amount_paid'] * 100);
            $balance = (int)round((float)$bill['balance_amount'] * 100);
            if ($cents > $balance - $pending) throw new \DomainException('Payment exceeds the available balance after pending payments. Refresh the accounts.');
            $staff = (int)$_SESSION['user_id'];
            $stmt = $pdo->prepare("INSERT INTO $payments ($key, amount_paid, payment_date, payment_method, status, note, submitted_by, reviewed_by, reviewed_at)
                VALUES (?, ?, ?, ?, 'approved', ?, ?, ?, NOW())");
            $stmt->execute([$id, $cents / 100, $date, $method, trim($note), $staff, $staff]);
            $paymentId = (int)$pdo->lastInsertId();
            $reference = 'OR-' . date('Ymd') . '-' . $match[1] . $paymentId;
            $pdo->prepare("UPDATE $payments SET or_number=? WHERE payment_id=?")->execute([$reference, $paymentId]);
            $remaining = ($balance - $cents) / 100;
            $status = $remaining <= 0 ? ($braces ? 'completed' : 'paid') : 'active';
            $pdo->prepare("UPDATE $table SET balance_amount=?, status=? WHERE $key=?")->execute([$remaining, $status, $id]);
            $pdo->commit();
            return ['id' => $match[1] . '-' . $paymentId, 'orNumber' => $reference, 'balance_amount' => $remaining];
        } catch (\Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
}
