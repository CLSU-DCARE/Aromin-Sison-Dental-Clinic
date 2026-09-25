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
    // After a token is used, the old one still works for this many seconds.
    // This covers several tabs (or a slow network) using the same token at the same moment.
    private const ROTATION_GRACE_SECONDS = 60;
    private const MAX_TOKENS_PER_USER = 10;

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

        $pdo = Database::pdo();

        // Housekeeping: drop this user's expired tokens, and keep only the newest few
        // so a user who logs in on many devices cannot fill the table.
        $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ? AND expires_at <= NOW()')->execute([$userId]);
        $pdo->prepare(
            'DELETE FROM remember_tokens WHERE user_id = ? AND token_id NOT IN (
                 SELECT token_id FROM (
                     SELECT token_id FROM remember_tokens WHERE user_id = ? ORDER BY token_id DESC LIMIT ' . (self::MAX_TOKENS_PER_USER - 1) . '
                 ) newest
             )'
        )->execute([$userId, $userId]);

        // The expiry uses the database clock (NOW()), the same clock that checks it later,
        // so PHP and MySQL time zones can never disagree about when a token ends.
        $stmt = $pdo->prepare(
            'INSERT INTO remember_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
             VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))'
        );
        $stmt->execute([$userId, $tokenHash, $userAgent, $ipAddress, $days]);

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
     * Use a remember token to sign in, and swap it for a fresh one.
     *
     * Every use gives the browser a new token with a full new lifetime, so people who
     * use the system regularly are never asked to log in again. The old token is kept
     * for a short grace period (not deleted at once) so that two tabs opening at the
     * same moment do not fight over it and kick one tab back to the login page.
     *
     * @return array{user_id:int,new_token:?string}|null null when the token is not valid.
     *         new_token is null when the token was already swapped a moment ago
     *         (the browser already holds the newer one).
     */
    public static function rotate(string $token, ?string $userAgent = null, ?string $ipAddress = null): ?array
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }

        $tokenHash = hash('sha256', $token);
        $pdo = Database::pdo();

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'SELECT token_id, user_id, (expires_at > DATE_ADD(NOW(), INTERVAL ? SECOND)) AS is_fresh
                 FROM remember_tokens
                 WHERE token_hash = ? AND expires_at > NOW()
                 FOR UPDATE'
            );
            $stmt->execute([self::ROTATION_GRACE_SECONDS, $tokenHash]);
            $row = $stmt->fetch();

            if (!$row) {
                $pdo->rollBack();
                return null;
            }

            $newToken = null;
            if ((int) $row['is_fresh'] === 1) {
                // First use: start the grace period on the old token, then hand out a new one.
                $pdo->prepare(
                    'UPDATE remember_tokens SET expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE token_id = ?'
                )->execute([self::ROTATION_GRACE_SECONDS, $row['token_id']]);
                $newToken = self::generate((int) $row['user_id'], $userAgent, $ipAddress);
            }

            $pdo->commit();
            return ['user_id' => (int) $row['user_id'], 'new_token' => $newToken];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('Remember token rotation failed: ' . $e->getMessage());
            return null;
        }
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
     * Delete a user's remember tokens except the one this browser is using.
     * Used by "sign out other devices" so those devices cannot sign back in silently.
     */
    public static function deleteAllForUserExcept(int $userId, ?string $keepToken): int
    {
        $pdo = Database::pdo();
        if ($keepToken && preg_match('/^[a-f0-9]{64}$/', $keepToken)) {
            $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ? AND token_hash != ?');
            $stmt->execute([$userId, hash('sha256', $keepToken)]);
        } else {
            $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ?');
            $stmt->execute([$userId]);
        }
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
        $secure = AuthMiddleware::isHttps();
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
        $secure = AuthMiddleware::isHttps();
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