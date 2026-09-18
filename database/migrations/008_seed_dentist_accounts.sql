-- Seed active dentist accounts for appointment assignment.
-- Password hashes are for unknown random passwords; set real dentist passwords through reset/bootstrap flow.
INSERT INTO users (role, email, password_hash, full_name, is_active) VALUES
('dentist', 'arsenia.aromin@arominsison.local', '$2y$10$aVmuy8aQ9w1VbY91LlcD4ONT9I9IZ2YQ694XLk.qgR3ePUthErE1S', 'Dr. Arsenia Aromin', 1),
('dentist', 'kathrine.sison@arominsison.local', '$2y$10$jOr5I6WA7hTzNFnn4KaHBOfJ2UQc7t4k0/zvDY.jRczfI3z9x05Ua', 'Dr. Kathrine Sison', 1)
ON DUPLICATE KEY UPDATE
    role = VALUES(role),
    password_hash = VALUES(password_hash),
    full_name = VALUES(full_name),
    is_active = VALUES(is_active);
