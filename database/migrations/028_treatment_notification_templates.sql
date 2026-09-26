INSERT INTO notification_templates (template_key, name, channel, subject, body)
VALUES
('treatment_record_updated_patient', 'Treatment Record Updated', 'email',
 'Treatment Record Updated - Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your treatment record has been updated. Service: {service_treatment}. Date: {date}. Dentist: {dentist}. Notes: {notes}. - Aromin-Sison Dental Clinic')
ON DUPLICATE KEY UPDATE
 name=VALUES(name), channel=VALUES(channel), subject=VALUES(subject), body=VALUES(body), is_active=1;

UPDATE notification_templates
SET body='Hi {patient_name}, your treatment progress has been updated. Current stage: {stage}. Progress: {progress}%. Next step: {next}. Dentist notes: {notes}. - Aromin-Sison Dental Clinic',
    is_active=1
WHERE template_key='braces_progress_updated';
