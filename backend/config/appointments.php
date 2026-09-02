<?php

if (!function_exists('appointment_json')) {
    function appointment_json(int $status, array $payload): void
    {
        http_response_code($status);
        echo json_encode($payload, JSON_UNESCAPED_SLASHES);
        exit;
    }

    function appointment_ok(array $data = [], string $message = 'OK', int $status = 200): void
    {
        appointment_json($status, ['success' => true, 'message' => $message, 'data' => $data]);
    }

    function appointment_error(int $status, string $code, string $message, array $fields = []): void
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields) $error['fields'] = $fields;
        appointment_json($status, ['success' => false, 'error' => $error]);
    }

    function appointment_body(): array
    {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) appointment_error(400, 'invalid_json', 'A valid JSON request body is required.');
        return $body;
    }

    function appointment_date($value): ?string
    {
        if (!is_string($value)) return null;
        $date = DateTime::createFromFormat('!Y-m-d', trim($value));
        $errors = DateTime::getLastErrors();
        return $date && (!$errors || (!$errors['warning_count'] && !$errors['error_count']))
            && $date->format('Y-m-d') === trim($value) ? trim($value) : null;
    }

    function appointment_time($value): ?string
    {
        if (!is_string($value)) return null;
        foreach (['!H:i', '!H:i:s', '!g:i A'] as $format) {
            $time = DateTime::createFromFormat($format, strtoupper(trim($value)));
            $errors = DateTime::getLastErrors();
            if ($time && (!$errors || (!$errors['warning_count'] && !$errors['error_count']))) return $time->format('H:i:s');
        }
        return null;
    }

    function appointment_positive_id($value): ?int
    {
        $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        return $id === false ? null : (int) $id;
    }

    function appointment_validate_slot(array $body, string $dateKey, string $timeKey): array
    {
        $date = appointment_date($body[$dateKey] ?? null);
        $time = appointment_time($body[$timeKey] ?? null);
        $fields = [];
        if (!$date || $date < date('Y-m-d')) $fields[$dateKey] = 'Use today or a future date in YYYY-MM-DD format.';
        if (!$time) $fields[$timeKey] = 'Use a valid time.';
        if ($fields) appointment_error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);
        return [$date, $time];
    }

    function appointment_lock(PDO $pdo, string $date, string $time): string
    {
        $name = 'asdc_slot_' . $date . '_' . str_replace(':', '', $time);
        $stmt = $pdo->prepare('SELECT GET_LOCK(?, 5)');
        $stmt->execute([$name]);
        if ((int) $stmt->fetchColumn() !== 1) appointment_error(503, 'slot_lock_timeout', 'The slot is busy. Please try again.');
        return $name;
    }

    function appointment_unlock(PDO $pdo, string $name): void
    {
        $stmt = $pdo->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->execute([$name]);
    }

    function appointment_slot_taken(PDO $pdo, string $date, string $time, ?int $excludeAppointment = null, ?int $excludeRequest = null): bool
    {
        $sql = "SELECT 1 FROM appointments WHERE scheduled_date=? AND scheduled_time=? AND status IN ('pending','confirmed')";
        $params = [$date, $time];
        if ($excludeAppointment) { $sql .= ' AND appointment_id<>?'; $params[] = $excludeAppointment; }
        $sql .= ' LIMIT 1';
        $stmt = $pdo->prepare($sql); $stmt->execute($params);
        if ($stmt->fetchColumn()) return true;

        $sql = "SELECT 1 FROM appointment_requests WHERE requested_date=? AND requested_time=? AND status IN ('pending','rescheduled')";
        $params = [$date, $time];
        if ($excludeRequest) { $sql .= ' AND request_id<>?'; $params[] = $excludeRequest; }
        $sql .= ' LIMIT 1';
        $stmt = $pdo->prepare($sql); $stmt->execute($params);
        return (bool) $stmt->fetchColumn();
    }

    function appointment_assert_method(string ...$allowed): string
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (!in_array($method, $allowed, true)) {
            header('Allow: ' . implode(', ', $allowed));
            appointment_error(405, 'method_not_allowed', 'Method not allowed.');
        }
        return $method;
    }
}
