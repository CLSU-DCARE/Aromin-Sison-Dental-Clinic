<?php
/**
 * Authentication service: Aromin-Sison Dental Clinic System.
 *
 * Consolidates all auth business logic: login, logout, register,
 * password forgot/reset, and current-user lookup.
 *
 * Usage:
 *   $result = AuthService::login($identifier, $password);
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
    private const LOGIN_LOCKOUT_SECONDS = 30;
    private const RESET_MAX_ATTEMPTS = 3;
    private const RESET_WINDOW_SECONDS = 900;
    public const ALLOWED_ROLES = ['dentist', 'receptionist', 'patient'];

    /**
     * Authenticate a user by registered email address or mobile number + password.
     *
     * On success, sets session variables and regenerates the session ID.
     * On failure, tracks brute-force attempts.
     *
     * @param bool $rememberMe If true, creates a remember token for persistent login
     * @return array{success: true, user: array}|array{success: false, error: string, code: int}
     */
    public static function login(string $identifier, string $password, bool $rememberMe = false): array
    {
        $loginIdentifier = self::normalizeLoginIdentifier($identifier);

        if (!$loginIdentifier || !$password) {
            return ['success' => false, 'error' => 'Email address or mobile number and password are required.', 'code' => 400];
        }
        $rateLimitKey = 'login:' . $loginIdentifier['type'] . ':' . $loginIdentifier['value'];

        AuthMiddleware::secureSessionStart();

        // Brute-force check (registered identifier + IP)
        $lockout = RateLimiter::lockoutRemaining($rateLimitKey);
        $ipLockout = RateLimiter::lockoutRemaining('ip:' . AuthMiddleware::getClientIp());
        if ($lockout > 0 || $ipLockout > 0) {
            $wait = max($lockout, $ipLockout);
            return ['success' => false, 'error' => "Too many failed attempts. Try again in {$wait} second(s).", 'code' => 429];
        }

        $pdo = Database::pdo();
        $user = self::findUserForLogin($pdo, $loginIdentifier);

        if (!$user || !(bool) $user['is_active'] || !password_verify($password, $user['password_hash'])) {
            RateLimiter::record($rateLimitKey, self::LOGIN_MAX_ATTEMPTS, self::LOGIN_LOCKOUT_SECONDS);
            RateLimiter::record('ip:' . AuthMiddleware::getClientIp(), self::LOGIN_MAX_ATTEMPTS, self::LOGIN_LOCKOUT_SECONDS);
            $remaining = RateLimiter::lockoutRemaining($rateLimitKey);
            $ipRemaining = RateLimiter::lockoutRemaining('ip:' . AuthMiddleware::getClientIp());
            $wait = max($remaining, $ipRemaining);
            if ($wait > 0) {
                return ['success' => false, 'error' => 'Too many failed attempts. This account is locked for 30 seconds.', 'code' => 429];
            }
            return ['success' => false, 'error' => 'Invalid email address, mobile number, or password.', 'code' => 401];
        }

        if (!in_array($user['role'], self::ALLOWED_ROLES, true)) {
            error_log('Login rejected for user with unsupported role: ' . $user['user_id']);
            return ['success' => false, 'error' => 'This account role is not supported.', 'code' => 403];
        }

        // Success
        RateLimiter::reset($rateLimitKey);
        RateLimiter::reset('ip:' . AuthMiddleware::getClientIp());

        // Always give the user a brand-new session ID at login. If we kept the ID
        // the browser arrived with, anyone who planted that ID beforehand
        // ("session fixation") would be logged in as this user.
        // The old ID is deleted only when it belonged to a logged-in user; an empty
        // pre-login session is left to expire on its own, so pages that were already
        // in flight with the old cookie (like the login page's own /me check) do
        // not break.
        $wasLoggedIn = !empty($_SESSION['user_id']);
        if ($wasLoggedIn) {
            SessionManager::removeSession((int) $_SESSION['user_id'], session_id());
        }
        session_regenerate_id($wasLoggedIn);
        $_SESSION = []; // start clean; nothing from an earlier visit may carry over
        CsrfToken::regenerate();

        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['full_name'] = $user['full_name'];
        $_SESSION['last_activity'] = time();
        $_SESSION['remember_me'] = $rememberMe;

        // Register active session
        $sessionId = session_id();
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        $ipAddress = AuthMiddleware::getClientIp();
        SessionManager::registerSession($user['user_id'], $sessionId, $userAgent, $ipAddress, $rememberMe);
        $_SESSION['session_registered'] = true; // lets the server tell "revoked" apart from "old login without a row"

        // A "remember me" cookie left by an earlier login in this browser must not
        // outlive this login (it could silently sign the previous person back in).
        // If the user asked to be remembered this time, a fresh one is issued below.
        $oldRememberToken = RememberToken::getCookieToken();
        if ($oldRememberToken) {
            RememberToken::delete($oldRememberToken);
            RememberToken::clearCookie();
        }
        if ($rememberMe) {
            $token = RememberToken::generate($user['user_id'], $userAgent, $ipAddress);
            RememberToken::setCookie($token);
        }

        unset($user['password_hash'], $user['is_active'], $user['user_contact_number'], $user['patient_contact_number']);

        // Audit log
        $sessionId = session_id();
        SessionAudit::logCreate($user['user_id'], $sessionId, $rememberMe);

        return ['success' => true, 'user' => $user];
    }

    /**
     * Normalize a supported login identifier without changing stored account data.
     * Philippine mobile formats such as +63 917 123 4567 and 0917-123-4567
     * resolve to the same registered number; other 7-15 digit numbers are
     * retained as entered after punctuation is removed.
     *
     * @return array{type: 'email'|'mobile', value: string}|null
     */
    private static function normalizeLoginIdentifier(string $identifier): ?array
    {
        $identifier = trim($identifier);
        if ($identifier === '') {
            return null;
        }

        $email = strtolower($identifier);
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['type' => 'email', 'value' => $email];
        }

        $digits = preg_replace('/\D+/', '', $identifier);
        if ($digits === null || strlen($digits) < 7 || strlen($digits) > 15) {
            return null;
        }
        if (strlen($digits) === 12 && str_starts_with($digits, '63')) {
            $digits = '0' . substr($digits, 2);
        } elseif (strlen($digits) === 10 && str_starts_with($digits, '9')) {
            $digits = '0' . $digits;
        }

        return ['type' => 'mobile', 'value' => $digits];
    }

    /**
     * Find one user for the supplied identifier. A mobile number may be stored
     * on either the account or its patient profile. Ambiguous registrations are
     * deliberately treated as a failed login instead of choosing an account.
     */
    private static function findUserForLogin(PDO $pdo, array $identifier): ?array
    {
        if ($identifier['type'] === 'email') {
            $stmt = $pdo->prepare('SELECT user_id, role, email, password_hash, full_name, is_active FROM users WHERE email = ?');
            $stmt->execute([$identifier['value']]);
            return $stmt->fetch() ?: null;
        }

        $stmt = $pdo->query(
            'SELECT u.user_id, u.role, u.email, u.password_hash, u.full_name, u.is_active, '
            . 'u.contact_number AS user_contact_number, p.contact_number AS patient_contact_number '
            . 'FROM users u LEFT JOIN patients p ON p.user_id = u.user_id '
            . 'WHERE u.contact_number IS NOT NULL OR p.contact_number IS NOT NULL'
        );
        $matches = [];
        foreach ($stmt->fetchAll() as $candidate) {
            foreach (['user_contact_number', 'patient_contact_number'] as $field) {
                if (!empty($candidate[$field])) {
                    $number = self::normalizeLoginIdentifier((string) $candidate[$field]);
                    if ($number && $number['type'] === 'mobile' && $number['value'] === $identifier['value']) {
                        $matches[(int) $candidate['user_id']] = $candidate;
                        break;
                    }
                }
            }
        }

        return count($matches) === 1 ? reset($matches) : null;
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
        $stmt = $pdo->prepare('SELECT user_id, role, email, full_name, profile_image_path FROM users WHERE user_id = ? AND is_active = 1');
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

        // Keep uploaded profile images behind the authenticated API rather
        // than exposing their storage path as a public URL.
        $user['profile_image_url'] = $user['profile_image_path'] ? '../backend/api/auth/profile-image.php' : null;

        return ['user' => $user];
    }

    /**
     * Destroy the current session (logout).
     */
    public static function logout(): void
    {
        AuthMiddleware::secureSessionStart();

        $sessionId = session_id();
        $userId = !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;

        // Remove this device's active-session record and write one audit entry.
        if ($sessionId && $userId) {
            SessionManager::removeSession($userId, $sessionId);
            SessionAudit::logDestroy($userId, $sessionId, 'user_logout');
        }

        // Always forget this browser's "remember me" token, even when the
        // session had already expired. Otherwise the next page load would sign
        // the person straight back in.
        $token = RememberToken::getCookieToken();
        if ($token) {
            RememberToken::delete($token);
            RememberToken::clearCookie();
        }

        AuthMiddleware::destroySession(true);
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
        $ipKey = 'password_reset_ip:' . AuthMiddleware::getClientIp();
        $lockout = RateLimiter::lockoutRemaining($resetKey);
        $ipLockout = RateLimiter::lockoutRemaining($ipKey);
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
            // Build the link from OUR configured address, never from the request.
            // (The "Host" header is sent by the visitor, so an attacker could fake it and
            // get the victim to receive a link that points to the attacker's website.)
            $baseUrl = self::resetBaseUrl();
            if ($baseUrl === null) {
                error_log('[PASSWORD RESET] ASDC_APP_URL is not set, so no reset email was sent. Set it in .env.');
                return ['success' => true, 'message' => 'If an active account matches that email, a password reset link has been sent.'];
            }

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

            $resetUrl = $baseUrl . '/auth/reset-password.html?token=' . rawurlencode($token);
            $body = "Dear {$user['full_name']},\n\n"
                . "We received a request to reset the password for your account.\n\n"
                . "To continue, please click the link below. You will be redirected to a secure page where you can verify your account and set a new password.\n\n"
                . "Reset Password Link:\n{$resetUrl}\n\n"
                . "For your security, this link will expire after 15 minutes. If you did not request a password reset, please ignore this email or contact the clinic immediately.\n\n"
                . "Thank you,\nAromin-Sison Dental Clinic";

            $mailResult = Mailer::sendEmail($user['email'], 'Reset your Aromin-Sison Dental Clinic password', $body);
            if (empty($mailResult['ok'])) {
                error_log('[PASSWORD RESET MAIL FAILED] User ID ' . $user['user_id'] . ': ' . ($mailResult['error'] ?? 'Email delivery failed.'));
            }
        }

        return ['success' => true, 'message' => 'If an active account matches that email, a password reset link has been sent.'];
    }

    /**
     * The public address of the site, used inside password reset emails.
     * Set ASDC_APP_URL in .env, for example https://clinic.example.com
     * (or http://localhost/Aromin-Sison-Dental-Clinic while developing).
     *
     * If it is not set, we only trust the request's host on a local computer
     * (localhost, 127.0.0.1, *.test). On a real server we send nothing instead.
     */
    public static function resetBaseUrl(): ?string
    {
        $configured = rtrim(trim((string) Env::get('ASDC_APP_URL', '')), '/');
        if ($configured !== '') {
            $parts = parse_url($configured);
            $okScheme = isset($parts['scheme']) && in_array(strtolower($parts['scheme']), ['http', 'https'], true);
            return ($okScheme && !empty($parts['host'])) ? $configured : null;
        }

        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        $hostName = preg_replace('/:\d+$/', '', $host);
        $isLocal = $hostName === 'localhost' || $hostName === '127.0.0.1' || str_ends_with($hostName, '.test');
        if (!$isLocal || !preg_match('/^[a-z0-9.\-]+(:\d+)?$/', $host)) {
            return null;
        }

        $scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
        $appBase = preg_replace('#/backend/api/auth/forgot-password\.php$#', '', $scriptPath);
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        return $scheme . '://' . $host . $appBase;
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

            // The password changed, so every existing login (any device, any
            // "remember me") must stop working. This is what protects the
            // account if someone else knew the old password.
            try {
                SessionManager::revokeAllSessions((int) $reset['user_id']);
                RememberToken::deleteAllForUser((int) $reset['user_id']);
            } catch (\Throwable $e) {
                error_log('Could not revoke sessions after password reset: ' . $e->getMessage());
            }
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Password reset failed: ' . $e->getMessage());
            return ['success' => false, 'error' => 'Unable to reset the password right now.', 'code' => 500];
        }

        return ['success' => true, 'message' => 'Your password has been reset.'];
    }
}
