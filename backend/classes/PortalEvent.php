<?php
namespace ASDC;

/** Write inside the caller's transaction so inbox events follow committed changes. */
class PortalEvent
{
    public static function patient(
        int $patientId,
        string $title,
        string $message,
        string $type = 'info',
        bool $includeActor = false
    ): void {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            "SELECT u.user_id
             FROM patients p
             JOIN users u ON u.user_id = p.user_id
             WHERE p.patient_id = ? AND u.is_active = 1"
        );
        $stmt->execute([$patientId]);
        foreach ($stmt->fetchAll(\PDO::FETCH_COLUMN) as $userId) {
            if ($includeActor || (int) $userId !== (int) ($_SESSION['user_id'] ?? 0)) {
                UserNotificationService::create((int) $userId, $title, $message, $type, $patientId);
            }
        }
    }

    public static function appointment(int $id, string $action, array $context = []): void
    {
        $stmt = Database::pdo()->prepare(
            "SELECT a.appointment_id, a.patient_id, a.service_type, a.scheduled_date,
                    a.scheduled_time, a.status, a.notes,
                    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                    p.email, p.contact_number,
                    a.dentist_id, d.full_name AS dentist_name
             FROM appointments a
             JOIN patients p ON p.patient_id = a.patient_id
             LEFT JOIN users d ON d.user_id = a.dentist_id
             WHERE a.appointment_id = ?"
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return;

        $patientTitle = match ($action) {
            'requested' => 'Appointment Request Submitted',
            'confirmed' => 'Appointment Confirmed',
            'rescheduled', 'reschedule requested' => 'Appointment Rescheduled',
            'cancelled' => 'Appointment Cancelled',
            'rejected' => 'Appointment Rejected',
            'completed' => 'Appointment Completed',
            'no_show' => 'Did Not Attend / No-Show',
            default => 'Appointment ' . self::label($action),
        };
        $replacements = self::appointmentReplacements($row, $context);
        $patientTemplate = self::templateKeyForAppointment($action, 'patient');
        self::patient(
            (int) $row['patient_id'],
            $patientTitle,
            self::renderTemplate($patientTemplate, self::appointmentMessage($row, $action, 'patient', $context), $replacements),
            'appt',
            true
        );
        self::emailPatientForAppointment($row, $action, $context);

        if (in_array($action, ['requested', 'confirmed', 'rescheduled', 'reschedule requested', 'cancelled'], true)) {
            $staffTitle = match ($action) {
                'requested' => 'New Appointment Request',
                'confirmed' => 'Appointment Confirmed',
                'rescheduled', 'reschedule requested' => 'Appointment Rescheduled',
                'cancelled' => 'Appointment Cancelled',
                default => 'Appointment ' . self::label($action),
            };
            self::staff(
                $staffTitle,
                self::renderTemplate(self::templateKeyForAppointment($action, 'staff'), self::appointmentMessage($row, $action, 'staff', $context), $replacements),
                'appt',
                (int) $row['patient_id'],
                $action === 'confirmed',
                isset($row['dentist_id']) ? (int) $row['dentist_id'] : null,
                true
            );
        }
    }

    public static function appointmentRequest(int $id, string $action): void
    {
        $stmt = Database::pdo()->prepare(
            "SELECT r.request_id, r.first_name, r.last_name, r.email, r.contact_number,
                    r.service_type, r.requested_date, r.requested_time, r.status,
                    r.notes, r.preferred_dentist_id, d.full_name AS dentist_name
             FROM appointment_requests r
             LEFT JOIN users d ON d.user_id = r.preferred_dentist_id
             WHERE r.request_id = ?"
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return;

        $message = self::renderTemplate(
            'appointment_request_submitted_staff',
            self::requestMessage($row, 'staff'),
            self::requestReplacements($row)
        );
        self::staff(
            'New Appointment Request',
            $message,
            'appt',
            null,
            false,
            isset($row['preferred_dentist_id']) ? (int) $row['preferred_dentist_id'] : null,
            true
        );
        if ($action === 'received') {
            self::emailRequestSubmitter($row);
        }
    }

    public static function staffNotice(string $title, string $message, string $type = 'general', ?int $patientId = null, bool $includeActor = false): void
    {
        self::staff($title, $message, $type, $patientId, $includeActor);
    }

    private static function staff(
        string $title,
        string $message,
        string $type,
        ?int $patientId = null,
        bool $includeActor = false,
        ?int $dentistId = null,
        bool $includeAllDentistsWhenUnassigned = false
    ): void
    {
        $pdo = Database::pdo();
        $stmt = $pdo->query("SELECT user_id FROM users WHERE is_active=1 AND role='receptionist'");
        $recipientIds = array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN));

        if ($dentistId) {
            $stmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id=? AND is_active=1 AND role='dentist'");
            $stmt->execute([$dentistId]);
            $dentistRecipient = $stmt->fetchColumn();
            if ($dentistRecipient) $recipientIds[] = (int) $dentistRecipient;
        } elseif ($includeAllDentistsWhenUnassigned) {
            $stmt = $pdo->query("SELECT user_id FROM users WHERE is_active=1 AND role='dentist'");
            $recipientIds = array_merge($recipientIds, array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN)));
        }

        foreach (array_values(array_unique($recipientIds)) as $userId) {
            if ($includeActor || (int) $userId !== (int) ($_SESSION['user_id'] ?? 0)) {
                UserNotificationService::create((int) $userId, $title, $message, $type, $patientId);
            }
        }
    }

    private static function appointmentMessage(array $row, string $action, string $audience = 'patient', array $context = []): string
    {
        $lines = [];

        if ($audience === 'staff') {
            $lines[] = match ($action) {
                'requested' => 'A new appointment request has been submitted by a patient and is ready for review.',
                'confirmed' => "The patient's appointment has been successfully confirmed.",
                'rescheduled', 'reschedule requested' => "An appointment has been rescheduled and the patient's schedule has been updated.",
                'cancelled' => 'An appointment has been cancelled and the schedule has been updated.',
                default => 'Please review the appointment details.',
            };
        } elseif ($action === 'requested') {
            $lines[] = 'Your appointment request was received by the clinic and is waiting for approval.';
        } elseif ($action === 'confirmed') {
            $lines[] = 'Your appointment has been approved. Please arrive on time or contact the clinic if you need changes.';
        } elseif (in_array($action, ['rescheduled', 'reschedule requested'], true)) {
            $lines[] = 'The appointment schedule was updated. Please review the new date and time.';
        } elseif ($action === 'cancelled') {
            $lines[] = 'This appointment has been cancelled.';
        } elseif ($action === 'completed') {
            $lines[] = 'This visit has been marked completed.';
        } elseif ($action === 'no_show') {
            $lines[] = 'This visit was marked as no-show.';
        } else {
            $lines[] = 'Please review the appointment details.';
        }

        $lines[] = 'Appointment ID: #' . $row['appointment_id'];
        if ($audience === 'staff') $lines[] = 'Patient: ' . $row['patient_name'];
        $lines[] = 'Service: ' . $row['service_type'];
        if (!empty($context['previous_date']) || !empty($context['previous_time'])) {
            $lines[] = 'Previous date: ' . self::fmtDate($context['previous_date'] ?? null);
            $lines[] = 'Previous time: ' . self::fmtTime($context['previous_time'] ?? null);
            $lines[] = 'New date: ' . self::fmtDate($row['scheduled_date']);
            $lines[] = 'New time: ' . self::fmtTime($row['scheduled_time']);
        } else {
            $lines[] = 'Date: ' . self::fmtDate($row['scheduled_date']);
            $lines[] = 'Time: ' . self::fmtTime($row['scheduled_time']);
        }
        $lines[] = 'Dentist: ' . ($row['dentist_name'] ?: 'To be assigned');

        if ($row['contact_number']) $lines[] = 'Contact number: ' . $row['contact_number'];
        if ($row['email']) $lines[] = 'Email: ' . $row['email'];
        if (!empty($context['reason'])) $lines[] = 'Reason: ' . $context['reason'];

        return implode("\n", $lines);
    }

    private static function requestMessage(array $row, string $audience): string
    {
        $patientName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        $lines = [
            $audience === 'staff'
                ? 'A new appointment request has been submitted by a patient and is ready for review.'
                : 'Your appointment request has been successfully submitted and is now waiting for the clinic review.',
            'Appointment ID: #' . $row['request_id'],
        ];
        if ($audience === 'staff') $lines[] = 'Patient: ' . ($patientName ?: 'Walk-in request');
        $lines[] = 'Service: ' . $row['service_type'];
        $lines[] = 'Date: ' . self::fmtDate($row['requested_date']);
        $lines[] = 'Time: ' . self::fmtTime($row['requested_time']);
        $lines[] = 'Dentist: ' . ($row['dentist_name'] ?: 'To be assigned');
        if ($row['contact_number']) $lines[] = 'Contact number: ' . $row['contact_number'];
        if ($row['email']) $lines[] = 'Email: ' . $row['email'];
        if ($row['notes']) $lines[] = 'Message: ' . $row['notes'];
        return implode("\n", $lines);
    }

    private static function emailPatientForAppointment(array $row, string $action, array $context): void
    {
        $templateKey = self::templateKeyForAppointment($action, 'patient');
        if (!$templateKey) return;
        try {
            NotificationSendService::send((int) $row['patient_id'], [
                'template_key' => $templateKey,
                'replacements' => self::appointmentReplacements($row, $context),
                'appointment_id' => (int) $row['appointment_id'],
            ]);
        } catch (\Throwable $e) {
            error_log('Appointment email notification failed: ' . $e->getMessage());
        }
    }

    private static function emailRequestSubmitter(array $row): void
    {
        if (empty($row['email']) || !filter_var($row['email'], FILTER_VALIDATE_EMAIL)) return;
        $template = NotificationTemplateService::getByKey('appointment_request_submitted_patient');
        if (!$template) return;
        $replacements = self::requestReplacements($row);
        try {
            Mailer::sendEmail(
                $row['email'],
                TemplateRenderer::render($template['subject'] ?: 'Appointment Request Submitted - Aromin-Sison Dental Clinic', $replacements),
                TemplateRenderer::render($template['body'], $replacements)
            );
        } catch (\Throwable $e) {
            error_log('Public request email notification failed: ' . $e->getMessage());
        }
    }

    private static function appointmentReplacements(array $row, array $context = []): array
    {
        return [
            'appointment_id' => '#' . $row['appointment_id'],
            'patient_name' => $row['patient_name'] ?? '',
            'service' => $row['service_type'] ?? '',
            'appointment_date' => self::fmtDate($row['scheduled_date'] ?? null),
            'appointment_time' => self::fmtTime($row['scheduled_time'] ?? null),
            'previous_date' => self::fmtDate($context['previous_date'] ?? null),
            'previous_time' => self::fmtTime($context['previous_time'] ?? null),
            'new_date' => self::fmtDate($row['scheduled_date'] ?? null),
            'new_time' => self::fmtTime($row['scheduled_time'] ?? null),
            'dentist_name' => $row['dentist_name'] ?: 'To be assigned',
            'contact_number' => $row['contact_number'] ?: 'Not provided',
            'email' => $row['email'] ?: 'Not provided',
            'reason' => $context['reason'] ?? 'No reason provided',
        ];
    }

    private static function templateKeyForAppointment(string $action, string $audience): ?string
    {
        if ($audience === 'staff') {
            return match ($action) {
                'requested' => 'appointment_request_submitted_staff',
                'confirmed' => 'appointment_confirmed_staff',
                'cancelled' => 'appointment_cancelled_staff',
                'rescheduled', 'reschedule requested' => 'appointment_rescheduled_staff',
                default => null,
            };
        }
        return match ($action) {
            'requested' => 'appointment_request_submitted_patient',
            'confirmed' => 'appointment_confirmed_patient',
            'cancelled' => 'appointment_cancelled_patient',
            'rescheduled', 'reschedule requested' => 'appointment_rescheduled_patient',
            'rejected' => 'appointment_rejected_patient',
            'completed' => 'appointment_completed_patient',
            'no_show' => 'appointment_no_show_patient',
            default => null,
        };
    }

    private static function renderTemplate(?string $templateKey, string $fallback, array $replacements): string
    {
        if (!$templateKey) return $fallback;
        $template = NotificationTemplateService::getByKey($templateKey);
        if (!$template || empty($template['body'])) return $fallback;
        return TemplateRenderer::render($template['body'], $replacements);
    }

    private static function requestReplacements(array $row): array
    {
        $patientName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        return [
            'appointment_id' => '#' . $row['request_id'],
            'patient_name' => $patientName,
            'service' => $row['service_type'] ?? '',
            'appointment_date' => self::fmtDate($row['requested_date'] ?? null),
            'appointment_time' => self::fmtTime($row['requested_time'] ?? null),
            'dentist_name' => $row['dentist_name'] ?: 'To be assigned',
            'contact_number' => $row['contact_number'] ?: 'Not provided',
            'email' => $row['email'] ?: 'Not provided',
            'reason' => $row['notes'] ?: 'No reason provided',
        ];
    }

    private static function fmtDate(?string $value): string
    {
        if (!$value) return 'Not set';
        $date = \DateTime::createFromFormat('Y-m-d', $value);
        return $date ? $date->format('F j, Y') : $value;
    }

    private static function fmtTime(?string $value): string
    {
        if (!$value) return 'Not set';
        $time = \DateTime::createFromFormat('H:i:s', $value);
        if (!$time) $time = \DateTime::createFromFormat('H:i', $value);
        return $time ? $time->format('g:i A') : $value;
    }

    private static function label(?string $value): string
    {
        return ucwords(str_replace('_', ' ', (string) $value));
    }
}
