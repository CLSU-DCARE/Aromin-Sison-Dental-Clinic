UPDATE notification_templates
SET is_active = 0
WHERE template_key IN (
    'appointment_reminder',
    'appointment_confirmation',
    'appointment_cancellation',
    'payment_due',
    'payment_received'
);
