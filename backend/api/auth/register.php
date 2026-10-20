<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
\ASDC\ApiResponse::error(410, 'feature_removed', 'Patient self-service and online payments are no longer available. Please contact clinic staff.');
