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
     * Delete a patient record and its dependent clinical records.
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
            $stmt = $pdo->prepare('SELECT user_id FROM patients WHERE patient_id = ? FOR UPDATE');
            $stmt->execute([$patientId]);
            $row = $stmt->fetch();
            if (!$row) {
                $pdo->rollBack();
                ApiResponse::error(404, 'not_found', 'Patient not found.');
            }

            $userId = $row['user_id'] ? (int) $row['user_id'] : null;
            $pdo->prepare('DELETE FROM patients WHERE patient_id = ?')->execute([$patientId]);

            if ($userId) {
                $pdo->prepare("DELETE FROM users WHERE user_id = ? AND role = 'patient'")->execute([$userId]);
            }

            $pdo->commit();
            return ['patient_id' => $patientId];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Patient deletion failed: ' . $e->getMessage());
            ApiResponse::error(500, 'delete_failed', 'Unable to delete patient.');
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

    /**
     * Resolve patient_id from user_id, or respond with 404.
     */
    public static function resolvePatientId(int $userId): int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT patient_id FROM patients WHERE user_id = ? LIMIT 1'
        );
        $stmt->execute([$userId]);
        $patient = $stmt->fetch();

        if (!$patient) {
            ApiResponse::error(404, 'not_found', 'No patient profile is linked to this account.');
        }

        return (int) $patient['patient_id'];
    }
}
