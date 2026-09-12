<?php
/**
 * Receipt image upload handler: Aromin-Sison Dental Clinic System.
 *
 * Validates and stores a patient's uploaded payment receipt image.
 * Usage:
 *   $relativePath = ReceiptUploader::store($_FILES['receipt']);
 */

namespace ASDC;

class ReceiptUploader
{
    private const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    private const ALLOWED = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    /**
     * Validates and moves an uploaded file into backend/uploads/receipts.
     * Returns the path to store in the DB (relative to the backend/
     * folder), e.g. "uploads/receipts/receipt_12_20260911_ab12cd.jpg".
     * Calls ApiResponse::error() (which exits) on any validation failure.
     */
    public static function store(?array $file, int $patientId): string
    {
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            ApiResponse::error(422, 'validation_failed', 'Please attach a receipt image.', ['receipt' => 'A receipt image is required.']);
        }
        if ($file['error'] !== UPLOAD_ERR_OK) {
            ApiResponse::error(422, 'validation_failed', 'The receipt upload failed. Please try again.', ['receipt' => 'Upload failed.']);
        }
        if ($file['size'] > self::MAX_BYTES) {
            ApiResponse::error(422, 'validation_failed', 'The receipt image is too large (max 5 MB).', ['receipt' => 'File is too large.']);
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        if (!isset(self::ALLOWED[$mime])) {
            ApiResponse::error(422, 'validation_failed', 'Receipt must be a JPG, PNG, or WEBP image.', ['receipt' => 'Unsupported file type.']);
        }

        $dir = dirname(__DIR__) . '/uploads/receipts';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $filename = 'receipt_' . $patientId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . self::ALLOWED[$mime];
        $dest = $dir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            ApiResponse::error(500, 'upload_failed', 'Could not save the receipt image.');
        }

        return 'uploads/receipts/' . $filename;
    }
}
