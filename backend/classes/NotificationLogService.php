<?php
/**
 * Notification log query service: Aromin-Sison Dental Clinic System.
 *
 * Usage:
 *   $result = NotificationLogService::list($filters);
 */

namespace ASDC;

use PDO;

class NotificationLogService
{
    /**
     * List notification logs with optional filters and pagination.
     *
     * @param array{patient_id?: int, channel?: string, status?: string, limit?: int, offset?: int} $filters
     * @return array{success: true, total: int, limit: int, offset: int, logs: array}
     */
    public static function list(array $filters = []): array
    {
        $pdo = Database::pdo();

        $patientId = $filters['patient_id'] ?? null;
        $channel   = $filters['channel'] ?? null;
        $status    = $filters['status'] ?? null;
        $limit     = min(max((int) ($filters['limit'] ?? 50), 1), 200);
        $offset    = max((int) ($filters['offset'] ?? 0), 0);

        $where  = [];
        $params = [];
        [$scopeWhere, $scopeParams] = DataScope::current()->patientFilter();
        $where[] = $scopeWhere;
        $params = $scopeParams;

        if ($patientId) {
            $where[]  = 'nl.patient_id = ?';
            $params[] = $patientId;
        }
        if ($channel === 'email') {
            $where[]  = 'nl.channel = ?';
            $params[] = $channel;
        }
        if ($status && in_array($status, ['sent', 'failed', 'pending'], true)) {
            $where[]  = 'nl.status = ?';
            $params[] = $status;
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $sql = "
            SELECT
                nl.log_id,
                nl.patient_id,
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                nl.channel,
                nl.recipient,
                nl.subject,
                nl.body,
                nl.status,
                nl.error_message,
                nl.sent_at,
                nt.template_key,
                nt.name AS template_name,
                a.status AS appointment_status
            FROM notification_logs nl
            JOIN patients p ON p.patient_id = nl.patient_id
            LEFT JOIN notification_templates nt ON nt.template_id = nl.template_id
            LEFT JOIN appointments a ON a.appointment_id = nl.appointment_id
            $whereClause
            ORDER BY nl.sent_at DESC
            LIMIT $limit OFFSET $offset
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll();

        $countSql = "SELECT COUNT(*) FROM notification_logs nl JOIN patients p ON p.patient_id=nl.patient_id $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        return [
            'success' => true,
            'total'   => $total,
            'limit'   => $limit,
            'offset'  => $offset,
            'logs'    => $logs,
        ];
    }

    public static function delete(int $logId): array
    {
        if ($logId <= 0) {
            return ['success' => false, 'error' => 'Choose a valid notification log.', 'code' => 422];
        }

        $pdo = Database::pdo();
        [$scopeWhere, $scopeParams] = DataScope::current()->patientFilter();
        $check = $pdo->prepare(
            "SELECT nl.log_id
             FROM notification_logs nl
             JOIN patients p ON p.patient_id = nl.patient_id
             WHERE nl.log_id = ? AND $scopeWhere"
        );
        $check->execute(array_merge([$logId], $scopeParams));
        if (!$check->fetchColumn()) {
            return ['success' => false, 'error' => 'Notification log not found.', 'code' => 404];
        }

        $stmt = $pdo->prepare('DELETE FROM notification_logs WHERE log_id = ?');
        $stmt->execute([$logId]);

        return ['success' => true, 'log_id' => $logId];
    }
}
