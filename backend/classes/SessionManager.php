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
    private const SESSION_TIMEOUT_SECONDS = 1800; // 30 minutes

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
        
        // Count current active sessions
        $count = self::getActiveSessionCount($userId);
        
        // If at limit, remove oldest non-current session
        if ($count >= self::MAX_CONCURRENT_SESSIONS) {
            self::revokeOldestSession($userId);
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
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'DELETE FROM active_sessions WHERE user_id = ? AND session_id = ?'
        );
        $stmt->execute([$userId, $sessionId]);
        $revoked = $stmt->rowCount() > 0;
        
        if ($revoked) {
            SessionAudit::logRevoke($userId, $sessionId, $reason);
        }
        
        return $revoked;
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
             ORDER BY last_activity DESC'
        );
        $stmt->execute([$userId]);
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
        $stmt->execute([$userId, $sessionId, self::SESSION_TIMEOUT_SECONDS]);
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
        $stmt->execute([$userId, self::SESSION_TIMEOUT_SECONDS]);
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
        $stmt->execute([$userId, self::SESSION_TIMEOUT_SECONDS]);
        return $stmt->rowCount();
    }

    /**
     * Revoke the oldest non-current session for a user.
     *
     * @param int $userId
     * @return bool True if a session was revoked
     */
    private static function revokeOldestSession(int $userId): bool
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'DELETE FROM active_sessions 
             WHERE user_id = ? AND is_current = FALSE
             ORDER BY last_activity ASC
             LIMIT 1'
        );
        $stmt->execute([$userId]);
        return $stmt->rowCount() > 0;
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
        $stmt->execute([self::SESSION_TIMEOUT_SECONDS]);
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