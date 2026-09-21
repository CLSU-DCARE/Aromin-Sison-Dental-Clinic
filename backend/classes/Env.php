<?php
/**
 * Settings reader: Aromin-Sison Dental Clinic System.
 *
 * Reads settings (database login, mail login, site address ...) in this order:
 *   1. real server environment variables (best for a live server)
 *   2. a file called .env.local in the project root
 *   3. a file called .env in the project root
 * The first place that has the setting wins.
 *
 * Usage:
 *   $host = Env::get('ASDC_DB_HOST', '127.0.0.1');
 */

namespace ASDC;

class Env
{
    private static bool $loaded = false;

    /** Read the .env files once per request. */
    public static function load(): void
    {
        if (self::$loaded) {
            return;
        }
        self::$loaded = true;

        foreach ([dirname(__DIR__, 2) . '/.env.local', dirname(__DIR__, 2) . '/.env'] as $path) {
            if (!is_file($path)) continue;
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
                [$key, $value] = array_map('trim', explode('=', $line, 2));
                // A setting that already exists (from the server) is never replaced by a file.
                if ($key !== '' && getenv($key) === false) {
                    putenv($key . '=' . $value);
                    $_ENV[$key] = $value;
                }
            }
        }
    }

    /** Get one setting. Returns $default when it is missing or empty. */
    public static function get(string $key, ?string $default = null): ?string
    {
        self::load();
        $value = getenv($key);
        return ($value === false || $value === '') ? $default : $value;
    }
}
