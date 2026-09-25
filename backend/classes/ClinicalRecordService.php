<?php
namespace ASDC;

class ClinicalRecordService
{
    public static function listAll(): array
    {
        [$where, $params] = DataScope::current()->patientFilter();
        $stmt = Database::pdo()->prepare("SELECT r.*, CONCAT(p.first_name,' ',p.last_name) AS name, u.full_name AS dentist
            FROM treatment_records r JOIN patients p ON p.patient_id=r.patient_id
            LEFT JOIN dentists u ON u.dentist_id=r.dentist_id WHERE $where ORDER BY r.date_recorded DESC,r.record_id DESC");
        $stmt->execute($params);
        return array_map(static function ($r) {
            $procedure = $r['treatment_given'] ?: ($r['diagnosis'] ?: $r['treatment_protocol']);
            $category = str_starts_with((string) $procedure, 'Braces Progress') ? 'Progress' : ($r['treatment_given'] ? 'Treatment' : 'Protocol');
            return $r + ['id' => (int) $r['record_id'], 'initials' => self::initials((string) $r['name']), 'category' => $category,
                'procedure' => $procedure, 'date' => $r['date_recorded'], 'status' => 'Recorded', 'tag' => 'green'];
        }, $stmt->fetchAll());
    }

    public static function save(array $body, bool $editing): array
    {
        $patientId = InputValidator::positiveId($body['patient_id'] ?? null);
        $appointmentId = InputValidator::positiveId($body['appointment_id'] ?? null);
        $recordId = InputValidator::positiveId($body['record_id'] ?? null);
        $date = InputValidator::date($body['date_recorded'] ?? date('Y-m-d'));
        $texts = [];
        foreach (['diagnosis', 'treatment_given', 'treatment_protocol'] as $key) {
            if (!is_string($body[$key] ?? '') || mb_strlen($body[$key] ?? '') > 10000) ApiResponse::error(422, 'validation_failed', 'Clinical text must be at most 10,000 characters.');
            $texts[$key] = trim($body[$key] ?? '');
        }
        if (mb_strlen($texts['diagnosis']) > 255) ApiResponse::error(422, 'validation_failed', 'Diagnosis must be at most 255 characters.');
        if (!$patientId || !$date || $date > date('Y-m-d') || ($editing && !$recordId) || !implode('', $texts)) ApiResponse::error(422, 'validation_failed', 'A patient, valid record date, and clinical information are required.');
        $pdo = Database::pdo();
        $scope = DataScope::current();
        [$where, $params] = $scope->patientFilter();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT p.patient_id FROM patients p WHERE p.patient_id=? AND $where FOR UPDATE");
            $stmt->execute(array_merge([$patientId], $params));
            if (!$stmt->fetchColumn()) { $pdo->rollBack(); ApiResponse::error(403, 'forbidden', 'You may only record treatment for active patients.'); }
            if ($appointmentId) {
                $stmt = $pdo->prepare('SELECT appointment_id FROM appointments WHERE appointment_id=? AND patient_id=? FOR UPDATE');
                $stmt->execute([$appointmentId, $patientId]);
                if (!$stmt->fetchColumn()) { $pdo->rollBack(); ApiResponse::error(403, 'forbidden', 'Appointment does not belong to this patient.'); }
            }
            if ($editing) {
                $stmt = $pdo->prepare('SELECT record_id FROM treatment_records WHERE record_id=? AND patient_id=? FOR UPDATE');
                $stmt->execute([$recordId, $patientId]);
                if (!$stmt->fetchColumn()) { $pdo->rollBack(); ApiResponse::error(403, 'forbidden', 'Record does not belong to this patient.'); }
                $pdo->prepare('UPDATE treatment_records SET diagnosis=?,treatment_given=?,treatment_protocol=?,date_recorded=?,appointment_id=? WHERE record_id=?')->execute([...array_values($texts), $date, $appointmentId, $recordId]);
            } else {
                $dentistId = null;
                if ($appointmentId) {
                    $lookup = $pdo->prepare('SELECT dentist_id FROM appointments WHERE appointment_id=? AND patient_id=?');
                    $lookup->execute([$appointmentId, $patientId]);
                    $dentistId = $lookup->fetchColumn() ?: null;
                }
                $pdo->prepare('INSERT INTO treatment_records(patient_id,dentist_id,diagnosis,treatment_given,treatment_protocol,date_recorded,appointment_id) VALUES(?,?,?,?,?,?,?)')->execute([$patientId, $dentistId, ...array_values($texts), $date, $appointmentId]);
                $recordId = (int) $pdo->lastInsertId();
                InventoryUsageService::consumeForTreatment($pdo, $recordId, $texts['treatment_given']);
            }
            PortalEvent::patient($patientId, 'Treatment record updated', 'Your clinic treatment record has been updated.', 'info');
            $pdo->commit();
            return ['record_id' => $recordId];
        } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }

    public static function recordCompletedAppointment(\PDO $pdo, int $appointmentId): ?int
    {
        $stmt = $pdo->prepare(
            "SELECT a.appointment_id, a.patient_id, a.dentist_id, a.service_type, a.scheduled_date
             FROM appointments a
             WHERE a.appointment_id=? AND a.status='completed'"
        );
        $stmt->execute([$appointmentId]);
        $appointment = $stmt->fetch();
        if (!$appointment) return null;

        $stmt = $pdo->prepare('SELECT record_id FROM treatment_records WHERE appointment_id=? LIMIT 1');
        $stmt->execute([$appointmentId]);
        $recordId = $stmt->fetchColumn();
        if ($recordId) return (int) $recordId;

        $protocol = 'Completed visit recorded from appointment #' . $appointmentId . '.';
        $stmt = $pdo->prepare(
            'INSERT INTO treatment_records(patient_id,dentist_id,diagnosis,treatment_given,treatment_protocol,date_recorded,appointment_id)
             VALUES(?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            (int) $appointment['patient_id'],
            $appointment['dentist_id'] ? (int) $appointment['dentist_id'] : null,
            null,
            $appointment['service_type'] ?: 'Completed treatment',
            $protocol,
            $appointment['scheduled_date'] ?: date('Y-m-d'),
            $appointmentId,
        ]);

        $recordId = (int) $pdo->lastInsertId();
        InventoryUsageService::consumeForTreatment($pdo, $recordId, (string) $appointment['service_type']);
        return $recordId;
    }

    public static function recordBracesProgress(\PDO $pdo, array $contract, string $stage, int $percent, ?string $note, ?string $nextNote): ?int
    {
        $patientId = (int) ($contract['patient_id'] ?? 0);
        if (!$patientId) return null;

        $dentistId = !empty($contract['dentist_id']) ? (int) $contract['dentist_id'] : null;
        $date = date('Y-m-d');
        $diagnosis = 'Braces progress updated';
        $treatment = 'Braces Progress - ' . $stage;
        $parts = ['Progress: ' . $percent . '%'];
        if ($note) $parts[] = 'Note: ' . $note;
        if ($nextNote) $parts[] = 'Next visit: ' . $nextNote;
        $protocol = implode("\n", $parts);

        $stmt = $pdo->prepare(
            "SELECT record_id
             FROM treatment_records
             WHERE patient_id = ?
               AND date_recorded = ?
               AND diagnosis = ?
               AND treatment_given LIKE 'Braces Progress - %'
             ORDER BY record_id DESC
             LIMIT 1"
        );
        $stmt->execute([$patientId, $date, $diagnosis]);
        $recordId = $stmt->fetchColumn();

        if ($recordId) {
            $stmt = $pdo->prepare(
                'UPDATE treatment_records
                 SET dentist_id = ?, treatment_given = ?, treatment_protocol = ?
                 WHERE record_id = ?'
            );
            $stmt->execute([$dentistId, $treatment, $protocol, (int) $recordId]);
            return (int) $recordId;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO treatment_records(patient_id,dentist_id,diagnosis,treatment_given,treatment_protocol,date_recorded,appointment_id)
             VALUES(?,?,?,?,?,?,NULL)'
        );
        $stmt->execute([$patientId, $dentistId, $diagnosis, $treatment, $protocol, $date]);

        return (int) $pdo->lastInsertId();
    }

    private static function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        $letters = array_map(fn ($p) => mb_strtoupper(mb_substr($p, 0, 1)), array_slice($parts ?: [], 0, 2));
        return implode('', $letters) ?: '?';
    }
}
