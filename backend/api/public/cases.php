<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';

\ASDC\ApiResponse::method('GET');
$stmt = \ASDC\Database::pdo()->query(
    "SELECT case_id AS id,title,treatment_category AS category,short_description AS description,case_date,publication_date,
            collage_image_path IS NOT NULL AS has_case_image,
            before_image_path IS NOT NULL AS has_before_image,after_image_path IS NOT NULL AS has_after_image
     FROM promotional_cases
     WHERE status='published' AND is_featured=1 AND consent_confirmed=1
     ORDER BY publication_date DESC,case_id DESC"
);
\ASDC\ApiResponse::ok(['cases' => $stmt->fetchAll()]);
