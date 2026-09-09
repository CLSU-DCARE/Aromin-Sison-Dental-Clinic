<?php
/**
 * Authentication service: Aromin-Sison Dental Clinic System.
 *
 * Consolidates all auth business logic: login, logout, register,
 * password forgot/reset, and current-user lookup.
 *
 * Usage:
 *   $result = AuthService::login($email, $password);
 *   $user   = AuthService::me();
 *   AuthService::logout();
 *   $result = AuthService::register($data);
 *   $result = AuthService::forgotPassword($email);
 *   $result = AuthService::resetPassword($token, $password);
 */

namespace ASDC;

use PDO;
use PDOException;

class AuthService
{
    private const LOGIN_MAX_ATTEMPTS = 5;
    private const LOGIN_LOCKOUT_SECONDS = 900; // 15 minutes
    private const RESET_MAX_ATTEMPTS = 3;
    private const RESET_WINDOW_SECONDS = 900;
    private const ALLOWED_ROLES = ['dentist', 'receptionist', 'patient'];

    /**
     * Authenticate a user by email + password.
     *
     * On success, sets session variables and regenerates the session ID.
     * On failure, tracks brute-force attempts.
     *
     * @return array{success: true, user: array}|array{success: false, error: string, code: int}
     */
    public static function login(string $email, string $password): array
    {
        $email = strtolower(trim($email));

        if (!$email || !$password) {
            return ['success' => false, 'error' => 'Email and password are required.', 'code' => 400];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'A valid email address is required.', 'code' => 400];
        }

        AuthMiddleware::secureSessionStart();

        // Brute-force check (email + IP)
        $lockout = RateLimiter::lockoutRemaining("login:{$email}");
        $ipLockout = RateLimiter::lockoutRemaining('ip:' . AuthMiddleware::getClientIp());
        if ($lockout > 0 || $ipLockout > 0) {
            $wait = max($lockout, $ipLockout);
            return ['success' => false, 'error' => "Too many failed attempts. Try again in {$wait} second(s).", 'code' => 429];
        }

        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT user_id, role, email, password_hash, full_name, is_active FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !(bool) $user['is_active'] || !password_verify($password, $user['password_hash'])) {
            RateLimiter::record("login:{$email}", self::LOGIN_MAX_ATTEMPTS, self::LOGIN_LOCKOUT_SECONDS);
            RateLimiter::record('ip:' . AuthMiddleware::getClientIp(), self::LOGIN_MAX_ATTEMPTS, self::LOGIN_LOCKOUT_SECONDS);
            $remaining = RateLimiter::lockoutRemaining("login:{$email}");
            $ipRemaining = RateLimiter::lockoutRemaining('ip:' . AuthMiddleware::getClientIp());
            $wait = max($remaining, $ipRemaining);
            if ($wait > 0) {
                return ['success' => false, 'error' => 'Too many failed attempts. This account is locked for 15 minutes.', 'code' => 429];
            }
            return ['success' => false, 'error' => 'Invalid email or password.', 'code' => 401];
        }

        if (!in_array($user['role'], self::ALLOWED_ROLES, true)) {
            error_log('Login rejected for user with unsupported role: ' . $user['user_id']);
            return ['success' => false, 'error' => 'This account role is not supported.', 'code' => 403];
        }

        // Success
        RateLimiter::reset("login:{$email}");
        RateLimiter::reset('ip:' . AuthMiddleware::getClientIp());
        session_regenerate_id(true);
        CsrfToken::regenerate();

        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['full_name'] = $user['full_name'];
        $_SESSION['last_activity'] = time();

        unset($user['password_hash'], $user['is_active']);

        return ['success' => true, 'user' => $user];
    }

    /**
     * Return the currently authenticated user from the session.
     *
     * @return array{user: array}|null
     */
    public static function me(): ?array
    {
        AuthMiddleware::requireLogin();

        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT user_id, role, email, full_name FROM users WHERE user_id = ? AND is_active = 1');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();

        if (!$user) {
            $_SESSION = [];
            session_destroy();
            return null;
        }

        if (!in_array($user['role'], self::ALLOWED_ROLES, true) || $user['role'] !== ($_SESSION['role'] ?? null)) {
            $_SESSION = [];
            session_destroy();
            return null;
        }

        return ['user' => $user];
    }

    /**
     * Destroy the current session (logout).
     */
    public static function logout(): void
    {
        AuthMiddleware::secureSessionStart();

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }

        session_destroy();
    }

    /**
     * Register a new patient account.
     *
     * @param array{first_name: string, last_name: string, email: string, password: string, contact_number?: string} $data
     * @return array{success: true, user: array}|array{success: false, error: string, code: int}
     */
    public static function register(array $data): array
    {
        $firstName     = trim($data['first_name'] ?? '');
        $lastName      = trim($data['last_name'] ?? '');
        $email         = strtolower(trim($data['email'] ?? ''));
        $contactNumber = trim($data['contact_number'] ?? '');
        $password      = $data['password'] ?? '';

        if ($firstName === '' || $lastName === '' || $email === '' || $password === '') {
            return ['success' => false, 'error' => 'First name, last name, email, and password are required.', 'code' => 400];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'A valid email address is required.', 'code' => 400];
        }
        if (strlen($password) < 8) {
            return ['success' => false, 'error' => 'Password must be at least 8 characters.', 'code' => 400];
        }
        if (strlen($firstName) > 100 || strlen($lastName) > 100 || strlen($email) > 150 || strlen($contactNumber) > 20) {
            return ['success' => false, 'error' => 'One or more fields exceed the allowed length.', 'code' => 400];
        }

        $pdo = Database::pdo();

        try {
            $pdo->beginTransaction();

            $existingUser = $pdo->prepare('SELECT user_id FROM users WHERE email = ? LIMIT 1');
            $existingUser->execute([$email]);
            if ($existingUser->fetch()) {
                $pdo->rollBack();
                return ['success' => false, 'error' => 'An account already uses this email address.', 'code' => 409];
            }

            $fullName = trim($firstName . ' ' . $lastName);
            $passwordHash = password_hash($password, PASSWORD_DEFAULT);

            $insertUser = $pdo->prepare('INSERT INTO users (role, email, password_hash, full_name, contact_number, is_active) VALUES (?, ?, ?, ?, ?, 1)');
            $insertUser->execute(['patient', $email, $passwordHash, $fullName, $contactNumber ?: null]);
            $userId = (int) $pdo->lastInsertId();

            $insertPatient = $pdo->prepare('INSERT INTO patients (user_id, first_name, last_name, contact_number, email) VALUES (?, ?, ?, ?, ?)');
            $insertPatient->execute([$userId, $firstName, $lastName, $contactNumber ?: null, $email]);

            $pdo->commit();

            return [
                'success' => true,
                'user' => [
                    'user_id'   => $userId,
                    'role'      => 'patient',
                    'email'     => $email,
                    'full_name' => $fullName,
                ],
            ];
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Patient registration failed: ' . $e->getMessage());
            return ['success' => false, 'error' => 'Unable to create the patient account.', 'code' => 500];
        }
    }

    /**
     * Send a password reset email (rate-limited).
     *
     * Always returns success to prevent email enumeration.
     */
    public static function forgotPassword(string $email): array
    {
        $email = strtolower(trim($email));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'A valid email address is required.', 'code' => 400];
        }

        AuthMiddleware::secureSessionStart();

        // Rate limit: 3 attempts per 15 minutes (tracked by email + IP)
        $resetKey = "password_reset:{$email}";
        $ipKey = 'ip:' . AuthMiddleware::getClientIp();
        $lockout = RateLimiter::remaining($resetKey, self::RESET_MAX_ATTEMPTS, self::RESET_WINDOW_SECONDS);
        $ipLockout = RateLimiter::remaining($ipKey, self::RESET_MAX_ATTEMPTS, self::RESET_WINDOW_SECONDS);
        if ($lockout > 0 || $ipLockout > 0) {
            return ['success' => false, 'error' => 'Too many reset requests. Please wait 15 minutes and try again.', 'code' => 429];
        }
        RateLimiter::record($resetKey, self::RESET_MAX_ATTEMPTS, self::RESET_WINDOW_SECONDS);
        RateLimiter::record($ipKey, self::RESET_MAX_ATTEMPTS, self::RESET_WINDOW_SECONDS);

        $pdo = Database::pdo();
        $roleSql = "role IN ('dentist', 'receptionist', 'patient')";
        $stmt = $pdo->prepare("SELECT user_id, email, full_name FROM users WHERE email = ? AND {$roleSql} AND is_active = 1 LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user) {
            $token = TokenService::generate();
            $tokenHash = TokenService::hash($token);

            $pdo->beginTransaction();
            try {
                $pdo->prepare('DELETE FROM password_reset_tokens WHERE user_id = ?')->execute([$user['user_id']]);
                TokenService::store($pdo, $user['user_id'], $tokenHash);
                $pdo->commit();
            } catch (\Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                error_log('Could not create password reset token: ' . $e->getMessage());
                return ['success' => false, 'error' => 'Unable to process the request right now.', 'code' => 500];
            }

            $scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
            $appBase = preg_replace('#/backend/api/auth/forgot-password\.php$#', '', $scriptPath);
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $resetUrl = $scheme . '://' . $host . $appBase . '/auth/reset-password.html?token=' . rawurlencode($token);
            $body = "Hello {$user['full_name']},\n\nUse this link to reset your password:\n\n{$resetUrl}\n\nThe link expires in one hour and can only be used once. If you did not request this, ignore this email.";

            $mailResult = Mailer::sendEmail($user['email'], 'Reset your Aromin-Sison Dental Clinic password', $body);
            if (empty($mailResult['ok'])) {
                error_log('[PASSWORD RESET MAIL FAILED] Delivery failed for user ID ' . $user['user_id']);
            }
        }

        return ['success' => true, 'message' => 'If an active account matches that email, a password reset link has been sent.'];
    }

    /**
     * Reset a user's password using a valid token.
     *
     * @return array{success: true, message: string}|array{success: false, error: string, code: int}
     */
    public static function resetPassword(string $token, string $password): array
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            return ['success' => false, 'error' => 'This password reset link is invalid or incomplete.', 'code' => 400];
        }
        if (strlen($password) < 8 || strlen($password) > 128) {
            return ['success' => false, 'error' => 'Password must be between 8 and 128 characters.', 'code' => 400];
        }

        $pdo = Database::pdo();
        $tokenHash = TokenService::hash($token);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT reset_id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE');
            $stmt->execute([$tokenHash]);
            $reset = $stmt->fetch();

            if (!$reset) {
                $pdo->rollBack();
                return ['success' => false, 'error' => 'This password reset link is invalid or has expired. Request a new one.', 'code' => 400];
            }

            $passwordHash = password_hash($password, PASSWORD_DEFAULT);
            if ($passwordHash === false) throw new \RuntimeException('Password hashing failed.');

            $update = $pdo->prepare('UPDATE users SET password_hash = ? WHERE user_id = ? AND is_active = 1');
            $update->execute([$passwordHash, $reset['user_id']]);
            if ($update->rowCount() !== 1) throw new \RuntimeException('Reset account is unavailable.');

            TokenService::markUsed($pdo, $reset['user_id']);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Password reset failed: ' . $e->getMessage());
            return ['success' => false, 'error' => 'Unable to reset the password right now.', 'code' => 500];
        }

        return ['success' => true, 'message' => 'Your password has been reset.'];
    }
}
