<?php
/**
 * Daily patient reminder service.
 *
 * Sends one-day-ahead appointment and balance reminders. The notification log
 * is used as the idempotency marker, so running maintenance more than once on
 * the same day will not resend the same reminder.
 */

namespace ASDC;

class ReminderService
{
    public static function sendDailyReminders(): array
    {
        return [
            'appointments' => self::sendAppointmentReminders(),
            'balances' => self::sendBalanceReminders(),
        ];
    }

    private static function sendAppointmentReminders(): array
    {
        $pdo = Database::pdo();
        $targetDate = (new \DateTimeImmutable('tomorrow'))->format('Y-m-d');
        $stmt = $pdo->prepare(
            "SELECT a.appointment_id, a.patient_id, a.service_type, a.scheduled_date, a.scheduled_time,
                    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                    d.full_name AS dentist_name
             FROM appointments a
             JOIN patients p ON p.patient_id = a.patient_id
             LEFT JOIN dentists d ON d.dentist_id = a.dentist_id
             WHERE a.scheduled_date = ?
               AND a.status IN ('pending', 'confirmed')
               AND p.archived_at IS NULL
             ORDER BY a.scheduled_time ASC, a.appointment_id ASC"
        );
        $stmt->execute([$targetDate]);

        $sent = 0;
        $failed = 0;
        $skipped = 0;
        $errors = [];
        foreach ($stmt->fetchAll() as $row) {
            if (self::alreadyLogged('appointment_reminder_patient', (int) $row['patient_id'], (int) $row['appointment_id'])) {
                $skipped++;
                continue;
            }

            $replacements = [
                'appointment_id' => '#A-' . $row['appointment_id'],
                'service' => $row['service_type'] ?: 'Dental Appointment',
                'appointment_date' => self::fmtDate($row['scheduled_date']),
                'appointment_time' => self::fmtTime($row['scheduled_time']),
                'date' => self::fmtDate($row['scheduled_date']),
                'time' => self::fmtTime($row['scheduled_time']),
                'dentist_name' => $row['dentist_name'] ?: 'To be assigned',
                'dentist' => $row['dentist_name'] ?: 'To be assigned',
            ];
            $result = NotificationSendService::send((int) $row['patient_id'], [
                'template_key' => 'appointment_reminder_patient',
                'replacements' => $replacements,
                'appointment_id' => (int) $row['appointment_id'],
            ]);
            if (self::hasSuccessfulEmail($result)) {
                $sent++;
            } else {
                $failed++;
                $errors[] = self::sendError($result, (int) $row['patient_id']);
            }
            PortalEvent::patient(
                (int) $row['patient_id'],
                'Appointment Reminder',
                implode("\n", [
                    'You have an upcoming appointment tomorrow.',
                    'Service: ' . $replacements['service'],
                    'Date: ' . $replacements['appointment_date'],
                    'Time: ' . $replacements['appointment_time'],
                    'Dentist: ' . $replacements['dentist_name'],
                ]),
                'appt',
                true
            );
        }

        return ['target_date' => $targetDate, 'sent' => $sent, 'failed' => $failed, 'skipped' => $skipped, 'errors' => $errors];
    }

    private static function sendBalanceReminders(): array
    {
        $pdo = Database::pdo();
        $targetDate = (new \DateTimeImmutable('tomorrow'))->format('Y-m-d');
        $stmt = $pdo->query(
            "SELECT c.contract_id, c.patient_id, c.total_amount, c.balance_amount, c.monthly_payment,
                    c.duration_months, c.start_date, p.first_name, p.last_name, p.contact_number, p.email
             FROM braces_contracts c
             JOIN patients p ON p.patient_id = c.patient_id
             WHERE c.status = 'active'
               AND c.balance_amount > 0
               AND p.archived_at IS NULL
             ORDER BY c.contract_id ASC"
        );

        $sent = 0;
        $failed = 0;
        $skipped = 0;
        $errors = [];
        foreach ($stmt->fetchAll() as $row) {
            $due = self::contractDueDate($row);
            if ($due !== $targetDate) {
                continue;
            }
            if (self::alreadyLogged('balance_due_reminder_patient', (int) $row['patient_id'])) {
                $skipped++;
                continue;
            }

            $total = (float) $row['total_amount'];
            $balance = max(0, (float) $row['balance_amount']);
            $paid = max(0, $total - $balance);
            $amountDue = min(max(0, (float) $row['monthly_payment']), $balance);
            if ($amountDue <= 0) $amountDue = $balance;
            $patientName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
            $replacements = [
                'patient_id' => '#P-' . $row['patient_id'],
                'patient_name' => $patientName,
                'service_treatment' => 'Braces Treatment Plan',
                'payment_amount' => self::fmtMoney($amountDue),
                'total_amount' => self::fmtMoney($total),
                'amount_paid' => self::fmtMoney($paid),
                'remaining_balance' => self::fmtMoney($balance),
                'amount' => self::fmtMoney($amountDue),
                'balance' => self::fmtMoney($balance),
                'due_date' => self::fmtDate($due),
                'contact_number' => $row['contact_number'] ?: 'Not provided',
                'email' => $row['email'] ?: 'Not provided',
            ];
            $result = NotificationSendService::send((int) $row['patient_id'], [
                'template_key' => 'balance_due_reminder_patient',
                'replacements' => $replacements,
            ]);
            if (self::hasSuccessfulEmail($result)) {
                $sent++;
            } else {
                $failed++;
                $errors[] = self::sendError($result, (int) $row['patient_id']);
            }
            PortalEvent::patient(
                (int) $row['patient_id'],
                'Balance Due Reminder',
                implode("\n", [
                    'Your next balance payment is due tomorrow.',
                    'Service/Treatment: Braces Treatment Plan',
                    'Due Date: ' . $replacements['due_date'],
                    'Amount Due: ' . $replacements['payment_amount'],
                    'Remaining Balance: ' . $replacements['remaining_balance'],
                ]),
                'pay',
                true
            );
        }

        return ['target_date' => $targetDate, 'sent' => $sent, 'failed' => $failed, 'skipped' => $skipped, 'errors' => $errors];
    }

    private static function hasSuccessfulEmail(array $result): bool
    {
        foreach (($result['results'] ?? []) as $row) {
            if (($row['channel'] ?? '') === 'email' && ($row['status'] ?? '') === 'sent') {
                return true;
            }
        }
        return false;
    }

    private static function sendError(array $result, int $patientId): array
    {
        $error = $result['error'] ?? null;
        foreach (($result['results'] ?? []) as $row) {
            if (($row['channel'] ?? '') === 'email' && !empty($row['error'])) {
                $error = $row['error'];
                break;
            }
        }
        return [
            'patient_id' => $patientId,
            'error' => $error ?: 'Email delivery failed.',
        ];
    }

    private static function alreadyLogged(string $templateKey, int $patientId, ?int $appointmentId = null): bool
    {
        $sql = "SELECT 1
                FROM notification_logs nl
                JOIN notification_templates nt ON nt.template_id = nl.template_id
                WHERE nt.template_key = ?
                  AND nl.patient_id = ?
                  AND DATE(nl.sent_at) = CURRENT_DATE()";
        $params = [$templateKey, $patientId];
        if ($appointmentId !== null) {
            $sql .= ' AND nl.appointment_id = ?';
            $params[] = $appointmentId;
        }
        $sql .= ' LIMIT 1';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return (bool) $stmt->fetchColumn();
    }

    private static function contractDueDate(array $row): ?string
    {
        $start = \DateTimeImmutable::createFromFormat('Y-m-d', (string) ($row['start_date'] ?? ''));
        if (!$start) return null;

        $monthly = max(0, (float) ($row['monthly_payment'] ?? 0));
        $total = max(0, (float) ($row['total_amount'] ?? 0));
        $balance = max(0, (float) ($row['balance_amount'] ?? 0));
        $paid = max(0, $total - $balance);
        $duration = max(1, (int) ($row['duration_months'] ?? 1));
        $coveredMonths = $monthly > 0 ? (int) floor($paid / $monthly) : 0;
        $monthIndex = min(max(1, $coveredMonths + 1), $duration);

        return $start->modify('+' . $monthIndex . ' months')->format('Y-m-d');
    }

    private static function fmtDate(?string $value): string
    {
        if (!$value) return 'Not set';
        $date = \DateTimeImmutable::createFromFormat('Y-m-d', $value);
        return $date ? $date->format('M j, Y') : $value;
    }

    private static function fmtTime(?string $value): string
    {
        if (!$value) return 'Not set';
        $time = \DateTimeImmutable::createFromFormat('H:i:s', (string) $value);
        if (!$time) $time = \DateTimeImmutable::createFromFormat('H:i', (string) $value);
        return $time ? $time->format('g:i A') : (string) $value;
    }

    private static function fmtMoney(float $amount): string
    {
        return 'PHP ' . number_format($amount, 2);
    }
}
