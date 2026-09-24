<?php
/**
 * CLI-only production maintenance task.
 *
 * Schedule daily from the operating system. It removes expired authentication
 * state and audit entries beyond the configured retention period; it never
 * modifies clinic, appointment, treatment, or payment data.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../backend/autoload.php';

try {
    $pdo = \ASDC\Database::pdo();
    $retention = filter_var(
        \ASDC\Env::get('ASDC_AUDIT_RETENTION_DAYS', '90'),
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 30, 'max_range' => 3650]]
    );
    $retention = $retention === false ? 90 : $retention;

    $expiredResetTokens = $pdo->exec('DELETE FROM password_reset_tokens WHERE expires_at <= NOW()');
    $expiredRememberTokens = \ASDC\RememberToken::cleanupExpired();
    $expiredSessions = \ASDC\SessionManager::cleanupAllExpired();
    $expiredAuditRows = \ASDC\SessionAudit::cleanupOld($retention);

    echo json_encode([
        'success' => true,
        'audit_retention_days' => $retention,
        'deleted' => [
            'password_reset_tokens' => $expiredResetTokens,
            'remember_tokens' => $expiredRememberTokens,
            'active_sessions' => $expiredSessions,
            'session_audit_log' => $expiredAuditRows,
        ],
    ], JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $e) {
    error_log('ASDC maintenance failed: ' . $e->getMessage());
    fwrite(STDERR, "ASDC maintenance failed. See the server error log.\n");
    exit(1);
}
