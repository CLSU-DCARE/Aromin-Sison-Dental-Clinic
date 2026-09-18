<?php
/**
 * Data scoping utility: Aromin-Sison Dental Clinic System.
 *
 * Ensures dentists only see their own patients and appointments.
 * Receptionists and patients see all data they're authorized for.
 *
 * Usage:
 *   $scope = DataScope::current();
 *   if ($scope->appointmentFilter()) { ... }
 */

namespace ASDC;

class DataScope
{
    private ?int $userId;
    private ?string $role;

    private function __construct(?int $userId, ?string $role)
    {
        $this->userId = $userId;
        $this->role = $role;
    }

    /**
     * Build scope from the current authenticated session.
     */
    public static function current(): self
    {
        AuthMiddleware::secureSessionStart();
        return new self(
            isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null,
            $_SESSION['role'] ?? null
        );
    }

    /**
     * Build scope for a specific user (useful for testing or impersonation).
     */
    public static function forUser(int $userId, string $role): self
    {
        return new self($userId, $role);
    }

    public function isDentist(): bool
    {
        return $this->role === 'dentist';
    }

    public function isReceptionist(): bool
    {
        return $this->role === 'receptionist';
    }

    public function isPatient(): bool
    {
        return $this->role === 'patient';
    }

    public function hasFullAccess(): bool
    {
        return in_array($this->role, ['receptionist', 'admin'], true);
    }

    public function getUserId(): ?int
    {
        return $this->userId;
    }

    /**
     * SQL fragment to scope appointments to the current dentist.
     * Returns '1=1' for non-dentist roles (no filtering).
     *
     * @return array{sql: string, params: array}
     */
    public function appointmentFilter(): array
    {
        if ($this->isPatient()) return ['a.patient_id IN (SELECT patient_id FROM patients WHERE user_id=? AND archived_at IS NULL)', [$this->userId]];
        if (!$this->hasFullAccess() && !$this->isDentist()) return ['1=0', []];
        $active = 'a.patient_id IN (SELECT patient_id FROM patients WHERE archived_at IS NULL)';
        if (!$this->isDentist() || !$this->userId) {
            return [$active, []];
        }
        return ["a.dentist_id = ? AND {$active}", [$this->userId]];
    }

    /**
     * SQL fragment to scope appointment requests to the current dentist.
     * Returns '1=1' for non-dentist roles.
     *
     * @return array{sql: string, params: array}
     */
    public function requestFilter(): array
    {
        if (!$this->hasFullAccess() && !$this->isDentist()) return ['1=0', []];
        if (!$this->isDentist() || !$this->userId) {
            return ['1=1', []];
        }
        return ['r.preferred_dentist_id = ?', [$this->userId]];
    }

    /**
     * SQL fragment to scope patients to those with appointments to the current dentist.
     * Returns '1=1' for non-dentist roles.
     *
     * @return array{sql: string, params: array}
     */
    public function patientFilter(): array
    {
        if ($this->isPatient()) {
            return ['p.user_id = ? AND p.archived_at IS NULL', [$this->userId]];
        }
        if (!$this->isDentist() || !$this->userId) {
            return ['p.archived_at IS NULL', []];
        }
        return [
            'p.archived_at IS NULL AND (p.patient_id IN (SELECT patient_id FROM appointments WHERE dentist_id = ?) OR p.patient_id IN (SELECT patient_id FROM braces_contracts WHERE dentist_id = ?))',
            [$this->userId, $this->userId],
        ];
    }

    /**
     * SQL fragment to scope braces contracts to the current dentist (only
     * contracts assigned to them). Returns '1=1' for non-dentist roles —
     * receptionists manage/see all contracts.
     *
     * @return array{sql: string, params: array}
     */
    public function contractFilter(): array
    {
        if ($this->isPatient()) return ['c.patient_id IN (SELECT patient_id FROM patients WHERE user_id=? AND archived_at IS NULL)', [$this->userId]];
        if (!$this->hasFullAccess() && !$this->isDentist()) return ['1=0', []];
        $active = 'c.patient_id IN (SELECT patient_id FROM patients WHERE archived_at IS NULL)';
        if (!$this->isDentist() || !$this->userId) {
            return [$active, []];
        }
        return ["c.dentist_id = ? AND {$active}", [$this->userId]];
    }

    /**
     * Check if the current user may update a specific contract's treatment
     * progress. Receptionists can always manage contracts; a dentist may
     * only update progress on a contract assigned to them.
     */
    public function canUpdateContractProgress(array $contract): bool
    {
        if ($this->hasFullAccess()) {
            return true;
        }
        if ($this->isDentist()) {
            return (int) ($contract['dentist_id'] ?? 0) === $this->userId;
        }
        return false;
    }

    /**
     * Check if the current user can access a specific appointment.
     */
    public function canAccessAppointment(array $appointment): bool
    {
        if ($this->hasFullAccess()) {
            return true;
        }
        if ($this->isDentist()) {
            return (int) ($appointment['dentist_id'] ?? 0) === $this->userId;
        }
        if ($this->isPatient()) {
            $stmt = Database::pdo()->prepare('SELECT 1 FROM patients WHERE patient_id=? AND user_id=?');
            $stmt->execute([(int) ($appointment['patient_id'] ?? 0), $this->userId]);
            return (bool) $stmt->fetchColumn();
        }
        return false;
    }

    /**
     * Check if the current user can access a specific appointment request.
     */
    public function canAccessRequest(array $request): bool
    {
        if ($this->hasFullAccess()) {
            return true;
        }
        if ($this->isDentist()) {
            return (int) ($request['preferred_dentist_id'] ?? 0) === $this->userId;
        }
        return false;
    }
}
