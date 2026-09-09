<?php
/**
 * CSRF protection: Aromin-Sison Dental Clinic System.
 *
 * Synchronizer Token Pattern using session-stored tokens.
 * Frontend reads token via GET /backend/api/auth/csrf-token.php,
 * then attaches it as X-CSRF-Token on state-changing requests.
 *
 * Usage:
 *   $token = CsrfToken::generate();
 *   CsrfToken::requireValid();
 */

namespace ASDC;

class CsrfToken
{
    private const SESSION_KEY = 'csrf_token';
    private const HEADER_NAME = 'HTTP_X_CSRF_TOKEN';

    /**
     * Generate a new CSRF token and store it in the session.
     */
    public static function generate(): string
    {
        AuthMiddleware::secureSessionStart();
        $token = bin2hex(random_bytes(32));
        $_SESSION[self::SESSION_KEY] = $token;
        return $token;
    }

    /**
     * Get the current CSRF token (generates one if none exists).
     */
    public static function get(): string
    {
        AuthMiddleware::secureSessionStart();
        if (empty($_SESSION[self::SESSION_KEY])) {
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
            http_response_code(403);
            echo json_encode(['error' => 'Invalid or missing CSRF token.']);
            exit;
        }
    }

    /**
     * Regenerate the CSRF token (e.g., after login).
     */
    public static function regenerate(): string
    {
        return self::generate();
    }
}
