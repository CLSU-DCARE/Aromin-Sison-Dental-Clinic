<?php
/**
 * Braces contract management service: Aromin-Sison Dental Clinic System.
 *
 * Receptionist-facing: create/edit contracts and list all. Dentist-facing:
 * update treatment progress across clinic contracts through the shared account.
 * contracts. Used by backend/api/admin/contracts.php and
 * backend/api/dentist/progress.php.
 *
 * Usage:
 *   $rows = ContractService::listAll(DataScope::current());
 *   $row  = ContractService::create($data);
 *   $row  = ContractService::update($id, $data);
 *   $row  = ContractService::updateProgress($id, $data, DataScope::current());
 */

namespace ASDC;

use PDO;

class ContractService
{
    /** Fixed treatment-stage sequence a dentist walks a patient through.
     *  Shared with BracesService so the patient-facing stage list and the
     *  dentist's own stage picker always agree. */
    public const STAGE_ORDER = [
        'Consultation & Records',
        'Braces Placement',
        'Adjustment Phase',
        'Retainer Fitting',
        'Debonding & Retention',
    ];

    /**
     * List contracts for the Admin/Dentist "Patients"/"Braces Contracts"
     * tables. Both staff roles see clinic-wide contracts.
     */
    public static function listAll(DataScope $scope): array
    {
        [$where, $params] = $scope->contractFilter();

        $stmt = Database::pdo()->prepare(
            "SELECT c.contract_id, c.patient_id, c.dentist_id,
                    c.total_amount, c.downpayment, c.monthly_payment, c.balance_amount,
                    c.duration_months, c.start_date, c.estimated_completion_date, c.status,
                    c.current_stage, c.progress_pct, c.progress_note, c.next_note, c.progress_updated_at,
                    COALESCE(pay.approved_total, 0) AS approved_payment_total,
                    p.first_name, p.last_name,
                    du.full_name AS dentist_name
             FROM braces_contracts c
             JOIN patients p ON p.patient_id = c.patient_id
             LEFT JOIN dentists du ON du.dentist_id = c.dentist_id
             LEFT JOIN (
                SELECT contract_id, SUM(amount_paid) AS approved_total
                FROM contract_payments
                WHERE status = 'approved'
                GROUP BY contract_id
             ) pay ON pay.contract_id = c.contract_id
             WHERE {$where}
             ORDER BY (c.status = 'active') DESC, c.contract_id DESC"
        );
        $stmt->execute($params);
        return array_map([self::class, 'present'], $stmt->fetchAll());
    }

    public static function findRaw(int $contractId): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM braces_contracts WHERE contract_id = ? LIMIT 1');
        $stmt->execute([$contractId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Create a new contract. $data must already be validated by the caller.
     */
    public static function create(array $data): array
    {
        $total   = (float) $data['total_amount'];
        $down    = (float) ($data['downpayment'] ?? 0);
        $monthly = (float) $data['monthly_payment'];
        $months  = (int) $data['duration_months'];
        $balance = max(0, $total - $down);

        $start = $data['start_date'] ?: date('Y-m-d');
        $estCompletion = date('Y-m-d', strtotime($start . " + {$months} months"));

        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
        $stmt = $pdo->prepare(
            'INSERT INTO braces_contracts
                (patient_id, dentist_id, total_amount, downpayment, monthly_payment,
                 balance_amount, duration_months, start_date, estimated_completion_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['patient_id'], $data['dentist_id'] ?: null,
            $total, $down, $monthly, $balance, $months,
            $start, $estCompletion, $data['status'] ?? 'active',
        ]);

        $result = self::present(self::findRaw((int) $pdo->lastInsertId()) + self::patientNames((int) $data['patient_id']) + ['dentist_name' => self::dentistName($data['dentist_id'] ?: null)]);
        PortalEvent::patient((int) $data['patient_id'], 'Billing contract created', 'Your braces contract is available.', 'contract');
        $pdo->commit();
        return $result;
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }

    /**
     * Update an existing contract's terms. Preserves however much has
     * already been paid when the total amount changes, instead of
     * silently resetting the balance.
     */
    public static function update(int $contractId, array $data): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
        $locked = $pdo->prepare(
            'SELECT c.* FROM braces_contracts c
              JOIN patients p ON p.patient_id=c.patient_id
             WHERE c.contract_id=? AND p.archived_at IS NULL
             FOR UPDATE'
        );
        $locked->execute([$contractId]);
        $existing = $locked->fetch();
        if (!$existing) {
            $pdo->rollBack();
            ApiResponse::error(404, 'not_found', 'Contract not found.');
        }

        $oldTotal = (float) $existing['total_amount'];
        $oldBalance = (float) $existing['balance_amount'];
        $paidSoFar = max(0, $oldTotal - $oldBalance);

        $total   = (float) $data['total_amount'];
        $monthly = (float) $data['monthly_payment'];
        $months  = (int) $data['duration_months'];
        $newBalance = max(0, $total - $paidSoFar);
        $status = $data['status'] ?? $existing['status'];
        // Preserve the existing dentist assignment unless a new one was
        // explicitly sent - otherwise every edit that doesn't touch the
        // dentist field would silently unassign the contract.
        $dentistId = array_key_exists('dentist_id', $data) && $data['dentist_id']
            ? $data['dentist_id']
            : $existing['dentist_id'];

        $start = $existing['start_date'];
        $estCompletion = date('Y-m-d', strtotime($start . " + {$months} months"));

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'UPDATE braces_contracts
                SET dentist_id = ?, total_amount = ?, monthly_payment = ?,
                    duration_months = ?, balance_amount = ?,
                    estimated_completion_date = ?, status = ?
              WHERE contract_id = ?'
        );
        $stmt->execute([
            $dentistId, $total, $monthly, $months,
            $newBalance, $estCompletion, $status, $contractId,
        ]);

        $result = self::present(self::findRaw($contractId) + self::patientNames((int) $existing['patient_id']) + ['dentist_name' => self::dentistName($dentistId)]);
        PortalEvent::patient((int) $existing['patient_id'], 'Billing contract updated', 'Your contract details or payment terms have changed.', 'contract');
        $pdo->commit();
        return $result;
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }

    /**
     * Dentist-side: update treatment stage/percentage/notes. Enforces that
     * dentists and receptionists can update clinic contracts.
     */
    public static function updateProgress(int $contractId, array $data, DataScope $scope): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
        $locked = $pdo->prepare(
            'SELECT c.* FROM braces_contracts c
              JOIN patients p ON p.patient_id=c.patient_id
             WHERE c.contract_id=? AND p.archived_at IS NULL
             FOR UPDATE'
        );
        $locked->execute([$contractId]);
        $existing = $locked->fetch();
        if (!$existing) {
            $pdo->rollBack();
            ApiResponse::error(404, 'not_found', 'Contract not found.');
        }
        if (!$scope->canUpdateContractProgress($existing)) {
            $pdo->rollBack();
            ApiResponse::error(403, 'forbidden', 'You do not have permission to update this contract.');
        }

        $stage = in_array($data['current_stage'], self::STAGE_ORDER, true)
            ? $data['current_stage'] : self::STAGE_ORDER[0];
        $pct = max(0, min(100, (int) $data['progress_pct']));

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'UPDATE braces_contracts
                SET current_stage = ?, progress_pct = ?, progress_note = ?, next_note = ?,
                    progress_updated_at = NOW()
              WHERE contract_id = ?'
        );
        $stmt->execute([
            $stage, $pct,
            $data['progress_note'] !== '' ? $data['progress_note'] : null,
            $data['next_note'] !== '' ? $data['next_note'] : null,
            $contractId,
        ]);

        ClinicalRecordService::recordBracesProgress(
            $pdo,
            $existing,
            $stage,
            $pct,
            $data['progress_note'] !== '' ? $data['progress_note'] : null,
            $data['next_note'] !== '' ? $data['next_note'] : null
        );
        $result = self::present(self::findRaw($contractId) + self::patientNames((int) $existing['patient_id']) + ['dentist_name' => self::dentistName($existing['dentist_id'])]);
        PortalEvent::treatmentProgress((int) $existing['patient_id'], $stage, $pct, $data['next_note'] ?? null, $data['progress_note'] ?? null);
        $pdo->commit();
        return $result;
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }

    /**
     * Applies an approved payment to a contract's balance/status. Called by
     * PaymentApprovalService when a receptionist approves a submission.
     */
    public static function applyPayment(int $contractId, float $amount): void
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT balance_amount, status FROM braces_contracts WHERE contract_id = ? FOR UPDATE');
        $stmt->execute([$contractId]);
        $row = $stmt->fetch();
        if (!$row) return;

        $newBalance = max(0, (float) $row['balance_amount'] - $amount);
        $newStatus = $row['status'];
        if ($newBalance <= 0) {
            $newStatus = 'completed';
        } elseif ($row['status'] === 'defaulted') {
            $newStatus = 'active'; // paying up clears a defaulted/overdue contract
        }

        $upd = $pdo->prepare('UPDATE braces_contracts SET balance_amount = ?, status = ? WHERE contract_id = ?');
        $upd->execute([$newBalance, $newStatus, $contractId]);
    }

    /** Finds patient_id's newest non-cancelled contract (used to resolve
     *  which contract a submitted payment belongs to). */
    public static function activeContractForPatient(int $patientId): ?array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT * FROM braces_contracts
             WHERE patient_id = ?
               AND patient_id IN (SELECT patient_id FROM patients WHERE archived_at IS NULL)
               AND status <> 'cancelled'
             ORDER BY (status = 'active') DESC, contract_id DESC
             LIMIT 1"
        );
        $stmt->execute([$patientId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /* ------------------------------------------------------------------
     *  Private helpers
     * ----------------------------------------------------------------*/

    private static function patientNames(int $patientId): array
    {
        $stmt = Database::pdo()->prepare('SELECT first_name, last_name FROM patients WHERE patient_id = ?');
        $stmt->execute([$patientId]);
        return $stmt->fetch() ?: ['first_name' => '', 'last_name' => ''];
    }

    private static function dentistName($dentistId): ?string
    {
        if (!$dentistId) return null;
        $stmt = Database::pdo()->prepare('SELECT full_name FROM dentists WHERE dentist_id = ?');
        $stmt->execute([$dentistId]);
        $name = $stmt->fetchColumn();
        return $name ?: null;
    }

    /** Shapes a raw contract row (+ joined names) into the same fields the
     *  Admin/Dentist frontend tables already render. */
    private static function present(array $row): array
    {
        $name = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        $initials = self::initials($name);
        $statusLabel = [
            'active' => 'Current', 'defaulted' => 'Overdue',
            'completed' => 'Completed', 'cancelled' => 'Cancelled',
        ][$row['status']] ?? ucfirst($row['status']);
        $tag = ['Current' => 'amber', 'Overdue' => 'red', 'Completed' => 'green', 'Cancelled' => 'red'][$statusLabel] ?? 'amber';
        $due = self::dueDateForRow($row);

        return [
            'id'        => '#B-' . $row['contract_id'],
            'contract_id' => (int) $row['contract_id'],
            'pid'       => '#P-' . $row['patient_id'],
            'patient_id' => (int) $row['patient_id'],
            'name'      => $name,
            'initials'  => $initials,
            'dentist'   => $row['dentist_name'] ?? null,
            'dentist_id' => $row['dentist_id'] ? (int) $row['dentist_id'] : null,
            'months'    => (int) $row['duration_months'],
            'monthly'   => (float) $row['monthly_payment'],
            'downpayment' => (float) ($row['downpayment'] ?? 0),
            'plan'      => $row['duration_months'] . '-month · ₱' . number_format((float) $row['monthly_payment'], 0) . '/mo',
            'total'     => (float) $row['total_amount'],
            'paid'      => max(0, (float) $row['total_amount'] - (float) $row['balance_amount']),
            'balance'   => (float) $row['balance_amount'],
            'dueDate'   => $due['date'],
            'dueStatus' => $due['status'],
            'status'    => $statusLabel,
            'status_code' => $row['status'],
            'tag'       => $tag,
            'progress'  => [
                'stage' => $row['current_stage'] ?? self::STAGE_ORDER[0],
                'pct'   => (int) ($row['progress_pct'] ?? 0),
                'note'  => $row['progress_note'] ?? '',
                'next'  => $row['next_note'] ?? '',
                'updated_at' => $row['progress_updated_at'] ?? null,
            ],
        ];
    }

    private static function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        $letters = array_map(fn ($p) => mb_strtoupper(mb_substr($p, 0, 1)), array_slice($parts, 0, 2));
        return implode('', $letters) ?: '?';
    }

    private static function dueDateForRow(array $row): array
    {
        if ((float) ($row['balance_amount'] ?? 0) <= 0 || ($row['status'] ?? '') === 'completed') {
            return ['date' => 'Fully paid', 'status' => 'paid'];
        }

        if (empty($row['start_date']) || empty($row['duration_months'])) {
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
}
