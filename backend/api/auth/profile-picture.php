<?php
/**
 * POST/DELETE /backend/api/auth/profile-picture.php
 * Lets the authenticated user manage their profile picture.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

$method = \ASDC\ApiResponse::method('POST', 'DELETE');
\ASDC\AuthMiddleware::requireLogin();
\ASDC\CsrfToken::requireValid();

$pdo = \ASDC\Database::pdo();
$userId = (int) \ASDC\AuthMiddleware::userId();

$stmt = $pdo->prepare('SELECT profile_image_path FROM users WHERE user_id = ? AND is_active = 1');
$stmt->execute([$userId]);
$current = $stmt->fetchColumn();
if ($current === false) {
    \ASDC\ApiResponse::error(404, 'not_found', 'User account not found.');
}

if ($method === 'DELETE') {
    if ($current) {
        $path = dirname(__DIR__, 2) . '/' . $current;
        if (is_file($path)) @unlink($path);
    }
    $pdo->prepare('UPDATE users SET profile_image_path = NULL WHERE user_id = ?')->execute([$userId]);
    \ASDC\ApiResponse::ok(['profile_image_path' => null, 'profile_image_url' => null], 'Profile picture removed.');
}

$path = \ASDC\ProfileImageUploader::store($_FILES['profile_picture'] ?? null, $userId);
if ($current) {
    $old = dirname(__DIR__, 2) . '/' . $current;
    if (is_file($old)) @unlink($old);
}
$pdo->prepare('UPDATE users SET profile_image_path = ? WHERE user_id = ?')->execute([$path, $userId]);
\ASDC\ApiResponse::ok([
    'profile_image_path' => $path,
    'profile_image_url' => '../backend/api/auth/profile-image.php',
], 'Profile picture updated.');
