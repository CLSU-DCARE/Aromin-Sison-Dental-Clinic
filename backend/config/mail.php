<?php
/**
 * Mail / SMS configuration: Aromin-Sison Dental Clinic System.
 *
 * Provides two helper functions used by the notification API:
 *
 *   send_email($to, $subject, $body)   — sends an email
 *   send_sms($to, $body)               — sends an SMS (simulated / logged)
 *
 * Email setup:
 *   - XAMPP default: uses PHP's mail() (works for local testing, no real delivery)
 *   - Gmail SMTP: uncomment the PHPMailer section and install PHPMailer via Composer:
 *       composer require phpmailer/phpmailer
 *
 * SMS setup:
 *   - Default: logs to notification_logs only (no real SMS sent)
 *   - To integrate Twilio, uncomment the Twilio section and set your credentials.
 */

// ──────────────────────────────────────────────
// 1. EMAIL — PHPMailer with Gmail SMTP (recommended for real sending)
// ──────────────────────────────────────────────
// To use PHPMailer, run: composer require phpmailer/phpmailer
// Then uncomment the use statements and the send_email() body below.

// use PHPMailer\PHPMailer\PHPMailer;
// use PHPMailer\PHPMailer\SMTP;
// use PHPMailer\PHPMailer\Exception;

// Gmail SMTP credentials — replace with your own or use environment variables.
// For Gmail: enable 2FA → App Passwords → generate an "App Password" for this app.
// define('SMTP_HOST',     'smtp.gmail.com');
// define('SMTP_PORT',     587);
// define('SMTP_USERNAME', 'your-clinic-email@gmail.com');
// define('SMTP_PASSWORD', 'your-app-password-here');
// define('SMTP_FROM',     'your-clinic-email@gmail.com');
// define('SMTP_FROM_NAME','Aromin-Sison Dental Clinic');

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
        // ── Option A: PHPMailer via SMTP (uncomment above + below) ──
        // try {
        //     $mail = new PHPMailer(true);
        //     $mail->isSMTP();
        //     $mail->Host       = SMTP_HOST;
        //     $mail->SMTPAuth   = true;
        //     $mail->Username   = SMTP_USERNAME;
        //     $mail->Password   = SMTP_PASSWORD;
        //     $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        //     $mail->Port       = SMTP_PORT;
        //     $mail->setCharset('UTF-8');
        //     $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
        //     $mail->addAddress($to);
        //     $mail->isHTML(false);
        //     $mail->Subject = $subject;
        //     $mail->Body    = $body;
        //     $mail->send();
        //     return ['ok' => true];
        // } catch (Exception $e) {
        //     return ['ok' => false, 'error' => $mail->ErrorInfo];
        // }

        // ── Option B: PHP mail() — works on XAMPP out of the box ──
        $headers  = "From: Aromin-Sison Dental Clinic <no-reply@aromin-sison.local>\r\n";
        $headers .= "Reply-To: no-reply@aromin-sison.local\r\n";
        $headers .= "X-Mailer: ASDC-System/1.0\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        $result = @mail($to, $subject, $body, $headers);
        return $result
            ? ['ok' => true]
            : ['ok' => false, 'error' => 'PHP mail() failed. Check XAMPP sendmail config.'];
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
