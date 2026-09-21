<?php
// Isolated reset-request regression tests: no database connection or email delivery.
namespace ASDC;

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; } // Test script: never run it from a web browser.

class AuthMiddleware
{
    public static function secureSessionStart(): void {}
    public static function getClientIp(): string { return '127.0.0.1'; }
}
class RateLimiter
{
    public static array $lockouts = [];
    public static array $recorded = [];
    public static function remaining(string $key, int $max, int $window): int
    {
        throw new \RuntimeException('Attempt allowance must not be interpreted as a lockout.');
    }
    public static function lockoutRemaining(string $key): int { return self::$lockouts[$key] ?? 0; }
    public static function record(string $key, int $max, int $window): void { self::$recorded[] = $key; }
}
class ResetStatement extends \PDOStatement
{
    public function __construct(private bool $userQuery = false) {}
    public function execute(?array $params = null): bool { return true; }
    public function fetch(int $mode = \PDO::FETCH_DEFAULT, int $cursorOrientation = \PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed
    {
        return $this->userQuery && Database::$accountExists
            ? ['user_id' => 1, 'email' => 'patient@example.invalid', 'full_name' => 'Test Patient'] : false;
    }
}
class ResetDatabase extends \PDO
{
    public function __construct() {}
    public function prepare(string $query, array $options = []): \PDOStatement|false
    {
        return new ResetStatement(str_contains($query, 'SELECT user_id'));
    }
    public function beginTransaction(): bool { return true; }
    public function commit(): bool { return true; }
}
class Database
{
    public static bool $accountExists = true;
    public static function pdo(): \PDO { return new ResetDatabase(); }
}
class TokenService
{
    public static int $stored = 0;
    public static function generate(): string { return str_repeat('a', 64); }
    public static function hash(string $token): string { return hash('sha256', $token); }
    public static function store(\PDO $pdo, int $userId, string $hash): void { self::$stored++; }
}
class Mailer
{
    public static int $calls = 0;
    public static function sendEmail(string $to, string $subject, string $body): array
    {
        self::$calls++;
        if (!str_contains($body, '/auth/reset-password.html?token=')) throw new \RuntimeException('Reset link missing.');
        return ['ok' => true];
    }
}
require_once __DIR__ . '/../backend/classes/Env.php';
require_once __DIR__ . '/../backend/classes/AuthService.php';

function check(bool $condition, string $message): void
{
    if (!$condition) throw new \RuntimeException($message);
}
$_SERVER['SCRIPT_NAME'] = '/clinic/backend/api/auth/forgot-password.php';
$_SERVER['HTTP_HOST'] = 'localhost';
$result = AuthService::forgotPassword('patient@example.invalid');
check($result['success'] === true && Mailer::$calls === 1 && TokenService::$stored === 1, 'First request must create a token and reach the mailer.');
check(count(RateLimiter::$recorded) === 2, 'Account and IP attempts must be tracked.');

RateLimiter::$lockouts['password_reset:patient@example.invalid'] = 120;
$result = AuthService::forgotPassword('patient@example.invalid');
check($result['code'] === 429 && Mailer::$calls === 1, 'Account lockout must block sending.');
RateLimiter::$lockouts = ['ip:127.0.0.1' => 120];
$result = AuthService::forgotPassword('patient@example.invalid');
check($result['code'] === 429 && Mailer::$calls === 1, 'IP lockout must block sending.');

RateLimiter::$lockouts = [];
Database::$accountExists = false;
$result = AuthService::forgotPassword('unknown@example.invalid');
check($result['success'] === true && Mailer::$calls === 1, 'Unknown accounts must keep the generic response without sending.');
// The reset link must come from our own setting, never from the visitor's Host header.
$calls = Mailer::$calls;
$_SERVER['HTTP_HOST'] = 'evil.example.com';
Database::$accountExists = true;
RateLimiter::$lockouts = [];
$result = AuthService::forgotPassword('patient@example.invalid');
check(Mailer::$calls === $calls, 'A fake Host on a real server must NOT send a reset email.');

putenv('ASDC_APP_URL=https://clinic.example.org/app/');
check(AuthService::resetBaseUrl() === 'https://clinic.example.org/app', 'The configured address must be used, without a trailing slash.');
putenv('ASDC_APP_URL=javascript:alert(1)');
check(AuthService::resetBaseUrl() === null, 'Only http(s) addresses are accepted.');
putenv('ASDC_APP_URL=https://clinic.example.org');
$_SERVER['HTTP_HOST'] = 'evil.example.com';
check(AuthService::resetBaseUrl() === 'https://clinic.example.org', 'A fake Host must be ignored when the address is configured.');
putenv('ASDC_APP_URL');
echo "PASS: the reset link ignores a fake Host header.\n";

echo "PASS: first reset request, token creation, mail invocation, account/IP lockouts, and unknown-account response. No email was sent.\n";
