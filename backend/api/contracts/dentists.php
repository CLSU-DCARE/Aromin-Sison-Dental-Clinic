<?php
/**
 * GET /backend/api/contracts/dentists.php
 * Lists dentist provider profiles, for the "Treating Dentist" picker on the
 * Braces Contract form (receptionist-only).
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

\ASDC\ApiResponse::method('GET');
require_role('receptionist', 'dentist', 'patient');

try {
    $stmt = \ASDC\Database::pdo()->query(
        "SELECT dentist_id, full_name FROM dentists WHERE is_active = 1 ORDER BY full_name"
    );
    \ASDC\ApiResponse::ok(['dentists' => $stmt->fetchAll()]);
} catch (\PDOException $e) {
    error_log('Dentist list failed: ' . $e->getMessage());
    \ASDC\ApiResponse::error(500, 'server_error', 'Unable to load dentists.');
}
