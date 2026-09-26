<?php
namespace ASDC;

class StaffDashboardService
{
    public static function snapshot(string $start): array
    {
        $scope = DataScope::current();
        $pdo = Database::pdo();
        NotificationSchema::ensureLogAppointmentColumn();
        $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $pdo->beginTransaction();
        try {
            $week = AppointmentService::getWeek($start);
            // Pending work must remain visible even when booked outside the selected week.
            [$where, $params] = $scope->appointmentFilter();
            $stmt = $pdo->prepare("SELECT a.*, CONCAT(p.first_name,' ',p.last_name) AS patient_name FROM appointments a JOIN patients p ON p.patient_id=a.patient_id WHERE a.status='pending' AND $where ORDER BY a.scheduled_date,a.scheduled_time");
            $stmt->execute($params); $pending = $stmt->fetchAll();
            $patients = PatientService::listAll();
            $contracts = ContractService::listAll($scope);
            $records = ClinicalRecordService::listAll();
            $notifications = UserNotificationService::listForUser((int) $scope->getUserId());
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM appointments a WHERE a.scheduled_date=CURRENT_DATE() AND a.status IN ('pending','confirmed') AND $where");
            $stmt->execute($params); $dayCount = (int) $stmt->fetchColumn();
            [$contractWhere, $contractParams] = $scope->contractFilter();
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(cp.amount_paid),0) FROM contract_payments cp JOIN braces_contracts c ON c.contract_id=cp.contract_id WHERE cp.status='approved' AND YEARWEEK(cp.payment_date,1)=YEARWEEK(CURRENT_DATE(),1) AND $contractWhere");
            $stmt->execute($contractParams); $collections = (float) $stmt->fetchColumn();
            $metrics = [$dayCount, count(array_unique(array_column(array_filter($contracts, fn($c) => $c['status_code'] === 'active'), 'patient_id'))), $collections, count(array_filter($contracts, fn($c) => $c['status_code'] === 'defaulted'))];
            $payments = $scope->isReceptionist() ? PaymentApprovalService::listAll() : [];
            $logs = $scope->isReceptionist() ? NotificationLogService::list()['logs'] : [];
            $promotions = $scope->isReceptionist() ? $pdo->query('SELECT promo_id AS id,title,description AS `desc`,image_path,status,start_date,end_date FROM promotions ORDER BY promo_id DESC')->fetchAll() : [];
            $inventory = $scope->isReceptionist() ? $pdo->query('SELECT item_id AS id,item_name AS item,category,stock_quantity AS qty,unit,reorder_level,last_restocked FROM inventory_items ORDER BY item_name')->fetchAll() : [];
            $reports = self::attendanceReports($pdo, $scope);
            $pdo->commit();
            return compact('week', 'pending', 'patients', 'contracts', 'records', 'notifications', 'metrics', 'payments', 'promotions', 'inventory', 'logs', 'reports');
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }

    private static function attendanceReports(\PDO $pdo, DataScope $scope): array
    {
        $monday = new \DateTimeImmutable('monday this week');
        $lastMonday = $monday->modify('-7 days');
        $monthStart = new \DateTimeImmutable('first day of this month');

        return [
            'this_week' => self::attendanceReport($pdo, $scope, $monday, $monday->modify('+6 days'), 'This Week'),
            'last_week' => self::attendanceReport($pdo, $scope, $lastMonday, $lastMonday->modify('+6 days'), 'Last Week'),
            'this_month' => self::attendanceReport($pdo, $scope, $monthStart, new \DateTimeImmutable('last day of this month'), 'This Month'),
        ];
    }

    private static function attendanceReport(\PDO $pdo, DataScope $scope, \DateTimeImmutable $from, \DateTimeImmutable $to, string $label): array
    {
        [$where, $params] = $scope->appointmentFilter();
        $sql = "SELECT a.appointment_id, a.scheduled_date, a.scheduled_time, a.status, a.service_type,
                       CONCAT(p.first_name,' ',p.last_name) AS patient_name,
                       COALESCE(d.full_name, 'Unassigned') AS dentist_name
                FROM appointments a
                JOIN patients p ON p.patient_id = a.patient_id
                LEFT JOIN dentists d ON d.dentist_id = a.dentist_id
                WHERE a.scheduled_date BETWEEN ? AND ?
                  AND a.status NOT IN ('cancelled','rejected')
                  AND $where
                ORDER BY a.scheduled_date DESC, a.scheduled_time DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_merge([$from->format('Y-m-d'), $to->format('Y-m-d')], $params));

        $attended = 0;
        $missed = 0;
        $upcoming = 0;
        $rows = [];
        $days = [];
        $now = new \DateTimeImmutable('now');
        for ($day = $from; $day <= $to; $day = $day->modify('+1 day')) {
            $days[$day->format('Y-m-d')] = ['day' => $day->format('M j'), 'attended' => 0, 'missed' => 0];
        }

        foreach ($stmt->fetchAll() as $row) {
            $status = strtolower((string) $row['status']);
            $when = new \DateTimeImmutable($row['scheduled_date'] . ' ' . $row['scheduled_time']);
            if ($status === 'completed') {
                $attendance = 'Attended';
                $tag = 'green';
                $attended++;
                if (isset($days[$row['scheduled_date']])) $days[$row['scheduled_date']]['attended']++;
            } elseif ($status === 'no_show' || (in_array($status, ['pending', 'confirmed'], true) && $when < $now)) {
                $attendance = 'Did not attend';
                $tag = 'red';
                $missed++;
                if (isset($days[$row['scheduled_date']])) $days[$row['scheduled_date']]['missed']++;
            } else {
                $attendance = 'Upcoming';
                $tag = 'amber';
                $upcoming++;
            }

            $rows[] = [
                'id' => (int) $row['appointment_id'],
                'patient' => $row['patient_name'],
                'service' => $row['service_type'],
                'dentist' => $row['dentist_name'],
                'date' => $row['scheduled_date'],
                'time' => substr((string) $row['scheduled_time'], 0, 5),
                'status' => $attendance,
                'tag' => $tag,
                'appointment_status' => $status,
            ];
        }

        $total = $attended + $missed;
        $attendanceRate = $total ? round(($attended / $total) * 100) : 0;
        $missedRate = $total ? 100 - $attendanceRate : 0;

        return [
            'label' => $label,
            'from' => $from->format('Y-m-d'),
            'to' => $to->format('Y-m-d'),
            'attended' => $attended,
            'missed' => $missed,
            'upcoming' => $upcoming,
            'total' => $total,
            'attendance_rate' => $attendanceRate,
            'missed_rate' => $missedRate,
            'bars' => array_values($days),
            'rows' => $rows,
        ];
    }
}
