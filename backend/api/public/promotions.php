<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('GET');
\ASDC\ApiResponse::error(410, 'endpoint_retired', 'Discount promotions are no longer published.');
