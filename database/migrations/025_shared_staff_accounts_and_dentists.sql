-- Separate provider identities from staff login accounts, preserve history,
-- then disable all legacy dentist/receptionist logins other than the canonical
-- addresses provisioned by database/bootstrap_staff.php.
CREATE TABLE IF NOT EXISTS dentists (
    dentist_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO dentists (full_name, is_active)
SELECT full_name, 1 FROM users WHERE role='dentist' AND TRIM(full_name) <> '';

UPDATE appointments a JOIN users u ON u.user_id=a.dentist_id
JOIN dentists d ON d.full_name=u.full_name SET a.dentist_id=d.dentist_id;
UPDATE appointment_requests r JOIN users u ON u.user_id=r.preferred_dentist_id
JOIN dentists d ON d.full_name=u.full_name SET r.preferred_dentist_id=d.dentist_id;
UPDATE treatment_records r JOIN users u ON u.user_id=r.dentist_id
JOIN dentists d ON d.full_name=u.full_name SET r.dentist_id=d.dentist_id;
UPDATE braces_contracts c JOIN users u ON u.user_id=c.dentist_id
JOIN dentists d ON d.full_name=u.full_name SET c.dentist_id=d.dentist_id;

ALTER TABLE appointments
    ADD CONSTRAINT fk_appointments_dentist_profile FOREIGN KEY (dentist_id)
        REFERENCES dentists(dentist_id) ON DELETE SET NULL;
ALTER TABLE appointment_requests
    ADD CONSTRAINT fk_appointment_request_dentist_profile FOREIGN KEY (preferred_dentist_id)
        REFERENCES dentists(dentist_id) ON DELETE SET NULL;
ALTER TABLE treatment_records
    ADD CONSTRAINT fk_treatment_records_dentist_profile FOREIGN KEY (dentist_id)
        REFERENCES dentists(dentist_id) ON DELETE SET NULL;
ALTER TABLE braces_contracts
    ADD CONSTRAINT fk_braces_contracts_dentist_profile FOREIGN KEY (dentist_id)
        REFERENCES dentists(dentist_id) ON DELETE SET NULL;

UPDATE users SET is_active=0 WHERE role IN ('dentist','receptionist');
