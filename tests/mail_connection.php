<?php
// CLI diagnostic: authenticate with Gmail SMTP without sending a message.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../vendor/autoload.php';
$address = trim((string) getenv('ASDC_GMAIL_ADDRESS'));
$password = trim((string) getenv('ASDC_GMAIL_APP_PASSWORD'));
if (!filter_var($address, FILTER_VALIDATE_EMAIL) || $password === '') {
    fwrite(STDERR, "FAIL: Gmail environment variables are missing or invalid.\n");
    exit(1);
}
$mail = new \PHPMailer\PHPMailer\PHPMailer(true);
$mail->isSMTP();
$mail->Host = 'smtp.gmail.com';
$mail->Port = 587;
$mail->SMTPAuth = true;
$mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
$mail->Username = $address;
$mail->Password = $password;
$mail->Timeout = 15;
$mail->SMTPDebug = 0;
try {
    if (!$mail->smtpConnect()) throw new RuntimeException('SMTP connection failed.');
    echo "PASS: Gmail SMTP connection, TLS, and authentication. No email was sent.\n";
} catch (Throwable $error) {
    // Never print credentials, SMTP transcripts, or message content.
    $smtp = $mail->getSMTPInstance()->getError();
    $code = (string) ($smtp['smtp_code'] ?? '');
    fwrite(STDERR, 'FAIL: Gmail SMTP connection/authentication failed' . ($code ? ' (SMTP ' . $code . ')' : '') . ".\n");
    exit(1);
} finally {
    $mail->smtpClose();
}
