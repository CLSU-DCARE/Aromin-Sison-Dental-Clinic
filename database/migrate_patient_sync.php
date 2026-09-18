<?php
// CLI only. Apply the existing contract/payment migrations without replaying them.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/autoload.php';
$pdo = \ASDC\Database::pdo();
$checks = [
    '004_braces_progress_and_payment_approval.sql' => [
        'braces_contracts' => ['dentist_id', 'current_stage', 'progress_pct', 'progress_note', 'next_note', 'progress_updated_at'],
        'contract_payments' => ['status', 'receipt_path', 'note', 'submitted_by', 'reviewed_by', 'reviewed_at', 'created_at'],
    ],
    '005_contract_downpayment_monthly.sql' => ['braces_contracts' => ['downpayment', 'monthly_payment']],
    '009_promotion_images_dates.sql' => ['promotions' => ['image_path', 'start_date', 'end_date']],
    '010_patient_archival.sql' => ['patients' => ['archived_at', 'archived_by', 'retention_note']],
];
foreach ($checks as $file => $tables) {
    $present = 0; $expected = 0;
    foreach ($tables as $table => $columns) {
        $actual = array_column($pdo->query('SHOW COLUMNS FROM ' . $table)->fetchAll(), 'Field');
        $present += count(array_intersect($actual, $columns));
        $expected += count($columns);
    }
    if ($present === $expected) { echo "Already applied: $file\n"; continue; }
    if ($present !== 0) throw new RuntimeException("Partially applied migration: $file. Review the schema before continuing.");
    $sql = file_get_contents(__DIR__ . '/migrations/' . $file);
    $pdo->exec($sql);
    echo "Applied: $file\n";
}
$pdo->exec(file_get_contents(__DIR__ . '/migrations/006_portal_integration.sql'));
echo "Applied/verified: 006_portal_integration.sql\n";
$columns = array_column($pdo->query('SHOW COLUMNS FROM user_notifications')->fetchAll(), 'Field');
if (!in_array('patient_id', $columns, true)) $pdo->exec(file_get_contents(__DIR__ . '/migrations/007_notification_patient_reference.sql'));
echo "Applied/verified: 007_notification_patient_reference.sql\n";
