<?php
/**
 * Appointment helpers: Aromin-Sison Dental Clinic System.
 *
 * Backward-compatible wrappers around ASDC\ApiResponse,
 * ASDC\InputValidator, and ASDC\AppointmentSlotManager.
 * Classes are auto-loaded via backend/autoload.php.
 */

if (!function_exists('appointment_json')) {
    function appointment_json(int $status, array $payload): void
    {
        \ASDC\ApiResponse::json($status, $payload);
    }

    function appointment_ok(array $data = [], string $message = 'OK', int $status = 200): void
    {
        \ASDC\ApiResponse::ok($data, $message, $status);
    }

    function appointment_error(int $status, string $code, string $message, array $fields = []): void
    {
        \ASDC\ApiResponse::error($status, $code, $message, $fields);
    }

    function appointment_body(): array
    {
        return \ASDC\ApiResponse::requireJson();
    }

    function appointment_date($value): ?string
    {
        return \ASDC\InputValidator::date($value);
    }

    function appointment_time($value): ?string
    {
        return \ASDC\InputValidator::time($value);
    }

    function appointment_positive_id($value): ?int
    {
        return \ASDC\InputValidator::positiveId($value);
    }

    function appointment_validate_slot(array $body, string $dateKey, string $timeKey): array
    {
        return \ASDC\InputValidator::slot($body, $dateKey, $timeKey);
    }

    function appointment_lock(\PDO $pdo, string $date, string $time): string
    {
        return \ASDC\AppointmentSlotManager::lock($pdo, $date, $time);
    }

    function appointment_unlock(\PDO $pdo, string $name): void
    {
        \ASDC\AppointmentSlotManager::unlock($pdo, $name);
    }

    function appointment_slot_taken(\PDO $pdo, string $date, string $time, ?int $excludeAppointment = null, ?int $excludeRequest = null): bool
    {
        return \ASDC\AppointmentSlotManager::isTaken($pdo, $date, $time, $excludeAppointment, $excludeRequest);
    }

    function appointment_assert_method(string ...$allowed): string
    {
        return \ASDC\ApiResponse::method(...$allowed);
    }
}
