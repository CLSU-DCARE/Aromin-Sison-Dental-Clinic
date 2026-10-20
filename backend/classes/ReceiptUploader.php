<?php
namespace ASDC;
/** Legacy entry point retained to explicitly reject new receipt uploads. */
class ReceiptUploader
{
    public static function store(?array $file, int $patientId): string
    {
        ApiResponse::error(410, 'payments_removed', 'Payment receipt uploads are no longer available.');
    }
}
