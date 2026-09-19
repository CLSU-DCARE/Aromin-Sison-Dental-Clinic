<?php
/**
 * CSRF protection: Aromin-Sison Dental Clinic System.
 *
 * Synchronizer Token Pattern using session-stored tokens.
 * Frontend reads token via GET /backend/api/auth/csrf-token.php,
 * then attaches it as X-CSRF-Token on state-changing requests.
 * 
 * Features:
 * - 256-bit random tokens
 * - Periodic rotation (every 6 hours)
 * - Timing-safe validation
 * - Auto-regeneration on login and role change
 *
 * Usage:
 *   $token = CsrfToken::generate();
 *   CsrfToken::requireValid();
 */

namespace ASDC;

class CsrfToken
{
    private const SESSION_KEY = 'csrf_token';
    private const SESSION_KEY_ISSUED = 'csrf_issued_at';
    private const HEADER_NAME = 'HTTP_X_CSRF_TOKEN';
    private const ROTATION_INTERVAL_SECONDS = 6 * 3600; // 6 hours

    /**
     * Generate a new CSRF token and store it in the session.
     */
    public static function generate(): string
    {
        AuthMiddleware::secureSessionStart();
        $token = bin2hex(random_bytes(32));
        $_SESSION[self::SESSION_KEY] = $token;
        $_SESSION[self::SESSION_KEY_ISSUED] = time();
        return $token;
    }

    /**
     * Get the current CSRF token (generates one if none exists or rotates if expired).
     */
    public static function get(): string
    {
        AuthMiddleware::secureSessionStart();
        
        if (empty($_SESSION[self::SESSION_KEY])) {
            return self::generate();
        }

        // Check if token needs rotation (6 hours)
        $issuedAt = $_SESSION[self::SESSION_KEY_ISSUED] ?? 0;
        if (time() - $issuedAt > self::ROTATION_INTERVAL_SECONDS) {
            return self::generate();
        }

        return $_SESSION[self::SESSION_KEY];
    }

    /**
     * Validate the CSRF token from the request header against the session.
     */
    public static function validate(): bool
    {
        AuthMiddleware::secureSessionStart();

        $sessionToken = $_SESSION[self::SESSION_KEY] ?? '';
        if ($sessionToken === '') {
            return false;
        }

        $headerToken = $_SERVER[self::HEADER_NAME] ?? '';
        if ($headerToken === '') {
            return false;
        }

        return hash_equals($sessionToken, $headerToken);
    }

    /**
     * Require a valid CSRF token; exit with 403 if invalid.
     */
    public static function requireValid(): void
    {
        if (!self::validate()) {
            \ASDC\ApiResponse::error(403, 'INVALID_CSRF_TOKEN', 'Invalid or missing CSRF token.');
        }
    }

    /**
     * Regenerate the CSRF token (e.g., after login).
     */
    public static function regenerate(): string
    {
        return self::generate();
    }

    /**
     * Force token regeneration (e.g., on role change).
     */
    public static function forceRegenerate(): string
    {
        return self::generate();
    }

    /**
     * Get the rotation interval in seconds.
     */
    public static function getRotationInterval(): int
    {
        return self::ROTATION_INTERVAL_SECONDS;
    }
}