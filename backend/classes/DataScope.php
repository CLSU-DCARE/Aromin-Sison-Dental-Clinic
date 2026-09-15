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
        if (!$this->isDentist() || !$this->userId) {
            return ['1=1', []];
        }
        return ['a.dentist_id = ?', [$this->userId]];
    }

    /**
     * SQL fragment to scope appointment requests to the current dentist.
     * Returns '1=1' for non-dentist roles.
     *
     * @return array{sql: string, params: array}
     */
    public function requestFilter(): array
    {
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
            return ['p.user_id = ?', [$this->userId]];
        }
        if (!$this->isDentist() || !$this->userId) {
            return ['1=1', []];
        }
        return [
            'p.patient_id IN (SELECT patient_id FROM appointments WHERE dentist_id = ?)',
            [$this->userId],
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
        if (!$this->isDentist() || !$this->userId) {
            return ['1=1', []];
        }
        return ['c.dentist_id = ?', [$this->userId]];
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
            return (int) ($appointment['patient_id'] ?? 0) === $this->userId;
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
