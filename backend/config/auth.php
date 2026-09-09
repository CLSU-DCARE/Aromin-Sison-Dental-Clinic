<?php
/**
 * Shared session / authorization helper: Aromin-Sison Dental Clinic System.
 *
 * Backward-compatible wrapper around ASDC\AuthMiddleware.
 * New code should use: \ASDC\AuthMiddleware::requireLogin();
 * Classes are auto-loaded via backend/autoload.php.
 */

if (!defined('SESSION_TIMEOUT')) {
    define('SESSION_TIMEOUT', 1800);
}

if (!function_exists('secure_session_start')) {
    function secure_session_start(): void
    {
        \ASDC\AuthMiddleware::secureSessionStart();
    }
}

if (!function_exists('require_login')) {
    function require_login(): void
    {
        \ASDC\AuthMiddleware::requireLogin();
    }
}

if (!function_exists('require_role')) {
    function require_role(string ...$roles): void
    {
        \ASDC\AuthMiddleware::requireRole(...$roles);
    }
}
