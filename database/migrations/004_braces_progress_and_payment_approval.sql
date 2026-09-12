-- Migration 004: braces treatment progress + payment approval workflow
--
-- Adds what the ERD didn't originally cover but the ASDC user flow needs:
--   - a treating dentist + progress fields on each braces contract, so a
--     dentist can update treatment stage/percentage and the patient can
--     see it (Dentist lane: "Update Braces / Treatment Progress")
--   - an approval workflow on contract_payments, so a patient's submitted
--     receipt sits as "pending" until a receptionist approves or rejects
--     it (Receptionist lane: "Verify & Approve Payment Receipts")

ALTER TABLE braces_contracts
  ADD COLUMN dentist_id INT NULL AFTER patient_id,
  ADD COLUMN current_stage VARCHAR(100) NOT NULL DEFAULT 'Consultation & Records' AFTER status,
  ADD COLUMN progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER current_stage,
  ADD COLUMN progress_note TEXT NULL AFTER progress_pct,
  ADD COLUMN next_note VARCHAR(255) NULL AFTER progress_note,
  ADD COLUMN progress_updated_at TIMESTAMP NULL AFTER next_note,
  ADD CONSTRAINT fk_braces_contracts_dentist FOREIGN KEY (dentist_id)
      REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE contract_payments
  ADD COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER payment_method,
  ADD COLUMN receipt_path VARCHAR(255) NULL AFTER status,
  ADD COLUMN note VARCHAR(255) NULL AFTER receipt_path,
  ADD COLUMN submitted_by INT NULL AFTER note,
  ADD COLUMN reviewed_by INT NULL AFTER submitted_by,
  ADD COLUMN reviewed_at TIMESTAMP NULL AFTER reviewed_by,
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER reviewed_at,
  ADD CONSTRAINT fk_contract_payments_submitted_by FOREIGN KEY (submitted_by)
      REFERENCES users(user_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_contract_payments_reviewed_by FOREIGN KEY (reviewed_by)
      REFERENCES users(user_id) ON DELETE SET NULL;

-- New notification templates for the two events this workflow adds.
INSERT INTO notification_templates (template_key, name, channel, subject, body, is_active) VALUES
('payment_rejected', 'Payment Rejected', 'both',
 'Payment Submission Rejected — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your recent payment submission of {amount} could not be verified and was rejected. Please check your receipt and resubmit, or contact us for help. — Aromin-Sison Dental Clinic',
 1),
('braces_progress_updated', 'Braces Progress Updated', 'both',
 'Your Treatment Progress Was Updated — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your dentist updated your braces treatment progress: {stage} ({percent}% complete). {note} — Aromin-Sison Dental Clinic',
 1)
ON DUPLICATE KEY UPDATE template_key = template_key;
