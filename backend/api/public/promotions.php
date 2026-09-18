<?php
/**
 * Public live/scheduled promotions endpoint.
 */

require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('GET');

$stmt = \ASDC\Database::pdo()->query(
    "SELECT promo_id AS id, title, description AS `desc`, image_path, status, start_date, end_date
     FROM promotions
     WHERE status IN ('live','scheduled')
       AND (end_date IS NULL OR end_date >= CURRENT_DATE())
     ORDER BY promo_id DESC"
);

\ASDC\ApiResponse::ok(['promotions' => $stmt->fetchAll()]);
