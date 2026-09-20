-- Add appointment_id to notification_logs to link notifications with their appointment status
ALTER TABLE notification_logs 
ADD COLUMN appointment_id INT NULL AFTER template_id,
ADD CONSTRAINT fk_notification_log_appointment 
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL;