<?php
// CLI only. Applies database/migrations/*.sql once and records them in schema_migrations.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../backend/autoload.php';

$pdo = \ASDC\Database::pdo();
$pdo->exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (
        migration VARCHAR(191) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

$applied = array_column($pdo->query('SELECT migration FROM schema_migrations')->fetchAll(), 'migration');
$applied = array_fill_keys($applied, true);
$files = glob(__DIR__ . '/migrations/*.sql') ?: [];
sort($files, SORT_NATURAL);

function table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
    );
    $stmt->execute([$table]);
    return (int) $stmt->fetchColumn() > 0;
}

function table_columns(PDO $pdo, string $table): array
{
    if (!table_exists($pdo, $table)) return [];
    return array_column($pdo->query('SHOW COLUMNS FROM ' . $table)->fetchAll(), 'Field');
}

function has_columns(PDO $pdo, string $table, array $columns): bool
{
    $actual = table_columns($pdo, $table);
    return count(array_intersect($actual, $columns)) === count($columns);
}

function column_type(PDO $pdo, string $table, string $column): ?string
{
    $stmt = $pdo->prepare(
        'SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);
    $row = $stmt->fetch();
    return $row['COLUMN_TYPE'] ?? null;
}

function template_keys_exist(PDO $pdo, array $keys): bool
{
    if ($keys === []) return true;
    $placeholders = implode(',', array_fill(0, count($keys), '?'));
    $stmt = $pdo->prepare("SELECT COUNT(DISTINCT template_key) FROM notification_templates WHERE template_key IN ({$placeholders})");
    $stmt->execute($keys);
    return (int) $stmt->fetchColumn() === count($keys);
}

function template_keys_are_inactive(PDO $pdo, array $keys): bool
{
    if (!template_keys_exist($pdo, $keys)) return false;
    $placeholders = implode(',', array_fill(0, count($keys), '?'));
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM notification_templates WHERE template_key IN ({$placeholders}) AND is_active = 1");
    $stmt->execute($keys);
    return (int) $stmt->fetchColumn() === 0;
}

function template_bodies_exclude_contact_details(PDO $pdo, array $keys): bool
{
    if (!template_keys_exist($pdo, $keys)) return false;
    $placeholders = implode(',', array_fill(0, count($keys), '?'));
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM notification_templates WHERE template_key IN ({$placeholders}) AND (body LIKE '%Contact Number: {contact_number}%' OR body LIKE '%Email: {email}%')");
    $stmt->execute($keys);
    return (int) $stmt->fetchColumn() === 0;
}

function seed_dentist_passwords_are_current(PDO $pdo): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM users WHERE '
        . '(email = ? AND password_hash = ?) OR (email = ? AND password_hash = ?)'
    );
    $stmt->execute([
        'arsenia.aromin@arominsison.local',
        '$2y$10$XZufABQCw6oroU/Kfkcu2OjRDf/Sjxihczayedp7WOyAkwxYSlCma',
        'kathrine.sison@arominsison.local',
        '$2y$10$XZufABQCw6oroU/Kfkcu2OjRDf/Sjxihczayedp7WOyAkwxYSlCma',
    ]);
    return (int) $stmt->fetchColumn() === 2;
}

const APPOINTMENT_TEMPLATE_KEYS = [
    'appointment_request_submitted_patient', 'appointment_request_submitted_staff',
    'appointment_confirmed_patient', 'appointment_confirmed_staff',
    'appointment_cancelled_patient', 'appointment_cancelled_staff',
    'appointment_rescheduled_patient', 'appointment_rescheduled_staff',
    'appointment_rejected_patient', 'appointment_reminder_patient',
    'appointment_completed_patient', 'appointment_no_show_patient',
];
const BILLING_TEMPLATE_KEYS = [
    'balance_updated_patient', 'payment_recorded_patient', 'balance_due_reminder_patient',
    'balance_fully_paid_patient', 'payment_received_staff', 'balance_fully_paid_staff',
];
const LEGACY_TEMPLATE_KEYS = [
    'appointment_reminder', 'appointment_confirmation', 'appointment_cancellation',
    'payment_due', 'payment_received',
];

function migration_already_present(PDO $pdo, string $name): bool
{
    return match ($name) {
        '001_password_reset_tokens.sql' => table_exists($pdo, 'password_reset_tokens'),
        '002_appointments_module.sql' => table_exists($pdo, 'appointment_requests')
            && has_columns($pdo, 'appointments', ['appointment_id', 'scheduled_date', 'scheduled_time', 'status']),
        '003_rate_limits.sql' => table_exists($pdo, 'rate_limits'),
        '004_braces_progress_and_payment_approval.sql' => has_columns($pdo, 'braces_contracts', ['dentist_id', 'current_stage', 'progress_pct', 'progress_note', 'next_note', 'progress_updated_at'])
            && has_columns($pdo, 'contract_payments', ['status', 'receipt_path', 'note', 'submitted_by', 'reviewed_by', 'reviewed_at', 'created_at']),
        '005_contract_downpayment_monthly.sql' => has_columns($pdo, 'braces_contracts', ['downpayment', 'monthly_payment']),
        '006_portal_integration.sql' => table_exists($pdo, 'user_notifications'),
        '007_notification_patient_reference.sql' => has_columns($pdo, 'user_notifications', ['patient_id']),
        '008_seed_dentist_accounts.sql' => (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role='dentist'")->fetchColumn() >= 2,
        '009_promotion_images_dates.sql' => has_columns($pdo, 'promotions', ['image_path', 'start_date', 'end_date']),
        '010_patient_archival.sql' => has_columns($pdo, 'patients', ['archived_at', 'archived_by', 'retention_note']),
        '011_remove_sms_notifications.sql' => column_type($pdo, 'notification_templates', 'channel') === "enum('email')",
        '012_rotate_seed_dentist_passwords.sql' => seed_dentist_passwords_are_current($pdo),
        '013_appointment_audience_templates.sql' => template_keys_exist($pdo, APPOINTMENT_TEMPLATE_KEYS),
        '014_billing_audience_templates.sql' => template_keys_exist($pdo, BILLING_TEMPLATE_KEYS),
        '015_deactivate_redundant_email_templates.sql' => template_keys_are_inactive($pdo, LEGACY_TEMPLATE_KEYS),
        '016_remove_contact_email_from_notification_templates.sql' => template_bodies_exclude_contact_details($pdo, array_merge(APPOINTMENT_TEMPLATE_KEYS, BILLING_TEMPLATE_KEYS)),
        '017_user_profile_pictures.sql' => has_columns($pdo, 'users', ['profile_image_path']),
        '019_general_treatment_billing.sql' => table_exists($pdo, 'treatment_bills') && table_exists($pdo, 'treatment_payments'),
        default => false,
    };
}

foreach ($files as $path) {
    $name = basename($path);
    if (isset($applied[$name])) {
        echo "Already applied: {$name}\n";
        continue;
    }
    if (migration_already_present($pdo, $name)) {
        $stmt = $pdo->prepare('INSERT INTO schema_migrations (migration) VALUES (?)');
        $stmt->execute([$name]);
        echo "Marked present: {$name}\n";
        continue;
    }

    $sql = trim((string) file_get_contents($path));
    if ($sql === '') {
        echo "Skipped empty migration: {$name}\n";
        continue;
    }

    try {
        $pdo->exec($sql);
        $stmt = $pdo->prepare('INSERT INTO schema_migrations (migration) VALUES (?)');
        $stmt->execute([$name]);
        echo "Applied: {$name}\n";
    } catch (Throwable $e) {
        throw new RuntimeException("Migration failed ({$name}): " . $e->getMessage(), 0, $e);
    }
}
