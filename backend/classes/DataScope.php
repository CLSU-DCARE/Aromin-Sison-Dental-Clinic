<?php
/**
 * Data scoping utility: Aromin-Sison Dental Clinic System.
 *
 * Shared dentist and receptionist roles can access clinic-wide staff data;
 * patient sessions remain scoped to their own linked patient profile.
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
     * Shared staff roles see all active patient appointments; patients see
     * appointments linked to their own profile.
     *
     * @return array{sql: string, params: array}
     */
    public function appointmentFilter(): array
    {
        if ($this->isPatient()) return ['a.patient_id IN (SELECT patient_id FROM patients WHERE user_id=? AND archived_at IS NULL)', [$this->userId]];
        if (!$this->hasFullAccess() && !$this->isDentist()) return ['1=0', []];
        $active = 'a.patient_id IN (SELECT patient_id FROM patients WHERE archived_at IS NULL)';
        return [$active, []];
    }

    /**
     * SQL fragment to scope appointment requests to the current role.
     *
     * @return array{sql: string, params: array}
     */
    public function requestFilter(): array
    {
        if (!$this->hasFullAccess() && !$this->isDentist()) return ['1=0', []];
        return ['1=1', []];
    }

    /**
     * SQL fragment to scope patient rows. Patient sessions remain self-scoped.
     *
     * @return array{sql: string, params: array}
     */
    public function patientFilter(): array
    {
        if ($this->isPatient()) {
            return ['p.user_id = ? AND p.archived_at IS NULL', [$this->userId]];
        }
        return ['p.archived_at IS NULL', []];
    }

    /**
     * Shared staff roles see all active patient contracts; patients see
     * contracts linked to their own profile.
     *
     * @return array{sql: string, params: array}
     */
    public function contractFilter(): array
    {
        if ($this->isPatient()) return ['c.patient_id IN (SELECT patient_id FROM patients WHERE user_id=? AND archived_at IS NULL)', [$this->userId]];
        if (!$this->hasFullAccess() && !$this->isDentist()) return ['1=0', []];
        $active = 'c.patient_id IN (SELECT patient_id FROM patients WHERE archived_at IS NULL)';
        return [$active, []];
    }

    /**
     * Check whether the current staff role may update contract progress.
     */
    public function canUpdateContractProgress(array $contract): bool
    {
        if ($this->hasFullAccess()) {
            return true;
        }
        if ($this->isDentist()) {
            return true;
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
            return true;
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
            return true;
        }
        return false;
    }
}
