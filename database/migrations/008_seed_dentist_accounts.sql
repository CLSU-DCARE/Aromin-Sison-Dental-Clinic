-- Seed active dentist accounts for appointment assignment.
-- The password is '!' on purpose. It is not a real hash, so nobody can log in
-- to these accounts until a real password is set with:
--   php database/set_staff_password.php   (see README)
INSERT INTO users (role, email, password_hash, full_name, is_active) VALUES
('dentist', 'arsenia.aromin@arominsison.local', '!', 'Dr. Arsenia Aromin', 1),
('dentist', 'kathrine.sison@arominsison.local', '!', 'Dr. Kathrine Sison', 1)
ON DUPLICATE KEY UPDATE
    role = VALUES(role),
    password_hash = VALUES(password_hash),
    full_name = VALUES(full_name),
    is_active = VALUES(is_active);
