<?php
/**
 * Authenticated profile-image delivery.
 * Profile uploads are not public files: a user may retrieve only their own
 * image through the same session and access controls as the rest of the portal.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('GET');
\ASDC\AuthMiddleware::requireLogin();

$stmt = \ASDC\Database::pdo()->prepare('SELECT profile_image_path FROM users WHERE user_id = ? AND is_active = 1');
$stmt->execute([(int) \ASDC\AuthMiddleware::userId()]);
$relative = $stmt->fetchColumn();
$root = realpath(__DIR__ . '/../../uploads/profiles');
$path = $relative ? realpath(__DIR__ . '/../../' . $relative) : false;

if (!$root || !$path || !str_starts_with($path, $root . DIRECTORY_SEPARATOR) || !is_file($path)) {
    \ASDC\ApiResponse::error(404, 'not_found', 'Profile picture not found.');
}

$mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) {
    \ASDC\ApiResponse::error(404, 'not_found', 'Profile picture not found.');
}

header('Content-Type: ' . $mime);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
header('Content-Disposition: inline; filename="profile.' . pathinfo($path, PATHINFO_EXTENSION) . '"');
session_write_close();
readfile($path);
