<?php
namespace ASDC;

/** Shared identity checks for registration, booking, updates and restoration. */
class PatientIdentity
{
    public static function locked(callable $operation)
    {
        $pdo = Database::pdo();
        $key = 'asdc:patient-identity:' . sha1((string)$pdo->query('SELECT DATABASE()')->fetchColumn());
        $stmt = $pdo->prepare('SELECT GET_LOCK(?, 5)');
        $stmt->execute([$key]);
        if ((int)$stmt->fetchColumn() !== 1) throw new \RuntimeException('Patient records are being updated. Please try again.');
        try { return $operation(); }
        finally { $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$key]); }
    }

    private static function name(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? $value), 'UTF-8');
    }

    private static function phone(string $value): string
    {
        $digits = preg_replace('/\D/', '', $value) ?? '';
        if (preg_match('/^0(9\d{9})$/D', $digits, $match)) return '63' . $match[1];
        if (preg_match('/^9\d{9}$/D', $digits)) return '63' . $digits;
        return $digits;
    }

    public static function find(string $name, string $contact, string $email, ?int $excludeId = null): ?array
    {
        $name = self::name($name);
        $contact = self::phone($contact);
        $email = mb_strtolower(trim($email), 'UTF-8');
        // A locking read also sees a record committed while this request was waiting.
        $stmt = Database::pdo()->prepare('SELECT patient_id, first_name, last_name, email, contact_number FROM patients WHERE archived_at IS NULL AND patient_id <> ? ORDER BY patient_id FOR UPDATE');
        $stmt->execute([$excludeId ?? 0]);
        $nameMatch = null;
        $contactMatch = null;
        foreach ($stmt->fetchAll() as $patient) {
            if ($email !== '' && $email === mb_strtolower(trim((string)$patient['email']), 'UTF-8')) {
                $patient['matched_field'] = 'email';
                return $patient;
            }
            if (!$contactMatch && $contact !== '' && $contact === self::phone((string)$patient['contact_number'])) {
                $patient['matched_field'] = 'contact_number';
                $contactMatch = $patient;
            }
            if (!$nameMatch && $name !== '' && $name === self::name($patient['first_name'] . ' ' . $patient['last_name'])) {
                $patient['matched_field'] = 'name';
                $nameMatch = $patient;
            }
        }
        return $contactMatch ?? $nameMatch;
    }

    public static function assertAvailable(string $name, string $contact, string $email, ?int $excludeId = null): void
    {
        $match = self::find($name, $contact, $email, $excludeId);
        if ($match) throw new DuplicatePatientException((int)$match['patient_id'], $match['matched_field']);
    }
}
