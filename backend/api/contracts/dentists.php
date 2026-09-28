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
    \ASDC\ApiResponse::ok(['dentists' => \ASDC\DentistDirectory::listActive()]);
} catch (\PDOException $e) {
    error_log('Dentist list failed: ' . $e->getMessage());
    \ASDC\ApiResponse::error(500, 'server_error', 'Unable to load dentists.');
}
