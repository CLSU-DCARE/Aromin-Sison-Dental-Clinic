-- Seed active dentist accounts for appointment assignment.
-- Password hashes are for unknown random passwords; set real dentist passwords through reset/bootstrap flow.
INSERT INTO users (role, email, password_hash, full_name, is_active) VALUES
('dentist', 'arsenia.aromin@arominsison.local', '$2y$10$eEgqJjPStpt5rIRJpGMzDOnxsxUBV9v1SQyJERi3hs.7bj0Zkhzsi', 'Dr. Arsenia Aromin', 1),
('dentist', 'kathrine.sison@arominsison.local', '$2y$10$eEgqJjPStpt5rIRJpGMzDOnxsxUBV9v1SQyJERi3hs.7bj0Zkhzsi', 'Dr. Kathrine Sison', 1)
ON DUPLICATE KEY UPDATE
    role = VALUES(role),
    password_hash = VALUES(password_hash),
    full_name = VALUES(full_name),
    is_active = VALUES(is_active);
