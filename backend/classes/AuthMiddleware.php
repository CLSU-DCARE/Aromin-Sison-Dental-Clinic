<?php
/**
 * Authentication middleware: Aromin-Sison Dental Clinic System.
 *
 * Handles session lifecycle and role-based access control.
 * Usage:
 *   AuthMiddleware::secureSessionStart();
 *   AuthMiddleware::requireLogin();
 *   AuthMiddleware::requireRole('receptionist', 'dentist');
 */

namespace ASDC;

class AuthMiddleware
{
    private const SESSION_TIMEOUT = 1800; // 30 minutes
    private const SESSION_WARNING_BEFORE = 120; // 2 minutes

    public static function secureSessionStart(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_name('ASDC_SESSION');
        session_start();
    }

    public static function requireLogin(): void
    {
        self::secureSessionStart();

        if (empty($_SESSION['user_id'])) {
            ApiResponse::error(401, 'UNAUTHENTICATED', 'Authentication required. Please log in.');
        }

        if (!empty($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > self::SESSION_TIMEOUT) {
            // Session expired - log audit
            $sessionId = session_id();
            $userId = (int) $_SESSION['user_id'];
            $inactivitySeconds = time() - $_SESSION['last_activity'];
            SessionAudit::logExpire($userId, $sessionId, $inactivitySeconds);
            
            $_SESSION = [];
            session_destroy();
            ApiResponse::error(401, 'SESSION_EXPIRED', 'Session expired. Please log in again.');
        }

        // Keep the PHP session as the source of truth. active_sessions is
        // tracking metadata and can be stale after migrations, local resets,
        // or cleanup; repair it instead of logging out a valid session.
        $sessionId = session_id();
        $userId = (int) $_SESSION['user_id'];
        if (!SessionManager::isSessionValid($userId, $sessionId)) {
            SessionManager::registerSession(
                $userId,
                $sessionId,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                self::getClientIp(),
                !empty($_SESSION['remember_me'])
            );
        }

        $_SESSION['last_activity'] = time();
        
        // Update activity in active_sessions table
        SessionManager::updateActivity($sessionId);

        // A revoked account or changed role must not retain access through an old session.
        $stmt = Database::pdo()->prepare('SELECT role FROM users WHERE user_id=? AND is_active=1');
        $stmt->execute([$userId]);
        $role = $stmt->fetchColumn();
        if (!$role || $role !== ($_SESSION['role'] ?? null)) {
            // Role changed - force CSRF regeneration
            CsrfToken::forceRegenerate();
            $_SESSION = []; session_destroy();
            ApiResponse::error(401, 'SESSION_EXPIRED', 'Your session has ended. Please sign in again.');
        }
    }

    public static function requireRole(string ...$roles): void
    {
        self::requireLogin();

        if (!in_array($_SESSION['role'], $roles, true)) {
            ApiResponse::error(403, 'FORBIDDEN', 'Forbidden: you do not have permission to access this resource.');
        }
    }

    public static function userId(): ?int
    {
        self::secureSessionStart();
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    }

    public static function role(): ?string
    {
        self::secureSessionStart();
        return $_SESSION['role'] ?? null;
    }

    public static function isLoggedIn(): bool
    {
        self::secureSessionStart();
        return !empty($_SESSION['user_id']);
    }

    public static function getClientIp(): string
    {
        $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if ($forwarded !== '') {
            $ip = trim(explode(',', $forwarded)[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
        $real = $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return filter_var($real, FILTER_VALIDATE_IP) ? $real : '0.0.0.0';
    }

    public static function getSessionTimeout(): int
    {
        return self::SESSION_TIMEOUT;
    }

    public static function getSessionWarningBefore(): int
    {
        return self::SESSION_WARNING_BEFORE;
    }

    public static function getTimeUntilExpiry(): int
    {
        if (empty($_SESSION['last_activity'])) {
            return self::SESSION_TIMEOUT;
        }
        $elapsed = time() - $_SESSION['last_activity'];
        return max(0, self::SESSION_TIMEOUT - $elapsed);
    }

    public static function isSessionExpiringSoon(): bool
    {
        return self::getTimeUntilExpiry() <= self::SESSION_WARNING_BEFORE;
    }
}
