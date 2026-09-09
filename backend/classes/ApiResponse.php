<?php
/**
 * Standardized JSON API responses: Aromin-Sison Dental Clinic System.
 *
 * Usage:
 *   ApiResponse::ok(['id' => 1], 'Created');
 *   ApiResponse::error(422, 'validation_failed', 'Bad input', ['email' => 'Required']);
 *   $body = ApiResponse::requireJson();
 */

namespace ASDC;

class ApiResponse
{
    public static function json(int $status, array $payload): void
    {
        http_response_code($status);
        echo json_encode($payload, JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok(array $data = [], string $message = 'OK', int $status = 200): void
    {
        self::json($status, ['success' => true, 'message' => $message, 'data' => $data]);
    }

    public static function error(int $status, string $code, string $message, array $fields = []): void
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields) {
            $error['fields'] = $fields;
        }
        self::json($status, ['success' => false, 'error' => $error]);
    }

    public static function requireJson(): array
    {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) {
            self::error(400, 'invalid_json', 'A valid JSON request body is required.');
        }
        return $body;
    }

    public static function method(string ...$allowed): string
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (!in_array($method, $allowed, true)) {
            header('Allow: ' . implode(', ', $allowed));
            self::error(405, 'method_not_allowed', 'Method not allowed.');
        }
        return $method;
    }

    public static function requireJson(): array
    {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) {
            self::error(400, 'invalid_json', 'A valid JSON request body is required.');
        }
        return $body;
    }
}
