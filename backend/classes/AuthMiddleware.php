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
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required. Please log in.']);
            exit;
        }

        if (!empty($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > self::SESSION_TIMEOUT) {
            $_SESSION = [];
            session_destroy();
            http_response_code(401);
            echo json_encode(['error' => 'Session expired. Please log in again.']);
            exit;
        }

        $_SESSION['last_activity'] = time();
    }

    public static function requireRole(string ...$roles): void
    {
        self::requireLogin();

        if (!in_array($_SESSION['role'], $roles, true)) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden: you do not have permission to access this resource.']);
            exit;
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
}
