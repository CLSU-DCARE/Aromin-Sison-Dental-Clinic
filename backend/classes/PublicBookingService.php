<?php
/**
 * Public booking service: Aromin-Sison Dental Clinic System.
 *
 * Handles appointment request submission from the public website (no auth required).
 *
 * Usage:
 *   $data = PublicBookingService::submitRequest($body);
 */

namespace ASDC;

use PDO;
use Throwable;

class PublicBookingService
{
    /**
     * Submit an appointment request from the public website.
     *
     * @param array{requested_date: string, requested_time: string, first_name: string,
     *              last_name: string, contact_number: string, service_type: string,
     *              email?: string, preferred_dentist_id?: int, notes?: string} $body
     * @return array{request_id: int, patient_name: string, service_type: string, requested_date: string, requested_time: string, contact_number: string, email: ?string, status: string}
     */
    public static function submitRequest(array $body): array
    {
        [$date, $time] = InputValidator::slot($body, 'requested_date', 'requested_time');

        $values = [];
        foreach (['first_name', 'last_name', 'contact_number', 'service_type'] as $field) {
            $values[$field] = isset($body[$field]) && is_string($body[$field]) ? trim($body[$field]) : '';
        }
        $email = isset($body['email']) && is_string($body['email']) ? trim($body['email']) : '';

        // Validation
        $fields = [];
        foreach (['first_name', 'last_name', 'contact_number', 'service_type'] as $field) {
            if ($values[$field] === '') {
                $fields[$field] = 'This field is required.';
            }
        }
        if (strlen($values['first_name']) > 100 || strlen($values['last_name']) > 100) {
            $fields['name'] = 'Names must be 100 characters or fewer.';
        }
        if (strlen($values['contact_number']) > 20 || !preg_match('/^[0-9+() .-]{7,20}$/', $values['contact_number'])) {
            $fields['contact_number'] = 'Enter a valid contact number.';
        }
        if (!ServiceCatalog::isAppointmentService($values['service_type'])) {
            $fields['service_type'] = 'Please choose a valid service.';
        }
        if ($email !== '' && (strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
            $fields['email'] = 'Enter a valid email address.';
        }

        $dentistId = isset($body['preferred_dentist_id']) ? InputValidator::positiveId($body['preferred_dentist_id']) : null;
        if (isset($body['preferred_dentist_id']) && !$dentistId) {
            $fields['preferred_dentist_id'] = 'Choose a valid dentist.';
        }

        if ($fields) {
            ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);
        }

        if ($dentistId) {
            $pdo = Database::pdo();
            $stmt = $pdo->prepare("SELECT 1 FROM users WHERE user_id=? AND role='dentist' AND is_active=1");
            $stmt->execute([$dentistId]);
            if (!$stmt->fetchColumn()) {
                ApiResponse::error(422, 'validation_failed', 'Please choose an active dentist.', ['preferred_dentist_id' => 'Dentist is unavailable.']);
            }
        }

        $pdo  = Database::pdo();
        $lock = AppointmentSlotManager::lock($pdo, $date, $time);

        try {
            $pdo->beginTransaction();

            if (AppointmentSlotManager::isTaken($pdo, $date, $time)) {
                $pdo->rollBack();
                ApiResponse::error(409, 'slot_unavailable', 'That appointment slot is no longer available.');
            }

            $stmt = $pdo->prepare(
                "INSERT INTO appointment_requests
                    (first_name, last_name, email, contact_number, service_type,
                     preferred_dentist_id, requested_date, requested_time, notes)
                 VALUES (?,?,?,?,?,?,?,?,?)"
            );
            $stmt->execute([
                $values['first_name'],
                $values['last_name'],
                $email ?: null,
                $values['contact_number'],
                $values['service_type'],
                $dentistId,
                $date,
                $time,
                isset($body['notes']) && is_string($body['notes']) ? trim($body['notes']) : null,
            ]);
            $id = (int) $pdo->lastInsertId();
            PortalEvent::appointmentRequest($id, 'received');
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Appointment request failed: ' . $e->getMessage());
            ApiResponse::error(500, 'booking_failed', 'Unable to save the appointment request.');
        } finally {
            AppointmentSlotManager::unlock($pdo, $lock);
        }

        return [
            'request_id' => $id,
            'patient_name' => trim($values['first_name'] . ' ' . $values['last_name']),
            'service_type' => $values['service_type'],
            'requested_date' => $date,
            'requested_time' => $time,
            'contact_number' => $values['contact_number'],
            'email' => $email ?: null,
            'status' => 'pending',
        ];
    }
}
