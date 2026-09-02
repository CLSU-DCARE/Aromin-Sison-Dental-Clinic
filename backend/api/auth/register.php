<?php
/**
 * POST /backend/api/auth/register.php
 * Creates a patient portal account. Staff accounts remain administrator-created.
 */

header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid JSON request body is required.']);
    exit;
}

$firstName = isset($input['first_name']) && is_string($input['first_name'])
    ? trim($input['first_name']) : '';
$lastName = isset($input['last_name']) && is_string($input['last_name'])
    ? trim($input['last_name']) : '';
$email = isset($input['email']) && is_string($input['email'])
    ? strtolower(trim($input['email'])) : '';
$contactNumber = isset($input['contact_number']) && is_string($input['contact_number'])
    ? trim($input['contact_number']) : '';
$password = isset($input['password']) && is_string($input['password'])
    ? $input['password'] : '';

if ($firstName === '' || $lastName === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'First name, last name, email, and password are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email address is required.']);
    exit;
}

if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters.']);
    exit;
}

if (strlen($firstName) > 100 || strlen($lastName) > 100 || strlen($email) > 150 || strlen($contactNumber) > 20) {
    http_response_code(400);
    echo json_encode(['error' => 'One or more fields exceed the allowed length.']);
    exit;
}

try {
    $pdo->beginTransaction();

    $existingUser = $pdo->prepare('SELECT user_id FROM users WHERE email = ? LIMIT 1');
    $existingUser->execute([$email]);
    if ($existingUser->fetch()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'An account already uses this email address.']);
        exit;
    }

    $fullName = trim($firstName . ' ' . $lastName);
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $insertUser = $pdo->prepare('
        INSERT INTO users (role, email, password_hash, full_name, contact_number, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
    ');
    $insertUser->execute(['patient', $email, $passwordHash, $fullName, $contactNumber ?: null]);
    $userId = (int) $pdo->lastInsertId();

    $existingPatient = $pdo->prepare('
        SELECT patient_id
        FROM patients
        WHERE email = ? AND user_id IS NULL
        ORDER BY patient_id ASC
        LIMIT 1
        FOR UPDATE
    ');
    $existingPatient->execute([$email]);
    $patient = $existingPatient->fetch();

    if ($patient) {
        $linkPatient = $pdo->prepare('
            UPDATE patients
            SET user_id = ?, first_name = ?, last_name = ?, contact_number = ?
            WHERE patient_id = ?
        ');
        $linkPatient->execute([$userId, $firstName, $lastName, $contactNumber ?: null, $patient['patient_id']]);
    } else {
        $insertPatient = $pdo->prepare('
            INSERT INTO patients (user_id, first_name, last_name, contact_number, email)
            VALUES (?, ?, ?, ?, ?)
        ');
        $insertPatient->execute([$userId, $firstName, $lastName, $contactNumber ?: null, $email]);
    }

    $pdo->commit();
    http_response_code(201);
    echo json_encode([
        'success' => true,
        'user' => [
            'user_id' => $userId,
            'role' => 'patient',
            'email' => $email,
            'full_name' => $fullName,
        ],
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Patient registration failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to create the patient account.']);
}
