<?php
namespace ASDC;

class PromotionalCaseImageUploader
{
    private const MAX_BYTES = 8 * 1024 * 1024;
    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public static function store(?array $file): ?string
    {
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
            ApiResponse::error(422, 'validation_failed', 'The case image upload failed.', ['image' => 'Upload failed.']);
        }
        if (($file['size'] ?? 0) < 1 || $file['size'] > self::MAX_BYTES) {
            ApiResponse::error(422, 'validation_failed', 'Each case image must be 8 MB or smaller.', ['image' => 'File is too large.']);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!isset(self::TYPES[$mime])) {
            ApiResponse::error(422, 'validation_failed', 'Case images must be JPG, PNG, or WEBP files.', ['image' => 'Unsupported file type.']);
        }
        $dir = dirname(__DIR__) . '/storage/promotional-cases';
        if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
            ApiResponse::error(500, 'upload_failed', 'Could not prepare private case image storage.');
        }
        $filename = bin2hex(random_bytes(24)) . '.' . self::TYPES[$mime];
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
            ApiResponse::error(500, 'upload_failed', 'Could not save the case image.');
        }
        return $filename;
    }

    public static function delete(?string $filename): void
    {
        if (!$filename || !preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/', $filename)) return;
        $path = dirname(__DIR__) . '/storage/promotional-cases/' . $filename;
        if (is_file($path)) @unlink($path);
    }
}
