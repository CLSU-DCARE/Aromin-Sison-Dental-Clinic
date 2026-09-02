<?php
/**
 * Mail / SMS configuration: Aromin-Sison Dental Clinic System.
 *
 * Provides two helper functions used by the notification API:
 *
 *   send_email($to, $subject, $body)   — sends an email
 *   send_sms($to, $body)               — sends an SMS (simulated / logged)
 *
 * Email uses PHPMailer with Gmail SMTP. Credentials come from environment
 * variables and are never stored in this repository.
 *
 * SMS setup:
 *   - Default: logs to notification_logs only (no real SMS sent)
 *   - To integrate Twilio, uncomment the Twilio section and set your credentials.
 */

// ──────────────────────────────────────────────
// 1. EMAIL — PHPMailer with Gmail SMTP
// ──────────────────────────────────────────────
// Required environment variables: ASDC_GMAIL_ADDRESS and
// ASDC_GMAIL_APP_PASSWORD. ASDC_MAIL_FROM_NAME is optional.

if (!function_exists('send_email')) {
    /**
     * Send an email. Returns ['ok' => true] on success or ['ok' => false, 'error' => '...'].
     *
     * @param string $to       Recipient email address
     * @param string $subject  Email subject
     * @param string $body     Email body (plain text)
     * @return array
     */
    function send_email($to, $subject, $body) {
        $gmailAddress = trim((string) getenv('ASDC_GMAIL_ADDRESS'));
        $gmailAppPassword = trim((string) getenv('ASDC_GMAIL_APP_PASSWORD'));
        $fromName = trim((string) (getenv('ASDC_MAIL_FROM_NAME') ?: 'Aromin-Sison Dental Clinic'));

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
            $mail->Host = 'smtp.gmail.com';
            $mail->Port = 587;
            $mail->SMTPAuth = true;
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Username = $gmailAddress;
            $mail->Password = $gmailAppPassword;
            $mail->CharSet = 'UTF-8';
            $mail->Timeout = 15;
            $mail->SMTPDebug = 0;
            $mail->setFrom($gmailAddress, $fromName);
            $mail->addAddress($to);
            $mail->isHTML(false);
            $mail->Subject = $subject;
            $mail->Body = $body;
            $mail->send();
            return ['ok' => true];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => 'Email delivery failed.'];
        }
    }
}

// ──────────────────────────────────────────────
// 2. SMS — Twilio integration (optional)
// ──────────────────────────────────────────────
// To use Twilio, run: composer require twilio/sdk
// Then uncomment the use statement and the send_sms() body below.

// use Twilio\Rest\Client as TwilioClient;

// define('TWILIO_SID',   'your-account-sid');
// define('TWILIO_TOKEN', 'your-auth-token');
// define('TWILIO_FROM',  '+1234567890');  // your Twilio phone number

if (!function_exists('send_sms')) {
    /**
     * Send an SMS. Returns ['ok' => true] or ['ok' => false, 'error' => '...'].
     *
     * @param string $to   Recipient phone number (e.g. +639XXXXXXXXX)
     * @param string $body Message body (max 1600 chars)
     * @return array
     */
    function send_sms($to, $body) {
        // ── Option A: Twilio (uncomment above + below) ──
        // try {
        //     $client = new TwilioClient(TWILIO_SID, TWILIO_TOKEN);
        //     $client->messages->create($to, [
        //         'from' => TWILIO_FROM,
        //         'body' => $body,
        //     ]);
        //     return ['ok' => true];
        // } catch (\Exception $e) {
        //     return ['ok' => false, 'error' => $e->getMessage()];
        // }

        // ── Option B: Simulate — log only (for local dev / defense demo) ──
        // In a real deployment, replace this with an actual SMS API.
        error_log("[SMS SIMULATED] To: $to | Body: $body");
        return ['ok' => true, 'simulated' => true];
    }
}

// ──────────────────────────────────────────────
// 3. Template helper — render a template with placeholders
// ──────────────────────────────────────────────
if (!function_exists('render_template')) {
    /**
     * Replace {placeholders} in a template body.
     *
     * @param string $body         Template body with {key} placeholders
     * @param array  $replacements ['patient_name' => '...', 'date' => '...', ...]
     * @return string
     */
    function render_template($body, array $replacements) {
        $keys = array_map(function ($k) { return '{' . $k . '}'; }, array_keys($replacements));
        return str_replace($keys, array_values($replacements), $body);
    }
}
