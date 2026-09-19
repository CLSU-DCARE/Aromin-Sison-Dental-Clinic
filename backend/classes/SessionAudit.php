<?php
/**
 * SessionAudit: Aromin-Sison Dental Clinic System.
 *
 * Logs session lifecycle events for security auditing.
 */

namespace ASDC;

class SessionAudit
{
    private const EVENT_TYPES = ['create', 'destroy', 'refresh', 'expire', 'revoke', 'remember_used'];

    /**
     * Log a session event.
     *
     * @param int $userId
     * @param string $eventType One of: create, destroy, refresh, expire, revoke, remember_used
     * @param string|null $sessionId
     * @param array $details Additional context
     * @return void
     */
    public static function log(
        int $userId,
        string $eventType,
        ?string $sessionId = null,
        array $details = []
    ): void {
        if (!in_array($eventType, self::EVENT_TYPES, true)) {
            error_log("Invalid session audit event type: $eventType");
            return;
        }

        $ipAddress = AuthMiddleware::getClientIp();
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO session_audit_log (user_id, event_type, session_id, ip_address, user_agent, details) 
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId,
            $eventType,
            $sessionId,
            $ipAddress,
            $userAgent,
            json_encode($details, JSON_UNESCAPED_SLASHES),
        ]);
    }

    /**
     * Log session creation (login).
     */
    public static function logCreate(int $userId, string $sessionId, bool $rememberMe = false): void
    {
        self::log($userId, 'create', $sessionId, ['remember_me' => $rememberMe]);
    }

    /**
     * Log session destruction (logout).
     */
    public static function logDestroy(int $userId, string $sessionId, string $reason = 'user_logout'): void
    {
        self::log($userId, 'destroy', $sessionId, ['reason' => $reason]);
    }

    /**
     * Log session refresh (explicit or sliding).
     */
    public static function logRefresh(int $userId, string $sessionId, string $method = 'sliding'): void
    {
        self::log($userId, 'refresh', $sessionId, ['method' => $method]);
    }

    /**
     * Log session expiration (timeout).
     */
    public static function logExpire(int $userId, string $sessionId, int $inactivitySeconds): void
    {
        self::log($userId, 'expire', $sessionId, ['inactivity_seconds' => $inactivitySeconds]);
    }

    /**
     * Log session revocation.
     */
    public static function logRevoke(int $userId, string $sessionId, string $reason, ?string $revokedBy = null): void
    {
        self::log($userId, 'revoke', $sessionId, [
            'reason' => $reason,
            'revoked_by' => $revokedBy,
        ]);
    }

    /**
     * Log remember token usage (auto-login).
     */
    public static function logRememberUsed(int $userId, string $sessionId, int $tokenAgeDays): void
    {
        self::log($userId, 'remember_used', $sessionId, ['token_age_days' => $tokenAgeDays]);
    }

    /**
     * Get audit log for a user (paginated).
     *
     * @param int $userId
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public static function getForUser(int $userId, int $limit = 50, int $offset = 0): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT audit_id, event_type, session_id, ip_address, user_agent, details, created_at
             FROM session_audit_log
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?'
        );
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll() ?: [];
    }

    /**
     * Clean up old audit logs (e.g., older than 90 days).
     *
     * @param int $daysToKeep
     * @return int Number of deleted logs
     */
    public static function cleanupOld(int $daysToKeep = 90): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'DELETE FROM session_audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'
        );
        $stmt->execute([$daysToKeep]);
        return $stmt->rowCount();
    }
}