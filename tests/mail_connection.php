<?php
// CLI diagnostic: verify the same mailer path used by app notifications.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../backend/autoload.php';

$to = $argv[1] ?? getenv('ASDC_GMAIL_ADDRESS') ?: '';
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "FAIL: pass a recipient email, e.g. php tests\\mail_connection.php patient@example.com\n");
    exit(1);
}

$result = \ASDC\Mailer::sendEmail(
    $to,
    'Aromin-Sison Dental Clinic Email Test',
    "This is a test email from Aromin-Sison Dental Clinic.\n\nIf you received this, notification email delivery is working."
);

if ($result['ok'] ?? false) {
    echo "PASS: test email sent to {$to}.\n";
    exit(0);
}

fwrite(STDERR, 'FAIL: ' . ($result['error'] ?? 'Email delivery failed.') . "\n");
exit(1);
