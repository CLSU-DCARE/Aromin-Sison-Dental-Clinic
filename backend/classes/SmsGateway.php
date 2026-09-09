<?php
/**
 * SMS sender (simulated): Aromin-Sison Dental Clinic System.
 *
 * Default: logs to notification_logs only (no real SMS sent).
 * To integrate Twilio, uncomment the Twilio section and set credentials.
 * Usage:
 *   $result = SmsGateway::sendSms($to, $body);
 */

namespace ASDC;

class SmsGateway
{
    public static function sendSms(string $to, string $body): array
    {
        // Option A: Twilio (uncomment and configure constants to enable)
        // try {
        //     $client = new \Twilio\Rest\Client(TWILIO_SID, TWILIO_TOKEN);
        //     $client->messages->create($to, [
        //         'from' => TWILIO_FROM,
        //         'body' => $body,
        //     ]);
        //     return ['ok' => true];
        // } catch (\Exception $e) {
        //     return ['ok' => false, 'error' => $e->getMessage()];
        // }

        // Option B: Simulate — log only (for local dev / defense demo)
        error_log("[SMS SIMULATED] To: $to | Body: $body");
        return ['ok' => true, 'simulated' => true];
    }
}
