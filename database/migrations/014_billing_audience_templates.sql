INSERT INTO notification_templates (template_key, name, channel, subject, body, is_active) VALUES
('balance_updated_patient', 'Balance Updated - Patient', 'email',
 'Balance Updated - Aromin-Sison Dental Clinic',
 'Your billing information has been updated. Please review your current balance details below.

Patient ID: {patient_id}
Service/Treatment: {service_treatment}
Total Amount: {total_amount}
Amount Paid: {amount_paid}
Remaining Balance: {remaining_balance}

Your updated balance is now reflected in your patient account. Please review the details and contact the clinic if you have any questions regarding your billing information.',
 1),
('payment_recorded_patient', 'Payment Recorded - Patient', 'email',
 'Payment Recorded - Aromin-Sison Dental Clinic',
 'Your payment has been successfully recorded in the clinic''s billing system.

Patient ID: {patient_id}
Service/Treatment: {service_treatment}
Payment Amount: {payment_amount}
Total Amount: {total_amount}
Remaining Balance: {remaining_balance}

Your remaining balance has been updated accordingly. Please keep this notification for your reference and contact the clinic if you notice any concerns with the payment details.',
 1),
('balance_due_reminder_patient', 'Balance Due Reminder - Patient', 'email',
 'Balance Due Reminder - Aromin-Sison Dental Clinic',
 'This is a friendly reminder regarding your remaining balance with the clinic.

Patient ID: {patient_id}
Service/Treatment: {service_treatment}
Total Amount: {total_amount}
Amount Paid: {amount_paid}
Remaining Balance: {remaining_balance}

Please settle your remaining balance according to the payment arrangements provided by the clinic. If you have already made a payment that is not yet reflected, please contact the clinic for verification.',
 1),
('balance_fully_paid_patient', 'Balance Fully Paid - Patient', 'email',
 'Balance Fully Paid - Aromin-Sison Dental Clinic',
 'Your balance for the indicated treatment or service has been fully settled.

Patient ID: {patient_id}
Service/Treatment: {service_treatment}
Total Amount: {total_amount}
Amount Paid: {amount_paid}
Remaining Balance: {remaining_balance}

Thank you for completing your payment. Your billing record has been updated and now shows a zero remaining balance.',
 1),
('payment_received_staff', 'Payment Received - Admin/Receptionist', 'email',
 'Payment Received - Aromin-Sison Dental Clinic',
 'A payment has been recorded for a patient''s billing account.

Patient ID: {patient_id}
Patient: {patient_name}
Service/Treatment: {service_treatment}
Payment Amount: {payment_amount}
Total Amount: {total_amount}
Remaining Balance: {remaining_balance}

Please verify that the payment has been properly recorded and that the patient''s remaining balance is updated accordingly.',
 1),
('balance_fully_paid_staff', 'Balance Fully Paid - Admin/Receptionist', 'email',
 'Balance Fully Paid - Aromin-Sison Dental Clinic',
 'A patient''s billing account has been fully settled.

Patient ID: {patient_id}
Patient: {patient_name}
Service/Treatment: {service_treatment}
Total Amount: {total_amount}
Amount Paid: {amount_paid}
Remaining Balance: {remaining_balance}

The patient''s balance has been fully paid and the billing record has been updated accordingly.',
 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    channel = VALUES(channel),
    subject = VALUES(subject),
    body = VALUES(body),
    is_active = VALUES(is_active);
