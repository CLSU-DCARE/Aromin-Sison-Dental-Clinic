<?php
/**
 * Input validation helpers: Aromin-Sison Dental Clinic System.
 *
 * Usage:
 *   $date = InputValidator::date($raw);
 *   $time = InputValidator::time($raw);
 *   $id   = InputValidator::positiveId($raw);
 *   [$date, $time] = InputValidator::slot($body, 'date', 'time');
 */

namespace ASDC;

class InputValidator
{
    public static function date($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $date = \DateTime::createFromFormat('!Y-m-d', trim($value));
        $errors = \DateTime::getLastErrors();
        return $date && (!$errors || (!$errors['warning_count'] && !$errors['error_count']))
            && $date->format('Y-m-d') === trim($value)
            ? trim($value)
            : null;
    }

    public static function time($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        foreach (['!H:i', '!H:i:s', '!g:i A'] as $format) {
            $time = \DateTime::createFromFormat($format, strtoupper(trim($value)));
            $errors = \DateTime::getLastErrors();
            if ($time && (!$errors || (!$errors['warning_count'] && !$errors['error_count']))) {
                return $time->format('H:i:s');
            }
        }
        return null;
    }

    public static function positiveId($value): ?int
    {
        $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        return $id === false ? null : (int) $id;
    }

    public static function required(string $value, string $name): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            ApiResponse::error(422, 'validation_failed', "Please correct the highlighted fields.", [$name => 'This field is required.']);
        }
        return $trimmed;
    }

    public static function email(string $value): ?string
    {
        $trimmed = trim($value);
        if (!filter_var($trimmed, FILTER_VALIDATE_EMAIL)) {
            return null;
        }
        return $trimmed;
    }

    public static function slot(array $body, string $dateKey, string $timeKey): array
    {
        $date = self::date($body[$dateKey] ?? null);
        $time = self::time($body[$timeKey] ?? null);
        $fields = [];
        if (!$date || $date < date('Y-m-d')) {
            $fields[$dateKey] = 'Use today or a future date in YYYY-MM-DD format.';
        }
        if (!$time) {
            $fields[$timeKey] = 'Use a valid time.';
        }
        if ($fields) {
            ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);
        }
        return [$date, $time];
    }
}
