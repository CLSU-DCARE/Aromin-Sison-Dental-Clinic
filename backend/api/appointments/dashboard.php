<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';
require_role('receptionist', 'dentist');
\ASDC\ApiResponse::method('GET');
header('Cache-Control: no-store');
$start = \ASDC\InputValidator::date($_GET['start'] ?? date('Y-m-d', strtotime('monday this week')));
if (!$start) \ASDC\ApiResponse::error(422, 'validation_failed', 'Invalid week start.');
try { \ASDC\ApiResponse::ok(\ASDC\StaffDashboardService::snapshot($start)); }
catch (\Throwable $e) { error_log($e->getMessage()); \ASDC\ApiResponse::error(500, 'snapshot_failed', 'Unable to load clinic records.'); }
