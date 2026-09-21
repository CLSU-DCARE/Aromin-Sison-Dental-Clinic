-- Older databases were seeded with one shared dentist password.
-- This locks every account that still has it and signs it out everywhere.
-- After running it, set a real password with: php database/set_staff_password.php
DELETE FROM active_sessions WHERE user_id IN (
    SELECT user_id FROM users WHERE password_hash = '$2y$10$XZufABQCw6oroU/Kfkcu2OjRDf/Sjxihczayedp7WOyAkwxYSlCma'
);
DELETE FROM remember_tokens WHERE user_id IN (
    SELECT user_id FROM users WHERE password_hash = '$2y$10$XZufABQCw6oroU/Kfkcu2OjRDf/Sjxihczayedp7WOyAkwxYSlCma'
);
UPDATE users SET password_hash = '!'
WHERE password_hash = '$2y$10$XZufABQCw6oroU/Kfkcu2OjRDf/Sjxihczayedp7WOyAkwxYSlCma';
