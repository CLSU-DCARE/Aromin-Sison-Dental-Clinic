<?php
/**
 * Braces & contract information service: Aromin-Sison Dental Clinic System.
 *
 * Patient-facing: returns braces progress, contract summary, and payment history.
 *
 * Usage:
 *   $data = BracesService::getBracesData($patientId);
 */

namespace ASDC;

use DateTime;
use PDO;
use PDOException;

class BracesService
{
    /**
     * Get all braces/contract data for a patient.
     *
     * @return array{
     *   has_braces_treatment: bool,
     *   has_contract: bool,
     *   has_outstanding_balance: bool,
     *   completed_visits: int,
     *   treatment_records: int,
     *   braces_progress: string,
     *   outstanding_balance: string,
     *   braces: array,
     *   contract: array
     * }
     */
    public static function getBracesData(int $patientId): array
    {
        $pdo = Database::pdo();

        // Completed visits count
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM appointments WHERE patient_id = ? AND status = 'completed'"
        );
        $stmt->execute([$patientId]);
        $completedVisits = (int) $stmt->fetchColumn();

        // Treatment records count
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM treatment_records WHERE patient_id = ?');
        $stmt->execute([$patientId]);
        $treatmentRecords = (int) $stmt->fetchColumn();

        // Has braces booking?
        $stmt = $pdo->prepare(
            "SELECT 1 FROM appointments
             WHERE patient_id = ?
               AND LOWER(service_type) LIKE '%braces%'
               AND status IN ('pending', 'confirmed', 'completed')
             LIMIT 1"
        );
        $stmt->execute([$patientId]);
        $hasBracesBooking = (bool) $stmt->fetchColumn();

        // Next braces appointment
        $stmt = $pdo->prepare(
            "SELECT scheduled_date, scheduled_time FROM appointments
             WHERE patient_id = ?
               AND LOWER(service_type) LIKE '%braces%'
               AND status IN ('pending', 'confirmed')
               AND (scheduled_date > CURRENT_DATE()
                    OR (scheduled_date = CURRENT_DATE() AND scheduled_time >= CURRENT_TIME()))
             ORDER BY scheduled_date ASC, scheduled_time ASC
             LIMIT 1"
        );
        $stmt->execute([$patientId]);
        $nextAppointment = $stmt->fetch();

        // Contract
        $stmt = $pdo->prepare(
            "SELECT c.contract_id, c.total_amount, c.balance_amount, c.duration_months,
                    c.start_date, c.estimated_completion_date, c.status,
                    c.dentist_id, c.current_stage, c.progress_pct, c.progress_note,
                    c.next_note, c.progress_updated_at,
                    du.full_name AS dentist_name
             FROM braces_contracts c
             LEFT JOIN users du ON du.user_id = c.dentist_id
             WHERE c.patient_id = ? AND c.status <> 'cancelled'
             ORDER BY (c.status = 'active') DESC, c.contract_id DESC
             LIMIT 1"
        );
        $stmt->execute([$patientId]);
        $contractRow = $stmt->fetch();

        $hasContract = (bool) $contractRow;
        $hasBracesTreatment = $hasBracesBooking || $hasContract;
        $balance = $contractRow ? max(0, (float) $contractRow['balance_amount']) : 0;
        $hasOutstandingBalance = $balance > 0;

        // Progress calculation. A dentist's own update (once they've ever
        // used "Update Progress") always takes priority over the plain
        // elapsed-time estimate below — that estimate only exists so a
        // brand new contract still shows *something* reasonable before any
        // dentist has actually touched it.
        $dentistSet = $contractRow && !empty($contractRow['progress_updated_at']);

        $bracesProgress = 0;
        $elapsedMonths  = 0;
        $durationMonths = 0;

        if ($contractRow) {
            $durationMonths = max(1, (int) $contractRow['duration_months']);
            $start = DateTime::createFromFormat('Y-m-d', $contractRow['start_date']);
            $today = new DateTime('today');

            if ($start && $start <= $today) {
                $diff = $start->diff($today);
                $elapsedMonths = ($diff->y * 12) + $diff->m + 1;
                $elapsedMonths = min($durationMonths, max(1, $elapsedMonths));
            }

            $bracesProgress = (int) round(($elapsedMonths / $durationMonths) * 100);
            $bracesProgress = min(100, max(0, $bracesProgress));
        }

        if ($dentistSet) {
            $bracesProgress = (int) $contractRow['progress_pct'];
        }

        // Braces heading/description/label
        if ($dentistSet) {
            $bracesHeading     = $bracesProgress >= 100 ? 'Treatment complete' : 'Your treatment is progressing well';
            $bracesDescription = $contractRow['progress_note'] ?: 'Your dentist updated your treatment progress.';
            $monthLabel        = $contractRow['current_stage'];
        } elseif ($contractRow) {
            $bracesHeading     = $contractRow['status'] === 'active'
                ? 'Your braces treatment is in progress'
                : 'Your braces treatment is ' . ucfirst($contractRow['status']);
            $bracesDescription = 'Progress is based on your treatment start date and contract duration.';
            $monthLabel        = $elapsedMonths > 0
                ? 'MONTH ' . $elapsedMonths . '/' . $durationMonths
                : 'NOT STARTED';
        } elseif ($hasBracesBooking) {
            $bracesHeading     = 'Braces appointment booked';
            $bracesDescription = 'Treatment progress will begin after the clinic creates your braces contract.';
            $monthLabel        = 'NOT STARTED';
        } else {
            $bracesHeading     = 'No braces treatment yet';
            $bracesDescription = 'Your progress will appear after you book a braces service.';
            $monthLabel        = 'NOT STARTED';
        }

        // Stages: once a dentist has set a stage, show the full named
        // sequence (done/active/upcoming) they're actually walking the
        // patient through; otherwise fall back to a single generic entry.
        $stages = [];
        if ($dentistSet) {
            $stageIdx = array_search($contractRow['current_stage'], ContractService::STAGE_ORDER, true);
            if ($stageIdx === false) $stageIdx = 0;
            foreach (ContractService::STAGE_ORDER as $i => $name) {
                $kind = $i < $stageIdx ? 'done' : ($i === $stageIdx ? 'active' : 'upcoming');
                $stages[] = [
                    'kind' => $kind,
                    'num'  => (string) ($i + 1),
                    'name' => $name,
                    'date' => $kind === 'done' ? 'Complete' : ($kind === 'active' ? 'Ongoing' : 'Upcoming'),
                ];
            }
        } elseif ($contractRow) {
            $stages[] = [
                'kind' => $contractRow['status'] === 'active' ? 'current' : 'done',
                'num'  => $contractRow['status'] === 'active' ? (string) max(1, $elapsedMonths) : null,
                'name' => $contractRow['status'] === 'active'
                    ? 'Active braces treatment'
                    : 'Braces treatment ' . ucfirst($contractRow['status']),
                'date' => 'Started: ' . self::fmtDate($contractRow['start_date']),
            ];
        }

        // Next label — a dentist's own note takes priority over the
        // system's next-scheduled-appointment guess.
        $nextLabel = 'No upcoming braces appointment.';
        if ($nextAppointment) {
            $nextLabel = 'Next braces appointment: '
                . self::fmtDate($nextAppointment['scheduled_date'])
                . ' at '
                . self::fmtTime($nextAppointment['scheduled_time']);
        }
        if ($dentistSet && $contractRow['next_note']) {
            $nextLabel = $contractRow['next_note'];
        }

        // Contract + payments
        $payments = [];
        $contract = [
            'active'   => false,
            'summary'  => [],
            'progress' => ['width' => '0%', 'left' => 'No active contract', 'right' => '0% Paid'],
            'payments' => [],
        ];

        if ($contractRow) {
            $total  = max(0, (float) $contractRow['total_amount']);
            $paid   = max(0, $total - $balance);
            $pct    = $total > 0 ? (int) round(($paid / $total) * 100) : 0;
            $pct    = min(100, max(0, $pct));

            // Includes pending/rejected submissions too (not just approved
            // ones) so the patient can see "Pending Confirmation" for a
            // receipt they just submitted, not just settled payments.
            $payStmt = $pdo->prepare(
                "SELECT payment_date, amount_paid, payment_method, or_number, status, created_at
                 FROM contract_payments
                 WHERE contract_id = ?
                 ORDER BY created_at DESC, payment_id DESC"
            );
            $payStmt->execute([(int) $contractRow['contract_id']]);

            foreach ($payStmt->fetchAll() as $pay) {
                $payments[] = [
                    'date'   => $pay['status'] === 'pending' ? self::fmtDate(substr($pay['created_at'], 0, 10)) : self::fmtDate($pay['payment_date']),
                    'amount' => self::fmtMoney((float) $pay['amount_paid']),
                    'method' => ucwords(str_replace('_', ' ', $pay['payment_method'])),
                    'or'     => $pay['or_number'] ?: '—',
                    'status' => $pay['status'],
                ];
            }
            $approvedCount = count(array_filter($payments, fn($pay) => ($pay['status'] ?? '') === 'approved'));
            $dueDate = self::nextDueDate($contractRow['start_date'], (int) $contractRow['duration_months'], $approvedCount, $balance);

            $summary = [
                ['v' => self::fmtMoney($total), 'l' => 'Total Contract Amount'],
                ['v' => self::fmtMoney($balance), 'l' => 'Remaining Balance'],
                ['v' => $dueDate, 'l' => 'Due Date'],
            ];

            $contract = [
                'active'  => true,
                'summary' => $summary,
                'progress' => [
                    'width' => $pct . '%',
                    'left'  => self::fmtMoney($paid) . ' paid',
                    'right' => $pct . '% Paid',
                ],
                'payments' => $payments,
            ];
        }

        return [
            'has_braces_treatment' => $hasBracesTreatment,
            'has_contract'         => $hasContract,
            'has_outstanding_balance' => $hasOutstandingBalance,
            'completed_visits'     => $completedVisits,
            'treatment_records'    => $treatmentRecords,
            'braces_progress'      => $bracesProgress . '%',
            'outstanding_balance'  => self::fmtMoney($balance),
            'braces' => [
                'active'      => $hasBracesTreatment,
                'pct'         => $bracesProgress . '%',
                'monthLabel'  => $monthLabel,
                'ringOffset'  => (string) round(377 - (377 * $bracesProgress / 100), 1),
                'heading'     => $bracesHeading,
                'description' => $bracesDescription,
                'stages'      => $stages,
                'next'        => $nextLabel,
            ],
            'contract' => $contract,
        ];
    }

    /* ------------------------------------------------------------------
     *  Private helpers
     * ----------------------------------------------------------------*/

    private static function fmtMoney(float $amount): string
    {
        return '₱' . number_format($amount, 2);
    }

    private static function fmtDate(?string $value): string
    {
        if (!$value) return '—';
        $date = DateTime::createFromFormat('Y-m-d', $value);
        return $date ? $date->format('M j, Y') : $value;
    }

    private static function fmtTime(?string $value): string
    {
        if (!$value) return '';
        $time = DateTime::createFromFormat('H:i:s', $value);
        return $time ? $time->format('g:i A') : $value;
    }

    private static function nextDueDate(string $startDate, int $durationMonths, int $approvedPayments, float $balance): string
    {
        if ($balance <= 0) return 'Fully paid';
        $start = DateTime::createFromFormat('Y-m-d', $startDate);
        if (!$start) return 'Not set';
        $monthIndex = min(max(1, $approvedPayments + 1), max(1, $durationMonths));
        $due = clone $start;
        $due->modify('+' . $monthIndex . ' months');
        return self::fmtDate($due->format('Y-m-d'));
    }
}
