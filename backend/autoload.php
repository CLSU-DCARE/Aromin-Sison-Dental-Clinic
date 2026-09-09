<?php
/**
 * PSR-4 autoloader: Aromin-Sison Dental Clinic System.
 *
 * Maps ASDC\ namespace to backend/classes/.
 * Add one require_once at the top of each API endpoint:
 *   require_once __DIR__ . '/../../autoload.php';
 */

spl_autoload_register(function (string $class): void {
    $prefix = 'ASDC\\';
    $baseDir = __DIR__ . '/classes/';

    if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});
