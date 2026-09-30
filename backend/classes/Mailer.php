<?php
/**
 * Email sender via PHPMailer: Aromin-Sison Dental Clinic System.
 *
 * Uses Gmail SMTP with credentials from environment variables.
 * Usage:
 *   $result = Mailer::sendEmail($to, $subject, $body);
 */

namespace ASDC;

class Mailer
{
    public static function sendEmail(string $to, string $subject, string $body): array
    {
        Env::load();

        $resendApiKey = trim(self::firstEnv('RESEND_API_KEY', 'ASDC_RESEND_API_KEY'));
        $resendFromAddress = trim(self::firstEnv('ASDC_MAIL_FROM_ADDRESS', 'RESEND_FROM_ADDRESS', 'MAIL_FROM_ADDRESS'));
        $gmailAddress = trim(self::firstEnv(
            'ASDC_GMAIL_ADDRESS',
            'GMAIL_ADDRESS',
            'GMAIL_USER',
            'SMTP_USERNAME',
            'MAIL_USERNAME',
            'MAIL_FROM_ADDRESS'
        ));
        $gmailAppPassword = preg_replace('/\s+/', '', trim(self::firstEnv(
            'ASDC_GMAIL_APP_PASSWORD',
            'GMAIL_APP_PASSWORD',
            'GMAIL_PASSWORD',
            'SMTP_PASSWORD',
            'MAIL_PASSWORD'
        )));
        $fromName = trim(self::firstEnv('ASDC_MAIL_FROM_NAME', 'MAIL_FROM_NAME')) ?: 'Aromin-Sison Dental Clinic';
        $smtpHost = trim(self::firstEnv('ASDC_SMTP_HOST', 'SMTP_HOST', 'MAIL_HOST')) ?: 'smtp.gmail.com';
        $smtpPort = (int) (trim(self::firstEnv('ASDC_SMTP_PORT', 'SMTP_PORT', 'MAIL_PORT')) ?: '587');
        if ($smtpPort <= 0) $smtpPort = 587;
        $smtpSecure = strtolower(trim(self::firstEnv('ASDC_SMTP_SECURE', 'SMTP_SECURE', 'MAIL_ENCRYPTION'))) ?: 'tls';

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Recipient email address is invalid.'];
        }

        if ($resendApiKey !== '') {
            $fromAddress = filter_var($resendFromAddress, FILTER_VALIDATE_EMAIL) ? $resendFromAddress : $gmailAddress;
            if (!filter_var($fromAddress, FILTER_VALIDATE_EMAIL)) {
                error_log('[MAILER] Resend is configured, but ASDC_MAIL_FROM_ADDRESS is missing or invalid.');
                return ['ok' => false, 'error' => 'Email delivery is not configured.'];
            }
            return self::sendViaResend($resendApiKey, $fromAddress, $fromName, $to, $subject, $body);
        }

        if (!filter_var($gmailAddress, FILTER_VALIDATE_EMAIL) || $gmailAppPassword === '') {
            error_log('[MAILER] Email delivery is not configured. Set ASDC_GMAIL_ADDRESS and ASDC_GMAIL_APP_PASSWORD on the backend service.');
            return ['ok' => false, 'error' => 'Email delivery is not configured.'];
        }

        $autoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
        if (!is_file($autoload)) {
            // PHPMailer is not installed (nobody ran "composer install" on this server).
            // We can still send mail with the fallback below, but say so once per request
            // so this does not go unnoticed forever.
            error_log('[MAILER] vendor/autoload.php is missing. Run "composer install" so PHPMailer '
                . 'is used. Falling back to a basic built-in SMTP sender for now.');
            return self::sendViaSmtp($gmailAddress, $gmailAppPassword, $fromName, $to, $subject, $body);
        }
        require_once $autoload;

        try {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = $smtpHost;
            $mail->Port       = $smtpPort;
            $mail->SMTPAuth   = true;
            $mail->SMTPSecure = self::phpMailerEncryption($smtpSecure);
            $mail->Username   = $gmailAddress;
            $mail->Password   = $gmailAppPassword;
            $mail->CharSet    = 'UTF-8';
            $mail->Timeout    = 15;
            $mail->SMTPDebug  = 0;
            $mail->setFrom($gmailAddress, $fromName);
            $mail->addAddress($to);
            $mail->isHTML(false);
            $mail->Subject = $subject;
            $mail->Body    = $body;
            $mail->addCustomHeader('Importance', 'High');
            $mail->addCustomHeader('Priority', 'urgent');
            $mail->addCustomHeader('X-Priority', '1 (Highest)');
            $mail->send();
            return ['ok' => true];
        } catch (\Throwable $e) {
            error_log('[MAILER] SMTP send failed via ' . $smtpHost . ':' . $smtpPort . ' - ' . $e->getMessage());
            return ['ok' => false, 'error' => self::safeError($e->getMessage())];
        }
    }

    public static function diagnostics(): array
    {
        Env::load();
        $address = trim(self::firstEnv(
            'ASDC_GMAIL_ADDRESS',
            'GMAIL_ADDRESS',
            'GMAIL_USER',
            'SMTP_USERNAME',
            'MAIL_USERNAME',
            'MAIL_FROM_ADDRESS'
        ));
        $password = preg_replace('/\s+/', '', trim(self::firstEnv(
            'ASDC_GMAIL_APP_PASSWORD',
            'GMAIL_APP_PASSWORD',
            'GMAIL_PASSWORD',
            'SMTP_PASSWORD',
            'MAIL_PASSWORD'
        )));
        $smtpHost = trim(self::firstEnv('ASDC_SMTP_HOST', 'SMTP_HOST', 'MAIL_HOST')) ?: 'smtp.gmail.com';
        $smtpPort = (int) (trim(self::firstEnv('ASDC_SMTP_PORT', 'SMTP_PORT', 'MAIL_PORT')) ?: '587');
        if ($smtpPort <= 0) $smtpPort = 587;
        $resendApiKey = trim(self::firstEnv('RESEND_API_KEY', 'ASDC_RESEND_API_KEY'));
        $resendFromAddress = trim(self::firstEnv('ASDC_MAIL_FROM_ADDRESS', 'RESEND_FROM_ADDRESS', 'MAIL_FROM_ADDRESS'));
        return [
            'address_configured' => filter_var($address, FILTER_VALIDATE_EMAIL) !== false,
            'password_configured' => $password !== '',
            'resend_configured' => $resendApiKey !== '',
            'resend_from_address' => filter_var($resendFromAddress, FILTER_VALIDATE_EMAIL) ? self::maskEmail($resendFromAddress) : null,
            'phpmailer_installed' => is_file(dirname(__DIR__, 2) . '/vendor/autoload.php'),
            'from_address' => filter_var($address, FILTER_VALIDATE_EMAIL) ? self::maskEmail($address) : null,
            'smtp_host' => $smtpHost,
            'smtp_port' => $smtpPort,
        ];
    }

    private static function firstEnv(string ...$keys): string
    {
        foreach ($keys as $key) {
            $value = getenv($key);
            if ($value !== false && trim((string) $value) !== '') {
                return (string) $value;
            }
        }
        return '';
    }

    private static function maskEmail(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if ($domain === '') return 'configured';
        $prefix = substr($name, 0, 2);
        return $prefix . str_repeat('*', max(2, strlen($name) - 2)) . '@' . $domain;
    }

    private static function sendViaResend(
        string $apiKey,
        string $fromAddress,
        string $fromName,
        string $to,
        string $subject,
        string $body
    ): array {
        $payload = json_encode([
            'from' => self::formatAddress($fromAddress, $fromName),
            'to' => [$to],
            'subject' => $subject,
            'text' => $body,
        ], JSON_UNESCAPED_SLASHES);
        if ($payload === false) {
            return ['ok' => false, 'error' => 'Email delivery failed.'];
        }

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_POSTFIELDS => $payload,
        ]);
        $response = curl_exec($ch);
        $error = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($response === false) {
            error_log('[MAILER] Resend connection failed: ' . $error);
            return ['ok' => false, 'error' => 'Email delivery failed: could not connect to Resend.'];
        }

        $data = json_decode((string) $response, true);
        if ($status >= 200 && $status < 300) {
            return ['ok' => true, 'provider' => 'resend', 'id' => $data['id'] ?? null];
        }

        $message = is_array($data) ? (string) ($data['message'] ?? $data['error'] ?? '') : '';
        error_log('[MAILER] Resend send failed. HTTP ' . $status . ': ' . ($message ?: substr((string) $response, 0, 300)));
        return ['ok' => false, 'error' => self::safeResendError($status, $message)];
    }

    private static function formatAddress(string $email, string $name): string
    {
        $safeName = trim(str_replace(['"', '<', '>'], '', $name));
        return $safeName !== '' ? $safeName . ' <' . $email . '>' : $email;
    }

    private static function phpMailerEncryption(string $value): string
    {
        if (in_array($value, ['ssl', 'smtps'], true)) {
            return \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        }
        return \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    }

    private static function sendViaSmtp(
        string $gmailAddress,
        string $gmailAppPassword,
        string $fromName,
        string $to,
        string $subject,
        string $body
    ): array {
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Recipient email address is invalid.'];
        }

        // Check the server's certificate properly. Turning this off would let anyone
        // between us and Gmail read or change the email (including the password reset link).
        $ssl = [
            'verify_peer'       => true,
            'verify_peer_name'  => true,
            'peer_name'         => 'smtp.gmail.com',
            'allow_self_signed' => false,
        ];
        /* PHP 8.3 rejects an empty cafile/capath value. When neither is
           configured, OpenSSL uses its platform trust store instead. */
        if (($cafile = trim((string) ini_get('openssl.cafile'))) !== '') $ssl['cafile'] = $cafile;
        if (($capath = trim((string) ini_get('openssl.capath'))) !== '') $ssl['capath'] = $capath;
        $context = stream_context_create(['ssl' => $ssl]);
        $socket = @stream_socket_client('tcp://smtp.gmail.com:587', $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
        if (!$socket) {
            error_log('[MAILER] Gmail SMTP connection failed: ' . $errstr . ' (' . $errno . ')');
            return ['ok' => false, 'error' => 'Email delivery failed.'];
        }

        stream_set_timeout($socket, 15);

        try {
            self::expect($socket, [220]);
            self::command($socket, 'EHLO aromin-sison.local', [250]);
            self::command($socket, 'STARTTLS', [220]);
            // If Gmail's certificate cannot be verified, this fails closed (throws) instead
            // of quietly sending the email - and the password reset link inside it -
            // over a connection that might be intercepted.
            if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new \RuntimeException('TLS certificate verification failed');
            }
            self::command($socket, 'EHLO aromin-sison.local', [250]);
            self::command($socket, 'AUTH LOGIN', [334]);
            self::command($socket, base64_encode($gmailAddress), [334]);
            self::command($socket, base64_encode($gmailAppPassword), [235]);
            self::command($socket, 'MAIL FROM:<' . $gmailAddress . '>', [250]);
            self::command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
            self::command($socket, 'DATA', [354]);
            fwrite($socket, self::message($gmailAddress, $fromName, $to, $subject, $body) . "\r\n.\r\n");
            self::expect($socket, [250]);
            self::command($socket, 'QUIT', [221]);
            fclose($socket);
            return ['ok' => true];
        } catch (\Throwable $e) {
            if (is_resource($socket)) fclose($socket);
            error_log('[MAILER] Gmail SMTP fallback failed: ' . $e->getMessage());
            return ['ok' => false, 'error' => self::safeError($e->getMessage())];
        }
    }

    private static function command($socket, string $command, array $expected): string
    {
        fwrite($socket, $command . "\r\n");
        return self::expect($socket, $expected);
    }

    private static function expect($socket, array $expected): string
    {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (preg_match('/^\d{3}\s/', $line)) break;
        }

        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $expected, true)) {
            throw new \RuntimeException('Unexpected SMTP response: ' . $code);
        }
        return $response;
    }

    private static function safeError(string $message): string
    {
        $message = strtolower($message);
        if (str_contains($message, 'authenticate') || str_contains($message, '535')) {
            return 'Email delivery failed: Gmail rejected the address or app password.';
        }
        if (str_contains($message, 'tls') || str_contains($message, 'crypto')) {
            return 'Email delivery failed: SMTP TLS connection failed.';
        }
        if (str_contains($message, 'recipient') || str_contains($message, '550') || str_contains($message, '553')) {
            return 'Email delivery failed: recipient email address was rejected.';
        }
        if (str_contains($message, '421') || str_contains($message, 'timed out') || str_contains($message, 'connect')) {
            return 'Email delivery failed: could not connect to Gmail SMTP.';
        }
        return 'Email delivery failed.';
    }

    private static function safeResendError(int $status, string $message): string
    {
        $lower = strtolower($message);
        if ($status === 401 || str_contains($lower, 'api key')) {
            return 'Email delivery failed: Resend API key was rejected.';
        }
        if ($status === 403 || str_contains($lower, 'domain') || str_contains($lower, 'sender')) {
            return 'Email delivery failed: Resend sender/domain is not verified.';
        }
        if ($status === 422 || str_contains($lower, 'recipient') || str_contains($lower, 'email')) {
            return 'Email delivery failed: email address was rejected.';
        }
        if ($status === 429) {
            return 'Email delivery failed: Resend rate limit reached.';
        }
        return 'Email delivery failed.';
    }

    private static function message(string $from, string $fromName, string $to, string $subject, string $body): string
    {
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encodedFrom = '=?UTF-8?B?' . base64_encode($fromName) . '?= <' . $from . '>';
        $safeBody = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $body));
        $safeBody = str_replace("\n", "\r\n", $safeBody);

        return implode("\r\n", [
            'From: ' . $encodedFrom,
            'To: <' . $to . '>',
            'Subject: ' . $encodedSubject,
            'Importance: High',
            'Priority: urgent',
            'X-Priority: 1 (Highest)',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            $safeBody,
        ]);
    }

}
