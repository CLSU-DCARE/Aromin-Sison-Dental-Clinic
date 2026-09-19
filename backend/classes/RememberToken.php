<?php
/**
 * Remember Me Token: Aromin-Sison Dental Clinic System.
 *
 * Handles long-lived (30-day) remember tokens for persistent login.
 * Tokens are stored hashed in database, plaintext only in HttpOnly cookie.
 */

namespace ASDC;

class RememberToken
{
    private const TOKEN_BYTES = 32; // 256-bit token
    private const COOKIE_NAME = 'ASDC_REMEMBER';
    private const DEFAULT_DAYS = 30;

    /**
     * Generate a new remember token and store its hash in the database.
     *
     * @param int $userId
     * @param string|null $userAgent
     * @param string|null $ipAddress
     * @param int $days Token lifetime in days
     * @return string Plaintext token (only returned once, store in cookie)
     */
    public static function generate(int $userId, ?string $userAgent = null, ?string $ipAddress = null, int $days = self::DEFAULT_DAYS): string
    {
        $token = bin2hex(random_bytes(self::TOKEN_BYTES));
        $tokenHash = hash('sha256', $token);
        $expiresAt = date('Y-m-d H:i:s', time() + $days * 86400);

        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO remember_tokens (user_id, token_hash, user_agent, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $tokenHash, $userAgent, $ipAddress, $expiresAt]);

        return $token;
    }

    /**
     * Validate a remember token and return the user_id if valid.
     *
     * @param string $token Plaintext token from cookie
     * @return int|null User ID if valid, null otherwise
     */
    public static function validate(string $token): ?int
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }

        $tokenHash = hash('sha256', $token);
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT user_id FROM remember_tokens WHERE token_hash = ? AND expires_at > NOW()'
        );
        $stmt->execute([$tokenHash]);
        $row = $stmt->fetch();

        return $row ? (int) $row['user_id'] : null;
    }

    /**
     * Delete a remember token (on logout or token rotation).
     *
     * @param string $token Plaintext token
     * @return bool
     */
    public static function delete(string $token): bool
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            return false;
        }

        $tokenHash = hash('sha256', $token);
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE token_hash = ?');
        $stmt->execute([$tokenHash]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Delete all remember tokens for a user (e.g., on password change, revoke all sessions).
     *
     * @param int $userId
     * @return int Number of deleted tokens
     */
    public static function deleteAllForUser(int $userId): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->rowCount();
    }

    /**
     * Clean up expired tokens (can be run via cron).
     *
     * @return int Number of deleted tokens
     */
    public static function cleanupExpired(): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE expires_at <= NOW()');
        $stmt->execute();
        return $stmt->rowCount();
    }

    /**
     * Set the remember cookie on the response.
     *
     * @param string $token Plaintext token
     * @param int $days Cookie lifetime in days
     */
    public static function setCookie(string $token, int $days = self::DEFAULT_DAYS): void
    {
        $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        setcookie(self::COOKIE_NAME, $token, [
            'expires' => time() + $days * 86400,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    /**
     * Clear the remember cookie.
     */
    public static function clearCookie(): void
    {
        $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        setcookie(self::COOKIE_NAME, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    /**
     * Get the token from the request cookie.
     *
     * @return string|null
     */
    public static function getCookieToken(): ?string
    {
        return $_COOKIE[self::COOKIE_NAME] ?? null;
    }
}