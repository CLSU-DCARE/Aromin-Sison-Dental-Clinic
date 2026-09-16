-- Seed active dentist accounts for appointment assignment and dentist portal login.
-- Default password for both seeded dentist accounts: Dentist@ASDC2026!
INSERT INTO users (role, email, password_hash, full_name, is_active) VALUES
('dentist', 'arsenia.aromin@arominsison.local', '$2y$10$c44iN9cSY7q4l9IQUFZPk.AevoyTcBntvXW6pvEicISKQh7xfWzb.', 'Dr. Arsenia Aromin', 1),
('dentist', 'kathrine.sison@arominsison.local', '$2y$10$c44iN9cSY7q4l9IQUFZPk.AevoyTcBntvXW6pvEicISKQh7xfWzb.', 'Dr. Kathrine Sison', 1)
ON DUPLICATE KEY UPDATE
    role = VALUES(role),
    password_hash = VALUES(password_hash),
    full_name = VALUES(full_name),
    is_active = VALUES(is_active);
