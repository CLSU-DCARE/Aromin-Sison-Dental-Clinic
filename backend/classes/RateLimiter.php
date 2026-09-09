<?php
/**
 * Rate limiter: Aromin-Sison Dental Clinic System.
 *
 * Database-backed dual-key rate limiting (email + IP).
 * Falls back to session-only if the database is unavailable.
 *
 * Usage:
 *   RateLimiter::record('login:john@example.com', 5, 900);
 *   $remaining = RateLimiter::remaining('login:john@example.com', 5, 900);
 *   RateLimiter::reset('login:john@example.com');
 */

namespace ASDC;

class RateLimiter
{
    private const LOCKOUT_SECONDS = 900;

    /**
     * Check if a key is rate-limited. Returns seconds remaining if limited, 0 otherwise.
     */
    public static function remaining(string $key, int $maxAttempts, int $windowSeconds): int
    {
        $rows = self::fetch([$key]);
        if ($rows === null) {
            return self::sessionRemaining($key, $maxAttempts, $windowSeconds);
        }

        $row = $rows[$key] ?? null;
        if (!$row) {
            return $maxAttempts;
        }

        if ($row['lockout_until'] && strtotime($row['lockout_until']) > time()) {
            return strtotime($row['lockout_until']) - time();
        }

        return max(0, $maxAttempts - $row['attempts']);
    }

    /**
     * Record a failed attempt. Locks out after maxAttempts.
     */
    public static function record(string $key, int $maxAttempts, int $windowSeconds): void
    {
        $rows = self::fetch([$key]);
        if ($rows === null) {
            self::sessionRecord($key, $maxAttempts, $windowSeconds);
            return;
        }

        $row = $rows[$key] ?? null;
        $pdo = Database::pdo();

        if (!$row) {
            $stmt = $pdo->prepare(
                'INSERT INTO rate_limits (identifier, attempts, lockout_until, window_started_at)
                 VALUES (?, 1, NULL, NOW())'
            );
            $stmt->execute([$key]);
            return;
        }

        if ($row['lockout_until'] && strtotime($row['lockout_until']) > time()) {
            return;
        }

        $attempts = $row['attempts'] + 1;
        if ($attempts >= $maxAttempts) {
            $stmt = $pdo->prepare(
                'UPDATE rate_limits SET attempts=?, lockout_until=DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE identifier=?'
            );
            $stmt->execute([$attempts, $windowSeconds, $key]);
        } else {
            $stmt = $pdo->prepare('UPDATE rate_limits SET attempts=? WHERE identifier=?');
            $stmt->execute([$attempts, $key]);
        }
    }

    /**
     * Reset a key (e.g., after successful login).
     */
    public static function reset(string $key): void
    {
        try {
            $pdo = Database::pdo();
            $pdo->prepare('DELETE FROM rate_limits WHERE identifier=?')->execute([$key]);
        } catch (\Throwable $e) {
            // Ignore DB errors on reset
        }

        AuthMiddleware::secureSessionStart();
        unset($_SESSION['rate_limits'][$key]);
    }

    /**
     * Get the remaining lockout time in seconds. Returns 0 if not locked out.
     */
    public static function lockoutRemaining(string $key): int
    {
        $rows = self::fetch([$key]);
        if ($rows === null) {
            return self::sessionLockoutRemaining($key);
        }

        $row = $rows[$key] ?? null;
        if (!$row || !$row['lockout_until']) {
            return 0;
        }

        $remaining = strtotime($row['lockout_until']) - time();
        return max(0, $remaining);
    }

    /* ------------------------------------------------------------------
     *  Private helpers
     * ----------------------------------------------------------------*/

    private static function fetch(array $keys): ?array
    {
        try {
            $pdo = Database::pdo();
            $placeholders = implode(',', array_fill(0, count($keys), '?'));
            $stmt = $pdo->prepare(
                "SELECT identifier, attempts, lockout_until, window_started_at
                 FROM rate_limits WHERE identifier IN ({$placeholders})"
            );
            $stmt->execute($keys);
            $result = [];
            while ($row = $stmt->fetch()) {
                $result[$row['identifier']] = $row;
            }
            return $result;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function sessionRemaining(string $key, int $maxAttempts, int $windowSeconds): int
    {
        AuthMiddleware::secureSessionStart();
        $attempts = $_SESSION['rate_limits'][$key] ?? ['count' => 0, 'lockout_until' => 0];

        if (time() < ($attempts['lockout_until'] ?? 0)) {
            return ($attempts['lockout_until'] ?? 0) - time();
        }

        return max(0, $maxAttempts - ($attempts['count'] ?? 0));
    }

    private static function sessionRecord(string $key, int $maxAttempts, int $windowSeconds): void
    {
        AuthMiddleware::secureSessionStart();
        if (!isset($_SESSION['rate_limits'])) {
            $_SESSION['rate_limits'] = [];
        }

        $attempt = $_SESSION['rate_limits'][$key] ?? ['count' => 0, 'lockout_until' => 0];

        if (time() >= ($attempt['lockout_until'] ?? 0)) {
            $attempt['count'] = 0;
        }

        $attempt['count']++;

        if ($attempt['count'] >= $maxAttempts) {
            $attempt['lockout_until'] = time() + $windowSeconds;
            $attempt['count'] = 0;
        }

        $_SESSION['rate_limits'][$key] = $attempt;
    }

    private static function sessionLockoutRemaining(string $key): int
    {
        AuthMiddleware::secureSessionStart();
        $attempt = $_SESSION['rate_limits'][$key] ?? ['lockout_until' => 0];
        return max(0, ($attempt['lockout_until'] ?? 0) - time());
    }
}
