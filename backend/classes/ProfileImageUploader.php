<?php
/**
 * Profile image upload handler.
 */

namespace ASDC;

class ProfileImageUploader
{
    private const MAX_BYTES = 3 * 1024 * 1024;
    private const ALLOWED = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    public static function store(?array $file, int $userId): string
    {
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            ApiResponse::error(422, 'validation_failed', 'Please choose a profile picture.', ['profile_picture' => 'Image is required.']);
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            ApiResponse::error(422, 'validation_failed', 'The profile picture upload failed. Please try again.', ['profile_picture' => 'Upload failed.']);
        }
        if (($file['size'] ?? 0) > self::MAX_BYTES) {
            ApiResponse::error(422, 'validation_failed', 'Profile picture must be 3 MB or smaller.', ['profile_picture' => 'File is too large.']);
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        if (!isset(self::ALLOWED[$mime])) {
            ApiResponse::error(422, 'validation_failed', 'Profile picture must be a JPG, PNG, or WEBP image.', ['profile_picture' => 'Unsupported file type.']);
        }

        $dir = dirname(__DIR__) . '/uploads/profiles';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $filename = 'profile_' . $userId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . self::ALLOWED[$mime];
        $dest = $dir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            ApiResponse::error(500, 'upload_failed', 'Could not save the profile picture.');
        }

        return 'uploads/profiles/' . $filename;
    }
}
