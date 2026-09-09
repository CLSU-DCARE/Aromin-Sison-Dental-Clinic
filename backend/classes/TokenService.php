<?php
/**
 * Password reset token service: Aromin-Sison Dental Clinic System.
 *
 * Generates, stores, and validates time-limited password reset tokens.
 * Usage:
 *   $raw = TokenService::generate();
 *   $hash = TokenService::hash($raw);
 *   TokenService::store($userId, $hash);
 *   $valid = TokenService::validate($hash);
 *   TokenService::markUsed($userId);
 */

namespace ASDC;

use PDO;

class TokenService
{
    private const EXPIRY_SECONDS = 3600; // 1 hour

    public static function generate(): string
    {
        return bin2hex(random_bytes(32));
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function store(PDO $pdo, int $userId, string $hash): void
    {
        $stmt = $pdo->prepare(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
        );
        $stmt->execute([$userId, $hash, self::EXPIRY_SECONDS]);
    }

    public static function validate(PDO $pdo, string $hash): ?int
    {
        $stmt = $pdo->prepare(
            'SELECT reset_id, user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL'
        );
        $stmt->execute([$hash]);
        $row = $stmt->fetch();
        return $row ? (int) $row['user_id'] : null;
    }

    public static function markUsed(PDO $pdo, int $userId): void
    {
        $stmt = $pdo->prepare(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL'
        );
        $stmt->execute([$userId]);
    }
}
