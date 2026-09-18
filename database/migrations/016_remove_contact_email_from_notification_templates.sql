UPDATE notification_templates
SET body = REPLACE(
    REPLACE(body, CONCAT(CHAR(10), 'Contact Number: {contact_number}'), ''),
    CONCAT(CHAR(10), 'Email: {email}'),
    ''
)
WHERE template_key IN (
    'appointment_request_submitted_patient',
    'appointment_request_submitted_staff',
    'appointment_confirmed_patient',
    'appointment_confirmed_staff',
    'appointment_cancelled_patient',
    'appointment_cancelled_staff',
    'appointment_rescheduled_patient',
    'appointment_rescheduled_staff',
    'appointment_rejected_patient',
    'appointment_reminder_patient',
    'appointment_completed_patient',
    'appointment_no_show_patient',
    'balance_updated_patient',
    'payment_recorded_patient',
    'balance_due_reminder_patient',
    'balance_fully_paid_patient',
    'payment_received_staff',
    'balance_fully_paid_staff'
);
