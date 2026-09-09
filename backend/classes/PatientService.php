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
            "SELECT patient_id, first_name, last_name, contact_number, email, registered_at
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
