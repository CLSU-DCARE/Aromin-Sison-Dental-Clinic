-- Associate shared workflow events with the patient record, including cleanup on deletion.
ALTER TABLE user_notifications
    ADD COLUMN patient_id INT NULL,
    ADD CONSTRAINT fk_inbox_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE;
