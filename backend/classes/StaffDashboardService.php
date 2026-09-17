<?php
namespace ASDC;

class StaffDashboardService
{
    public static function snapshot(string $start): array
    {
        $scope = DataScope::current();
        $pdo = Database::pdo();
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
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM appointments a WHERE DATE_FORMAT(a.scheduled_date,'%Y-%m')=DATE_FORMAT(CURRENT_DATE(),'%Y-%m') AND a.status NOT IN ('cancelled','rejected') AND $where");
            $stmt->execute($params); $monthCount = (int) $stmt->fetchColumn();
            [$contractWhere, $contractParams] = $scope->contractFilter();
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(cp.amount_paid),0) FROM contract_payments cp JOIN braces_contracts c ON c.contract_id=cp.contract_id WHERE cp.status='approved' AND YEARWEEK(cp.payment_date,1)=YEARWEEK(CURRENT_DATE(),1) AND $contractWhere");
            $stmt->execute($contractParams); $collections = (float) $stmt->fetchColumn();
            $metrics = [$monthCount, count(array_unique(array_column(array_filter($contracts, fn($c) => $c['status_code'] === 'active'), 'patient_id'))), $collections, count(array_filter($contracts, fn($c) => $c['status_code'] === 'defaulted'))];
            $payments = $scope->isReceptionist() ? PaymentApprovalService::listAll() : [];
            $logs = $scope->isReceptionist() ? NotificationLogService::list()['logs'] : [];
            $promotions = $scope->isReceptionist() ? $pdo->query('SELECT promo_id AS id,title,description AS `desc`,image_path,status,start_date,end_date FROM promotions ORDER BY promo_id DESC')->fetchAll() : [];
            $inventory = $scope->isReceptionist() ? $pdo->query('SELECT item_id AS id,item_name AS item,category,stock_quantity AS qty,unit,reorder_level,last_restocked FROM inventory_items ORDER BY item_name')->fetchAll() : [];
            $pdo->commit();
            return compact('week', 'pending', 'patients', 'contracts', 'records', 'notifications', 'metrics', 'payments', 'promotions', 'inventory', 'logs');
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }
}
