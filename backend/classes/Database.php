<?php
/**
 * Database singleton: Aromin-Sison Dental Clinic System.
 *
 * Provides a single PDO instance shared across all endpoints.
 * Usage:
 *   $pdo = Database::pdo();
 */

namespace ASDC;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        self::loadLocalEnv();

        $host = trim((string) (getenv('ASDC_DB_HOST') ?: '127.0.0.1'));
        $port = (int) (getenv('ASDC_DB_PORT') ?: 3306);
        $name = trim((string) (getenv('ASDC_DB_NAME') ?: 'aromin_sison_dental'));
        $user = trim((string) (getenv('ASDC_DB_USER') ?: 'root'));
        $pass = (string) getenv('ASDC_DB_PASS');

        try {
            self::$pdo = new PDO(
                "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",
                $user,
                $pass,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            error_log('Database connection failed: ' . $e->getMessage());
            http_response_code(500);
            die(json_encode(['error' => 'Database connection failed.']));
        }

        return self::$pdo;
    }

    private static function loadLocalEnv(): void
    {
        foreach ([dirname(__DIR__, 2) . '/.env.local', dirname(__DIR__, 2) . '/.env'] as $path) {
            if (!is_file($path)) continue;
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
                [$key, $value] = array_map('trim', explode('=', $line, 2));
                if ($key !== '' && getenv($key) === false) {
                    putenv($key . '=' . $value);
                    $_ENV[$key] = $value;
                }
            }
        }
    }
}
