<?php
/**
 * GET /backend/api/patients/braces.php
 *
 * Returns braces and balance information for the authenticated patient only.
 */

require_once __DIR__ . '/../../config/auth.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../../config/db.php';
require_role('patient');

function braces_fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

function braces_money(float $amount): string
{
    return '₱' . number_format($amount, 2);
}

function braces_date(?string $value): string
{
    if (!$value) {
        return '—';
    }

    $date = DateTime::createFromFormat('Y-m-d', $value);
    return $date ? $date->format('M j, Y') : $value;
}

function braces_time(?string $value): string
{
    if (!$value) {
        return '';
    }

    $time = DateTime::createFromFormat('H:i:s', $value);
    return $time ? $time->format('g:i A') : $value;
}

try {
    $patientStmt = $pdo->prepare('SELECT patient_id FROM patients WHERE user_id = ? LIMIT 1');
    $patientStmt->execute([$_SESSION['user_id']]);
    $patient = $patientStmt->fetch();

    if (!$patient) {
        braces_fail(404, 'No patient profile is linked to this account.');
    }

    $patientId = (int) $patient['patient_id'];

    $completedStmt = $pdo->prepare("\n        SELECT COUNT(*)\n        FROM appointments\n        WHERE patient_id = ?\n          AND status = 'completed'\n    ");
    $completedStmt->execute([$patientId]);
    $completedVisits = (int) $completedStmt->fetchColumn();

    $recordsStmt = $pdo->prepare('SELECT COUNT(*) FROM treatment_records WHERE patient_id = ?');
    $recordsStmt->execute([$patientId]);
    $treatmentRecords = (int) $recordsStmt->fetchColumn();

    $bookingStmt = $pdo->prepare("\n        SELECT appointment_id\n        FROM appointments\n        WHERE patient_id = ?\n          AND LOWER(service_type) LIKE '%braces%'\n          AND status IN ('pending', 'confirmed', 'completed')\n        LIMIT 1\n    ");
    $bookingStmt->execute([$patientId]);
    $hasBracesBooking = (bool) $bookingStmt->fetch();

    $nextStmt = $pdo->prepare("\n        SELECT scheduled_date, scheduled_time\n        FROM appointments\n        WHERE patient_id = ?\n          AND LOWER(service_type) LIKE '%braces%'\n          AND status IN ('pending', 'confirmed')\n          AND (\n            scheduled_date > CURRENT_DATE()\n            OR (\n                scheduled_date = CURRENT_DATE()\n                AND scheduled_time >= CURRENT_TIME()\n            )\n          )\n        ORDER BY scheduled_date ASC, scheduled_time ASC\n        LIMIT 1\n    ");
    $nextStmt->execute([$patientId]);
    $nextAppointment = $nextStmt->fetch();

    $contractStmt = $pdo->prepare("\n        SELECT contract_id, total_amount, balance_amount, duration_months,\n               start_date, estimated_completion_date, status\n        FROM braces_contracts\n        WHERE patient_id = ?\n          AND status <> 'cancelled'\n        ORDER BY (status = 'active') DESC, contract_id DESC\n        LIMIT 1\n    ");
    $contractStmt->execute([$patientId]);
    $contractRow = $contractStmt->fetch();

    $hasContract = (bool) $contractRow;
    $hasBracesTreatment = $hasBracesBooking || $hasContract;
    $balance = $contractRow ? max(0, (float) $contractRow['balance_amount']) : 0;
    $hasOutstandingBalance = $balance > 0;

    $nextLabel = 'No upcoming braces appointment.';
    if ($nextAppointment) {
        $nextLabel = 'Next braces appointment: '
            . braces_date($nextAppointment['scheduled_date'])
            . ' at '
            . braces_time($nextAppointment['scheduled_time']);
    }

    $bracesProgress = 0;
    $elapsedMonths = 0;
    $durationMonths = 0;

    if ($contractRow) {
        $durationMonths = max(1, (int) $contractRow['duration_months']);
        $start = DateTime::createFromFormat('Y-m-d', $contractRow['start_date']);
        $today = new DateTime('today');

        if ($start && $start <= $today) {
            $difference = $start->diff($today);
            $elapsedMonths = ($difference->y * 12) + $difference->m + 1;
            $elapsedMonths = min($durationMonths, max(1, $elapsedMonths));
        }

        $bracesProgress = (int) round(($elapsedMonths / $durationMonths) * 100);
        $bracesProgress = min(100, max(0, $bracesProgress));
    }

    if ($contractRow) {
        $bracesHeading = $contractRow['status'] === 'active'
            ? 'Your braces treatment is in progress'
            : 'Your braces treatment is ' . ucfirst($contractRow['status']);
        $bracesDescription = 'Progress is based on your treatment start date and contract duration.';
        $monthLabel = $elapsedMonths > 0
            ? 'MONTH ' . $elapsedMonths . '/' . $durationMonths
            : 'NOT STARTED';
    } elseif ($hasBracesBooking) {
        $bracesHeading = 'Braces appointment booked';
        $bracesDescription = 'Treatment progress will begin after the clinic creates your braces contract.';
        $monthLabel = 'NOT STARTED';
    } else {
        $bracesHeading = 'No braces treatment yet';
        $bracesDescription = 'Your progress will appear after you book a braces service.';
        $monthLabel = 'NOT STARTED';
    }

    $stages = [];
    if ($contractRow) {
        $stages[] = [
            'kind' => $contractRow['status'] === 'active' ? 'current' : 'done',
            'num' => $contractRow['status'] === 'active' ? (string) max(1, $elapsedMonths) : null,
            'name' => $contractRow['status'] === 'active'
                ? 'Active braces treatment'
                : 'Braces treatment ' . ucfirst($contractRow['status']),
            'date' => 'Started: ' . braces_date($contractRow['start_date']),
        ];
    }

    $payments = [];
    $paymentProgress = 0;
    $contract = [
        'active' => false,
        'summary' => [],
        'progress' => [
            'width' => '0%',
            'left' => 'No active contract',
            'right' => '0% Paid',
        ],
        'payments' => [],
    ];

    if ($contractRow) {
        $total = max(0, (float) $contractRow['total_amount']);
        $paid = max(0, $total - $balance);
        $paymentProgress = $total > 0
            ? (int) round(($paid / $total) * 100)
            : 0;
        $paymentProgress = min(100, max(0, $paymentProgress));

        $paymentsStmt = $pdo->prepare("\n            SELECT payment_date, amount_paid, payment_method, or_number\n            FROM contract_payments\n            WHERE contract_id = ?\n            ORDER BY payment_date DESC, payment_id DESC\n        ");
        $paymentsStmt->execute([(int) $contractRow['contract_id']]);

        foreach ($paymentsStmt->fetchAll() as $payment) {
            $payments[] = [
                'date' => braces_date($payment['payment_date']),
                'amount' => braces_money((float) $payment['amount_paid']),
                'method' => ucwords(str_replace('_', ' ', $payment['payment_method'])),
                'or' => $payment['or_number'] ?: '—',
            ];
        }

        $contract = [
            'active' => true,
            'summary' => [
                ['v' => braces_money($total), 'l' => 'Total Contract Amount'],
                ['v' => braces_money($balance), 'l' => 'Remaining Balance'],
                ['v' => braces_date($contractRow['start_date']), 'l' => 'Contract Start Date'],
            ],
            'progress' => [
                'width' => $paymentProgress . '%',
                'left' => braces_money($paid) . ' paid',
                'right' => $paymentProgress . '% Paid',
            ],
            'payments' => $payments,
        ];
    }

    echo json_encode([
        'success' => true,
        'has_braces_treatment' => $hasBracesTreatment,
        'has_contract' => $hasContract,
        'has_outstanding_balance' => $hasOutstandingBalance,
        'completed_visits' => $completedVisits,
        'treatment_records' => $treatmentRecords,
        'braces_progress' => $bracesProgress . '%',
        'outstanding_balance' => braces_money($balance),
        'braces' => [
            'active' => $hasBracesTreatment,
            'pct' => $bracesProgress . '%',
            'monthLabel' => $monthLabel,
            'ringOffset' => (string) round(377 - (377 * $bracesProgress / 100), 1),
            'heading' => $bracesHeading,
            'description' => $bracesDescription,
            'stages' => $stages,
            'next' => $nextLabel,
        ],
        'contract' => $contract,
    ]);
} catch (PDOException $error) {
    error_log('Patient braces load failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to load braces information.']);
}
