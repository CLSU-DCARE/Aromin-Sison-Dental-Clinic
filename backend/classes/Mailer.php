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
        $gmailAddress    = trim((string) getenv('ASDC_GMAIL_ADDRESS'));
        $gmailAppPassword = trim((string) getenv('ASDC_GMAIL_APP_PASSWORD'));
        $fromName        = trim((string) (getenv('ASDC_MAIL_FROM_NAME') ?: 'Aromin-Sison Dental Clinic'));

        if (!filter_var($gmailAddress, FILTER_VALIDATE_EMAIL) || $gmailAppPassword === '') {
            return ['ok' => false, 'error' => 'Email delivery is not configured.'];
        }

        $autoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
        if (!is_file($autoload)) {
            return ['ok' => false, 'error' => 'Email delivery dependency is unavailable.'];
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
            return ['ok' => false, 'error' => 'Email delivery failed.'];
        }
    }
}
