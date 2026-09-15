<?php
namespace ASDC;

class SmsGateway
{
    public static function sendSms(string $to, string $body): array
    {
        return ['ok' => false, 'error' => 'SMS delivery is unavailable: no SMS provider is configured.'];
    }
}
