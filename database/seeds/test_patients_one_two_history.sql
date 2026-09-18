USE aromin_sison_dental;

-- Development/test patient accounts shared by the team.
-- Passwords:
--   patient.one@arominsison.local -> ASDC-Test-Patient-1-2026!
--   patient.two@arominsison.local -> ASDC-Test-Patient-2-2026!

INSERT INTO users (role, email, password_hash, full_name, is_active)
VALUES
('patient', 'patient.one@arominsison.local', '$2y$10$mknNsFo.giT3f1IJVye.M.WeZ1vUNk5bfjp33yJYU7Ods2KkRj2FC', 'Patient One', 1),
('patient', 'patient.two@arominsison.local', '$2y$10$McNyFiu2Lvx4f8BDOb8Jhu17dUXP/sJ54bFQWpNEh44DXDT8/lD3W', 'Patient Two', 1)
ON DUPLICATE KEY UPDATE
    role = VALUES(role),
    password_hash = VALUES(password_hash),
    full_name = VALUES(full_name),
    is_active = VALUES(is_active);

INSERT INTO patients (user_id, first_name, last_name, birthdate, sex, contact_number, email)
SELECT u.user_id, 'Patient', 'One', '2001-01-01', 'Other', '09170000001', u.email
FROM users u
WHERE u.email = 'patient.one@arominsison.local'
  AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.user_id = u.user_id);

UPDATE patients p
JOIN users u ON u.user_id = p.user_id
SET p.first_name = 'Patient',
    p.last_name = 'One',
    p.birthdate = '2001-01-01',
    p.sex = 'Other',
    p.contact_number = '09170000001',
    p.email = u.email,
    p.archived_at = NULL,
    p.archived_by = NULL,
    p.retention_note = NULL
WHERE u.email = 'patient.one@arominsison.local';

INSERT INTO patients (user_id, first_name, last_name, birthdate, sex, contact_number, email)
SELECT u.user_id, 'Patient', 'Two', '2002-02-02', 'Other', '09170000002', u.email
FROM users u
WHERE u.email = 'patient.two@arominsison.local'
  AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.user_id = u.user_id);

UPDATE patients p
JOIN users u ON u.user_id = p.user_id
SET p.first_name = 'Patient',
    p.last_name = 'Two',
    p.birthdate = '2002-02-02',
    p.sex = 'Other',
    p.contact_number = '09170000002',
    p.email = u.email,
    p.archived_at = NULL,
    p.archived_by = NULL,
    p.retention_note = NULL
WHERE u.email = 'patient.two@arominsison.local';

-- Keep these history rows stable across machines without duplicating on rerun.
DELETE a FROM appointments a
JOIN patients p ON p.patient_id = a.patient_id
WHERE p.email IN ('patient.one@arominsison.local', 'patient.two@arominsison.local')
  AND a.notes = 'Team sync test history';

INSERT INTO appointments (patient_id, dentist_id, service_type, scheduled_date, scheduled_time, status, notes)
SELECT p.patient_id, d.user_id, 'Cleaning & Check-up', '2026-08-12', '09:00:00', 'completed', 'Team sync test history'
FROM patients p
LEFT JOIN users d ON d.role = 'dentist' AND d.is_active = 1
WHERE p.email = 'patient.one@arominsison.local'
ORDER BY d.user_id
LIMIT 1;

INSERT INTO appointments (patient_id, dentist_id, service_type, scheduled_date, scheduled_time, status, notes)
SELECT p.patient_id, d.user_id, 'Consultation', '2026-08-26', '10:30:00', 'completed', 'Team sync test history'
FROM patients p
LEFT JOIN users d ON d.role = 'dentist' AND d.is_active = 1
WHERE p.email = 'patient.one@arominsison.local'
ORDER BY d.user_id
LIMIT 1;

INSERT INTO appointments (patient_id, dentist_id, service_type, scheduled_date, scheduled_time, status, notes)
SELECT p.patient_id, d.user_id, 'Teeth Whitening', '2026-08-13', '13:00:00', 'completed', 'Team sync test history'
FROM patients p
LEFT JOIN users d ON d.role = 'dentist' AND d.is_active = 1
WHERE p.email = 'patient.two@arominsison.local'
ORDER BY d.user_id
LIMIT 1;

INSERT INTO appointments (patient_id, dentist_id, service_type, scheduled_date, scheduled_time, status, notes)
SELECT p.patient_id, d.user_id, 'Braces Adjustment', '2026-08-27', '14:30:00', 'completed', 'Team sync test history'
FROM patients p
LEFT JOIN users d ON d.role = 'dentist' AND d.is_active = 1
WHERE p.email = 'patient.two@arominsison.local'
ORDER BY d.user_id
LIMIT 1;
