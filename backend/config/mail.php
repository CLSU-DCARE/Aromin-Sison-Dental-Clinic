<?php
/**
 * Mail / SMS configuration: Aromin-Sison Dental Clinic System.
 *
 * Backward-compatible wrappers around ASDC\Mailer, ASDC\SmsGateway,
 * and ASDC\TemplateRenderer.
 * Classes are auto-loaded via backend/autoload.php.
 */

if (!function_exists('send_email')) {
    function send_email($to, $subject, $body): array
    {
        return \ASDC\Mailer::sendEmail($to, $subject, $body);
    }
}

if (!function_exists('send_sms')) {
    function send_sms($to, $body): array
    {
        return \ASDC\SmsGateway::sendSms($to, $body);
    }
}

if (!function_exists('render_template')) {
    function render_template($body, array $replacements): string
    {
        return \ASDC\TemplateRenderer::render($body, $replacements);
    }
}
