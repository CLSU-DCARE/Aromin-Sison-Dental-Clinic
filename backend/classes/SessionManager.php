<?php
/**
 * SessionManager: Aromin-Sison Dental Clinic System.
 *
 * Manages active sessions for concurrent session limiting and audit logging.
 * Tracks all active sessions per user, enforces max concurrent sessions.
 */

namespace ASDC;

class SessionManager
{
    private const MAX_CONCURRENT_SESSIONS = 3;
    // The idle timeout lives in AuthMiddleware so PHP and the database always agree.
    private static function timeout(): int
    {
        return AuthMiddleware::getSessionTimeout();
    }

    /**
     * Register a new active session for a user.
     *
     * @param int $userId
     * @param string $sessionId
     * @param string|null $userAgent
     * @param string|null $ipAddress
     * @param bool $rememberTokenUsed
     * @return void
     */
    public static function registerSession(
        int $userId,
        string $sessionId,
        ?string $userAgent = null,
        ?string $ipAddress = null,
        bool $rememberTokenUsed = false
    ): void {
        $pdo = Database::pdo();

        // Clean up old/expired sessions for this user first
        self::cleanupExpiredSessions($userId);

        // Make room: if the user already has the maximum number of OTHER live
        // sessions, sign out the least recently used ones (the new one wins).
        $stmt = $pdo->prepare(
            'SELECT session_id FROM active_sessions
             WHERE user_id = ? AND session_id != ?
             ORDER BY last_activity ASC'
        );
        $stmt->execute([$userId, $sessionId]);
        $others = $stmt->fetchAll(\PDO::FETCH_COLUMN);
        $excess = count($others) - (self::MAX_CONCURRENT_SESSIONS - 1);
        for ($i = 0; $i < $excess; $i++) {
            self::revokeSession($userId, $others[$i], 'session_limit');
        }

        // Insert new session
        $stmt = $pdo->prepare(
            'INSERT INTO active_sessions (session_id, user_id, user_agent, ip_address, remember_token_used, is_current) 
             VALUES (?, ?, ?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE 
                 user_agent = VALUES(user_agent),
                 ip_address = VALUES(ip_address),
                 last_activity = NOW(),
                 is_current = TRUE,
                 remember_token_used = VALUES(remember_token_used)'
        );
        $stmt->execute([$sessionId, $userId, $userAgent, $ipAddress, (int) $rememberTokenUsed]);
    }

    /**
     * Update last activity for a session.
     *
     * @param string $sessionId
     * @return bool True if session was found and updated
     */
    public static function updateActivity(string $sessionId): bool
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'UPDATE active_sessions SET last_activity = NOW() WHERE session_id = ?'
        );
        $stmt->execute([$sessionId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Mark a session as no longer current (e.g., on logout from this session).
     *
     * @param string $sessionId
     * @return bool
     */
    public static function markNotCurrent(string $sessionId): bool
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'UPDATE active_sessions SET is_current = FALSE WHERE session_id = ?'
        );
        $stmt->execute([$sessionId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Revoke (delete) a specific session.
     *
     * @param int $userId
     * @param string $sessionId
     * @param string $reason Reason for revocation
     * @return bool True if session was revoked
     */
    public static function revokeSession(int $userId, string $sessionId, string $reason = 'user_revoke'): bool
    {
        $revoked = self::removeSession($userId, $sessionId);

        if ($revoked) {
            SessionAudit::logRevoke($userId, $sessionId, $reason);
        }

        return $revoked;
    }

    /**
     * Delete a session row without writing an audit entry.
     * Callers (logout, expiry) write their own, more specific audit entry.
     */
    public static function removeSession(int $userId, string $sessionId): bool
    {
        $stmt = Database::pdo()->prepare(
            'DELETE FROM active_sessions WHERE user_id = ? AND session_id = ?'
        );
        $stmt->execute([$userId, $sessionId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * A safe, one-way label for a session. The real PHP session ID is the
     * login secret, so it is never sent to the browser; this label is.
     */
    public static function sessionRef(string $sessionId): string
    {
        return hash('sha256', $sessionId);
    }

    /**
     * Revoke one of the user's sessions using its safe label (see sessionRef).
     */
    public static function revokeByRef(int $userId, string $ref, ?string $exceptSessionId = null, string $reason = 'user_revoke'): ?bool
    {
        foreach (self::getActiveSessions($userId) as $row) {
            if (!hash_equals(self::sessionRef($row['session_id']), $ref)) {
                continue;
            }
            if ($exceptSessionId !== null && $row['session_id'] === $exceptSessionId) {
                return null; // that is the current session
            }
            return self::revokeSession($userId, $row['session_id'], $reason);
        }
        return false;
    }

    /**
     * Revoke all sessions for a user except the specified one.
     *
     * @param int $userId
     * @param string $exceptSessionId Session ID to keep
     * @return int Number of revoked sessions
     */
    public static function revokeAllOtherSessions(int $userId, string $exceptSessionId): int
    {
        $pdo = Database::pdo();
        
        // Get sessions to be revoked for audit logging
        $stmt = $pdo->prepare(
            'SELECT session_id FROM active_sessions WHERE user_id = ? AND session_id != ?'
        );
        $stmt->execute([$userId, $exceptSessionId]);
        $sessionsToRevoke = $stmt->fetchAll();
        
        $stmt = $pdo->prepare(
            'DELETE FROM active_sessions WHERE user_id = ? AND session_id != ?'
        );
        $stmt->execute([$userId, $exceptSessionId]);
        $count = $stmt->rowCount();
        
        // Audit log for each revoked session
        foreach ($sessionsToRevoke as $session) {
            SessionAudit::logRevoke($userId, $session['session_id'], 'revoke_others');
        }
        
        return $count;
    }

    /**
     * Revoke all sessions for a user.
     *
     * @param int $userId
     * @return int Number of revoked sessions
     */
    public static function revokeAllSessions(int $userId): int
    {
        $pdo = Database::pdo();
        
        // Get sessions to be revoked for audit logging
        $stmt = $pdo->prepare('SELECT session_id FROM active_sessions WHERE user_id = ?');
        $stmt->execute([$userId]);
        $sessionsToRevoke = $stmt->fetchAll();
        
        $stmt = $pdo->prepare('DELETE FROM active_sessions WHERE user_id = ?');
        $stmt->execute([$userId]);
        $count = $stmt->rowCount();
        
        // Audit log for each revoked session
        foreach ($sessionsToRevoke as $session) {
            SessionAudit::logRevoke($userId, $session['session_id'], 'revoke_all');
        }
        
        return $count;
    }

    /**
     * Get all active sessions for a user.
     *
     * @param int $userId
     * @return array<array{session_id: string, user_agent: string|null, ip_address: string|null, created_at: string, last_activity: string, is_current: bool, remember_token_used: bool}>
     */
    public static function getActiveSessions(int $userId): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT session_id, user_agent, ip_address, created_at, last_activity, is_current, remember_token_used 
             FROM active_sessions 
             WHERE user_id = ? 
             AND last_activity > DATE_SUB(NOW(), INTERVAL ? SECOND)
             ORDER BY last_activity DESC'
        );
        $stmt->execute([$userId, self::timeout()]);
        return $stmt->fetchAll() ?: [];
    }

    /**
     * Check if a session is still valid (not revoked, not expired).
     *
     * @param int $userId
     * @param string $sessionId
     * @return bool
     */
    public static function isSessionValid(int $userId, string $sessionId): bool
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT 1 FROM active_sessions 
             WHERE user_id = ? AND session_id = ? 
             AND last_activity > DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$userId, $sessionId, self::timeout()]);
        return (bool) $stmt->fetchColumn();
    }

    /**
     * Get count of active (non-expired) sessions for a user.
     *
     * @param int $userId
     * @return int
     */
    public static function getActiveSessionCount(int $userId): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM active_sessions 
             WHERE user_id = ? 
             AND last_activity > DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$userId, self::timeout()]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Clean up expired sessions for a user.
     *
     * @param int $userId
     * @return int Number of cleaned up sessions
     */
    public static function cleanupExpiredSessions(int $userId): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'DELETE FROM active_sessions 
             WHERE user_id = ? 
             AND last_activity <= DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$userId, self::timeout()]);
        return $stmt->rowCount();
    }

    /**
     * Clean up all expired sessions globally (for cron job).
     *
     * @return int Number of cleaned up sessions
     */
    public static function cleanupAllExpired(): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'DELETE FROM active_sessions 
             WHERE last_activity <= DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([self::timeout()]);
        return $stmt->rowCount();
    }

    /**
     * Get the maximum allowed concurrent sessions.
     *
     * @return int
     */
    public static function getMaxConcurrentSessions(): int
    {
        return self::MAX_CONCURRENT_SESSIONS;
    }
}