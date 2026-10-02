<?php
namespace ASDC;

class ReceiptAccess
{
    public static function token(string $paymentRef, ?string $receiptPath): string
    {
        return hash_hmac('sha256', self::payload($paymentRef, $receiptPath), self::secret());
    }

    public static function validToken(string $paymentRef, ?string $receiptPath, ?string $token): bool
    {
        if (!$token || !$receiptPath) return false;
        return hash_equals(self::token($paymentRef, $receiptPath), $token);
    }

    public static function url(string $paymentRef, ?string $receiptPath): ?string
    {
        if (!$receiptPath) return null;
        return '../backend/api/payments/receipt.php?payment_id=' . rawurlencode($paymentRef)
            . '&token=' . rawurlencode(self::token($paymentRef, $receiptPath));
    }

    private static function payload(string $paymentRef, ?string $receiptPath): string
    {
        return $paymentRef . '|' . (string) $receiptPath;
    }

    private static function secret(): string
    {
        return Env::get('ASDC_RECEIPT_TOKEN_SECRET')
            ?: Env::get('ASDC_APP_KEY')
            ?: Env::get('ASDC_DB_PASS')
            ?: 'asdc-local-receipt-token';
    }
}
