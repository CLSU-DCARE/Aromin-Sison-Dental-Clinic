<?php
/**
 * Patient management service: Aromin-Sison Dental Clinic System.
 *
 * Staff-facing: list all patients for admin dashboard.
 * Patient-facing: resolve patient profile from user ID.
 *
 * Usage:
 *   $patients = PatientService::listAll();
 *   $patientId = PatientService::resolvePatientId($userId);
 */

namespace ASDC;

use PDO;

class PatientService
{
    /**
     * Create a walk-in/admin-managed patient record.
     *
     * @param array{name: string, contact_number?: string, email?: string} $data
     * @return array{patient_id: int}
     */
    public static function create(array $data): array
    {
        $name = isset($data['name']) && is_string($data['name']) ? trim($data['name']) : '';
        $contact = isset($data['contact_number']) && is_string($data['contact_number']) ? trim($data['contact_number']) : '';
        $email = isset($data['email']) && is_string($data['email']) ? trim($data['email']) : '';

        $fields = [];
        if (mb_strlen($name) < 2 || mb_strlen($name) > 150) {
            $fields['name'] = 'Enter the patient full name.';
        }
        if ($contact !== '' && (strlen($contact) > 20 || !preg_match('/^[+0-9() .-]{7,20}$/', $contact))) {
            $fields['contact_number'] = 'Enter a valid contact number.';
        }
        if ($email !== '' && (strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
            $fields['email'] = 'Enter a valid email address.';
        }
        if ($fields) {
            ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);
        }

        $parts = preg_split('/\s+/', $name, 2);
        $firstName = $parts[0] ?? '';
        $lastName = $parts[1] ?? '';
        if ($lastName === '') {
            ApiResponse::error(422, 'validation_failed', 'Enter both first and last name.', ['name' => 'Enter both first and last name.']);
        }

        $stmt = Database::pdo()->prepare(
            'INSERT INTO patients (first_name, last_name, contact_number, email) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$firstName, $lastName, $contact ?: null, $email ?: null]);

        $patientId = (int) Database::pdo()->lastInsertId();
        PortalEvent::patient($patientId, 'Patient profile created', 'A new patient record was added.');
        return ['patient_id' => $patientId];
    }

    /**
     * Archive a patient record without removing dependent clinical records.
     *
     * @return array{patient_id: int}
     */
    public static function delete(int $patientId): array
    {
        if ($patientId < 1) {
            ApiResponse::error(422, 'validation_failed', 'Choose a valid patient.');
        }
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT user_id, archived_at FROM patients WHERE patient_id = ? FOR UPDATE');
            $stmt->execute([$patientId]);
            $row = $stmt->fetch();
            if (!$row) {
                $pdo->rollBack();
                ApiResponse::error(404, 'not_found', 'Patient not found.');
            }

            if ($row['archived_at']) {
                $pdo->rollBack();
                ApiResponse::error(409, 'already_archived', 'Patient is already archived.');
            }

            $userId = $row['user_id'] ? (int) $row['user_id'] : null;
            AuthMiddleware::secureSessionStart();
            $archivedBy = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
            $pdo->prepare(
                "UPDATE patients
                    SET archived_at = NOW(),
                        archived_by = ?,
                        retention_note = 'Archived by staff; clinical, appointment, contract, and payment records retained for audit.'
                  WHERE patient_id = ?"
            )->execute([$archivedBy, $patientId]);

            if ($userId) {
                $pdo->prepare("UPDATE users SET is_active = 0 WHERE user_id = ? AND role = 'patient'")->execute([$userId]);
            }

            PortalEvent::patient($patientId, 'Patient record archived', 'This patient record was deactivated and retained for audit.');
            $pdo->commit();
            return ['patient_id' => $patientId];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Patient archival failed: ' . $e->getMessage());
            ApiResponse::error(500, 'archive_failed', 'Unable to archive patient.');
        }
    }

    /**
     * List all patients (admin dashboard).
     * Dentists see only patients who have appointments with them.
     *
     * @return array<int, array{patient_id: int, first_name: string, last_name: string, contact_number: ?string, email: ?string, registered_at: string}>
     */
    public static function listAll(): array
    {
        $scope = DataScope::current();
        [$where, $params] = $scope->patientFilter();
        $stmt = Database::pdo()->prepare(
            "SELECT patient_id, first_name, last_name, contact_number, email, registered_at,
                    (SELECT MAX(a.scheduled_date) FROM appointments a WHERE a.patient_id=p.patient_id AND a.status='completed') AS last_visit
             FROM patients p
             WHERE {$where}
             ORDER BY registered_at DESC"
        );
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function listArchived(): array
    {
        $scope = DataScope::current();
        [$where, $params] = self::archivedPatientFilter($scope);
        $stmt = Database::pdo()->prepare(
            "SELECT p.patient_id, p.first_name, p.last_name, p.contact_number, p.email,
                    p.registered_at, p.archived_at, p.retention_note, u.full_name AS archived_by_name,
                    (SELECT COUNT(*) FROM appointments a WHERE a.patient_id=p.patient_id) AS appointment_count,
                    (SELECT COUNT(*) FROM treatment_records r WHERE r.patient_id=p.patient_id) AS record_count,
                    (SELECT COUNT(*) FROM braces_contracts c WHERE c.patient_id=p.patient_id) AS contract_count,
                    (SELECT COUNT(*) FROM contract_payments cp JOIN braces_contracts c ON c.contract_id=cp.contract_id WHERE c.patient_id=p.patient_id) AS payment_count,
                    (SELECT COUNT(*) FROM user_notifications n WHERE n.patient_id=p.patient_id) AS notification_count
             FROM patients p
             LEFT JOIN users u ON u.user_id=p.archived_by
             WHERE {$where}
             ORDER BY p.archived_at DESC, p.patient_id DESC"
        );
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function archivedDetails(int $patientId): array
    {
        $pdo = Database::pdo();
        $scope = DataScope::current();
        [$where, $params] = self::archivedPatientFilter($scope);
        $patient = $pdo->prepare(
            "SELECT p.*, u.full_name AS archived_by_name
             FROM patients p
             LEFT JOIN users u ON u.user_id=p.archived_by
             WHERE p.patient_id=? AND {$where}"
        );
        $patient->execute(array_merge([$patientId], $params));
        $row = $patient->fetch();
        if (!$row) ApiResponse::error(404, 'not_found', 'Archived patient not found.');

        $queries = [
            'appointments' => "SELECT a.*, d.full_name AS dentist_name FROM appointments a LEFT JOIN users d ON d.user_id=a.dentist_id WHERE a.patient_id=? ORDER BY a.scheduled_date DESC,a.scheduled_time DESC",
            'records' => "SELECT r.*, d.full_name AS dentist_name FROM treatment_records r LEFT JOIN users d ON d.user_id=r.dentist_id WHERE r.patient_id=? ORDER BY r.date_recorded DESC,r.record_id DESC",
            'contracts' => "SELECT c.*, d.full_name AS dentist_name FROM braces_contracts c LEFT JOIN users d ON d.user_id=c.dentist_id WHERE c.patient_id=? ORDER BY c.contract_id DESC",
            'payments' => "SELECT cp.* FROM contract_payments cp JOIN braces_contracts c ON c.contract_id=cp.contract_id WHERE c.patient_id=? ORDER BY cp.created_at DESC,cp.payment_id DESC",
            'notifications' => "SELECT notification_id,title,message,type,created_at,read_at FROM user_notifications WHERE patient_id=? ORDER BY notification_id DESC",
        ];
        $details = ['patient' => $row];
        foreach ($queries as $key => $sql) {
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$patientId]);
            $details[$key] = $stmt->fetchAll();
        }
        return $details;
    }

    /**
     * Archived-patient scope. Receptionists may inspect all archived records;
     * dentists only see archived patients with their appointments or contracts.
     *
     * @return array{0: string, 1: array<int, mixed>}
     */
    private static function archivedPatientFilter(DataScope $scope): array
    {
        if ($scope->isDentist()) {
            $userId = $scope->getUserId();
            if (!$userId) return ['1=0', []];
            return [
                'p.archived_at IS NOT NULL AND (p.patient_id IN (SELECT patient_id FROM appointments WHERE dentist_id = ?) OR p.patient_id IN (SELECT patient_id FROM braces_contracts WHERE dentist_id = ?))',
                [$userId, $userId],
            ];
        }

        if ($scope->hasFullAccess()) {
            return ['p.archived_at IS NOT NULL', []];
        }

        return ['1=0', []];
    }

    public static function restore(int $patientId): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT user_id, archived_at FROM patients WHERE patient_id=? FOR UPDATE');
            $stmt->execute([$patientId]);
            $row = $stmt->fetch();
            if (!$row) { $pdo->rollBack(); ApiResponse::error(404, 'not_found', 'Patient not found.'); }
            if (!$row['archived_at']) { $pdo->rollBack(); ApiResponse::error(409, 'not_archived', 'Patient is already active.'); }

            $pdo->prepare('UPDATE patients SET archived_at=NULL, archived_by=NULL, retention_note=NULL WHERE patient_id=?')->execute([$patientId]);
            if ($row['user_id']) {
                $pdo->prepare("UPDATE users SET is_active=1 WHERE user_id=? AND role='patient'")->execute([(int) $row['user_id']]);
            }
            PortalEvent::patient($patientId, 'Patient record restored', 'This patient record was reactivated.', 'info');
            $pdo->commit();
            return ['patient_id' => $patientId, 'status' => 'active'];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Resolve patient_id from user_id, or respond with 404.
     */
    public static function resolvePatientId(int $userId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT patient_id FROM patients WHERE user_id = ? AND archived_at IS NULL LIMIT 1'
        );
        $stmt->execute([$userId]);
        $patient = $stmt->fetch();

        if (!$patient) {
            ApiResponse::error(404, 'not_found', 'No patient profile is linked to this account.');
        }

        return (int) $patient['patient_id'];
    }
}
