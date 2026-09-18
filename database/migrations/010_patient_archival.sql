ALTER TABLE patients
  ADD COLUMN archived_at DATETIME NULL AFTER registered_at,
  ADD COLUMN archived_by INT NULL AFTER archived_at,
  ADD COLUMN retention_note VARCHAR(255) NULL AFTER archived_by,
  ADD INDEX idx_patients_archived (archived_at),
  ADD CONSTRAINT fk_patients_archived_by FOREIGN KEY (archived_by) REFERENCES users(user_id) ON DELETE SET NULL;
