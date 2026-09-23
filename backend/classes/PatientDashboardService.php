<?php
namespace ASDC;

/** A consistent, patient-scoped snapshot of data shared with clinic staff. */
class PatientDashboardService
{
    public static function snapshot(int $patientId): array
    {
        $pdo = Database::pdo();
        PaymentApprovalService::ensureGeneralTreatmentBillingTables();
        $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $pdo->beginTransaction();
        try {
            $appointments = PatientAppointmentService::listAppointments($patientId);
            $braces = BracesService::getBracesData($patientId);
            $submissions = PaymentApprovalService::listForPatient($patientId);
            $stmt = $pdo->prepare('SELECT patient_id, first_name, last_name, email, contact_number, registered_at FROM patients WHERE patient_id = ?');
            $stmt->execute([$patientId]);
            $profile = $stmt->fetch();
            $stmt = $pdo->prepare('SELECT r.record_id, r.treatment_given, r.diagnosis, r.treatment_protocol, r.date_recorded, u.full_name AS dentist FROM treatment_records r LEFT JOIN dentists u ON u.dentist_id = r.dentist_id WHERE r.patient_id = ? ORDER BY r.date_recorded DESC, r.record_id DESC');
            $stmt->execute([$patientId]);
            $treatments = array_map(static fn(array $r) => [
                'id' => (int) $r['record_id'], 'title' => $r['treatment_given'] ?: ($r['diagnosis'] ?: 'Treatment record'),
                'diagnosis' => $r['diagnosis'], 'notes' => $r['treatment_protocol'],
                'meta' => $r['date_recorded'] . ($r['dentist'] ? ' · ' . $r['dentist'] : ''),
            ], $stmt->fetchAll());
            $notifications = UserNotificationService::listForUser((int) $_SESSION['user_id']);
            $dentists = $pdo->query("SELECT dentist_id,full_name FROM dentists WHERE is_active=1 ORDER BY full_name")->fetchAll();
            $announcements = $pdo->query("SELECT promo_id AS id,title,description AS `desc`,image_path,status,start_date,end_date FROM promotions WHERE status IN ('live','scheduled') AND (end_date IS NULL OR end_date>=CURRENT_DATE()) ORDER BY promo_id DESC")->fetchAll();
            $pdo->commit();
            return compact('appointments', 'braces', 'submissions', 'profile', 'treatments', 'notifications', 'dentists', 'announcements');
        } catch (\Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
}
