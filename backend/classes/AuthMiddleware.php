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
    private const SESSION_TIMEOUT = 1800; // 30 minutes of inactivity
    private const SESSION_WARNING_BEFORE = 120; // 2 minutes
    private const SESSION_NAME = 'ASDC_SESSION';

    /**
     * True when the request came in over HTTPS (also when a proxy in front of
     * Apache terminates HTTPS and tells us so). Used to decide the Secure flag
     * on cookies.
     */
    public static function isHttps(): bool
    {
        if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
            return true;
        }
        return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    }

    public static function secureSessionStart(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        // Strict mode: PHP refuses a session ID the server did not create.
        // This stops "session fixation" (an attacker choosing the ID for us).
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        // PHP deletes session files older than this. It must be LONGER than our
        // 30-minute idle timeout, or a session could vanish before it "expires".
        ini_set('session.gc_maxlifetime', (string) (self::SESSION_TIMEOUT * 2));

        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => self::isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_name(self::SESSION_NAME);
        session_start();
    }

    /**
     * Throw away the server-side session data.
     * The cookie is only deleted on an explicit logout ($clearCookie = true).
     * Otherwise a late "session ended" response from one tab could erase the
     * fresh cookie that another tab just received.
     */
    public static function destroySession(bool $clearCookie = false): void
    {
        $_SESSION = [];
        if ($clearCookie && ini_get('session.use_cookies') && !headers_sent()) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires'  => time() - 42000,
                'path'     => $params['path'],
                'domain'   => $params['domain'],
                'secure'   => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    /**
     * Background requests (like the dashboard's 10-second auto-refresh) send
     * "X-ASDC-Passive: 1". They must not count as user activity, otherwise an
     * unattended screen would never time out.
     */
    public static function isPassiveRequest(): bool
    {
        return ($_SERVER['HTTP_X_ASDC_PASSIVE'] ?? '') === '1';
    }

    /**
     * Check the current session without ending the request.
     * Returns null when the session is fine, or the problem to report.
     *
     * @return array{status:int,code:string,message:string}|null
     */
    public static function inspectSession(bool $touch = true): ?array
    {
        $notSignedIn = ['status' => 401, 'code' => 'UNAUTHENTICATED', 'message' => 'Authentication required. Please log in.'];

        // No session cookie at all means nobody is signed in. Do not start a
        // session (and so do not hand out a cookie): a "who am I?" question from
        // the login page must never change the browser's cookies, or a late
        // answer could overwrite the cookie of a login that finished meanwhile.
        if (session_status() !== PHP_SESSION_ACTIVE && !isset($_COOKIE[self::SESSION_NAME])) {
            return $notSignedIn;
        }

        self::secureSessionStart();

        if (empty($_SESSION['user_id'])) {
            // An unknown or old cookie made PHP create a fresh empty session: throw it away quietly.
            if (($_COOKIE[self::SESSION_NAME] ?? '') !== session_id()) {
                session_destroy();
                header_remove('Set-Cookie');
            }
            return $notSignedIn;
        }

        $sessionId = session_id();
        $userId = (int) $_SESSION['user_id'];

        // 1) Idle timeout. A missing timestamp counts as expired (safer).
        $lastActivity = (int) ($_SESSION['last_activity'] ?? 0);
        if ((time() - $lastActivity) > self::SESSION_TIMEOUT) {
            SessionAudit::logExpire($userId, $sessionId, time() - $lastActivity);
            SessionManager::removeSession($userId, $sessionId);
            return ['status' => 401, 'code' => 'SESSION_EXPIRED', 'message' => 'Session expired. Please log in again.'];
        }

        // 2) The session's row in active_sessions is how sign-out-from-another-device,
        //    the device limit and password resets take effect.
        if (!SessionManager::isSessionValid($userId, $sessionId)) {
            if (!empty($_SESSION['session_registered'])) {
                // This login was tracked and its row is gone: it was revoked on purpose.
                return ['status' => 401, 'code' => 'SESSION_REVOKED', 'message' => 'This session has been revoked. Please log in again.'];
            }
            // An older login from before tracking existed (or a tracking table that was
            // reset): repair the row instead of signing a valid person out.
            SessionManager::registerSession(
                $userId,
                $sessionId,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                self::getClientIp(),
                !empty($_SESSION['remember_me'])
            );
            $_SESSION['session_registered'] = true;
        }

        // 3) A deactivated account or a changed role must not keep access through an old session.
        $stmt = Database::pdo()->prepare('SELECT role FROM users WHERE user_id=? AND is_active=1');
        $stmt->execute([$userId]);
        $role = $stmt->fetchColumn();
        if (!$role || $role !== ($_SESSION['role'] ?? null)) {
            SessionManager::removeSession($userId, $sessionId);
            return ['status' => 401, 'code' => 'SESSION_EXPIRED', 'message' => 'Your session has ended. Please sign in again.'];
        }

        if ($touch) {
            self::touch();
        }
        return null;
    }

    /** Mark "the user is active right now" (slides the 30-minute window forward). */
    public static function touch(): void
    {
        if (empty($_SESSION['user_id'])) {
            return;
        }
        $_SESSION['last_activity'] = time();
        SessionManager::updateActivity(session_id());
    }

    /**
     * Stop the request with a 401 unless there is a valid session.
     *
     * @param bool|null $touch true = count as activity, false = do not,
     *                         null (default) = count unless the request is passive.
     */
    public static function requireLogin(?bool $touch = null): void
    {
        $problem = self::inspectSession($touch ?? !self::isPassiveRequest());

        if ($problem !== null) {
            if ($problem['code'] !== 'UNAUTHENTICATED') {
                self::destroySession();
            }
            ApiResponse::error($problem['status'], $problem['code'], $problem['message']);
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
