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
        self::loadLocalEnv();

        $gmailAddress    = trim((string) getenv('ASDC_GMAIL_ADDRESS'));
        $gmailAppPassword = preg_replace('/\s+/', '', trim((string) getenv('ASDC_GMAIL_APP_PASSWORD')));
        $fromName        = trim((string) (getenv('ASDC_MAIL_FROM_NAME') ?: 'Aromin-Sison Dental Clinic'));

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Recipient email address is invalid.'];
        }

        if (!filter_var($gmailAddress, FILTER_VALIDATE_EMAIL) || $gmailAppPassword === '') {
            return ['ok' => false, 'error' => 'Email delivery is not configured.'];
        }

        $autoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
        if (!is_file($autoload)) {
            return self::sendViaSmtp($gmailAddress, $gmailAppPassword, $fromName, $to, $subject, $body);
        }
        require_once $autoload;

        try {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->Port       = 587;
            $mail->SMTPAuth   = true;
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
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
            $mail->send();
            return ['ok' => true];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => self::safeError($e->getMessage())];
        }
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

        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ],
        ]);
        $socket = @stream_socket_client('tcp://smtp.gmail.com:587', $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
        if (!$socket) {
            return ['ok' => false, 'error' => 'Email delivery failed.'];
        }

        stream_set_timeout($socket, 15);

        try {
            self::expect($socket, [220]);
            self::command($socket, 'EHLO aromin-sison.local', [250]);
            self::command($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new \RuntimeException('TLS failed');
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
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            $safeBody,
        ]);
    }

    private static function loadLocalEnv(): void
    {
        foreach ([dirname(__DIR__, 2) . '/.env.local', dirname(__DIR__, 2) . '/.env'] as $path) {
            if (!is_file($path)) continue;
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
                [$key, $value] = array_map('trim', explode('=', $line, 2));
                if ($key !== '' && getenv($key) === false) {
                    putenv($key . '=' . $value);
                    $_ENV[$key] = $value;
                }
            }
        }
    }
}
