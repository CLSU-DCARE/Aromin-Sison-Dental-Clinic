<?php
namespace ASDC;

class PromotionImageUploader
{
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const ALLOWED = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public static function store(?array $file): ?string
    {
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if ($file['error'] !== UPLOAD_ERR_OK) {
            ApiResponse::error(422, 'validation_failed', 'The promotion image upload failed.', ['image' => 'Upload failed.']);
        }
        if (($file['size'] ?? 0) > self::MAX_BYTES) {
            ApiResponse::error(422, 'validation_failed', 'Promotion image must be 5 MB or smaller.', ['image' => 'File is too large.']);
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!isset(self::ALLOWED[$mime])) {
            ApiResponse::error(422, 'validation_failed', 'Promotion image must be a JPG, PNG, or WEBP file.', ['image' => 'Unsupported file type.']);
        }

        $dir = dirname(__DIR__) . '/uploads/promotions';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $filename = 'promotion_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . self::ALLOWED[$mime];
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
            ApiResponse::error(500, 'upload_failed', 'Could not save the promotion image.');
        }

        return 'uploads/promotions/' . $filename;
    }
}
