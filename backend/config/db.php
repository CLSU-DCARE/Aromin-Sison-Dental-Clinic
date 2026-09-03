<?php
/**
 * Database connection: Aromin-Sison Dental Clinic System
 *
 * Uses PDO so you get prepared statements everywhere (protects against SQL injection).
 * Include this at the top of any PHP file that needs the database:
 *
 *   require_once __DIR__ . '/../../config/db.php';
 *   // then use the $pdo variable
 */

$DB_HOST = '127.0.0.1';
$DB_PORT = 3306;
$DB_NAME = 'aromin_sison_dental';
$DB_USER = 'root';   // default XAMPP user
$DB_PASS = '';        // default XAMPP password is blank

try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false, // use real prepared statements
        ]
    );
} catch (PDOException $e) {
    // Log the real cause server-side, never expose connection details to the client.
    error_log('Database connection failed: ' . $e->getMessage());
    http_response_code(500);
    die(json_encode(['error' => 'Database connection failed.']));
}
