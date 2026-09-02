USE aromin_sison_dental;

-- Development/test account only.
-- Initial password: AnneTest!2026
-- The bcrypt value was generated with PHP password_hash(..., PASSWORD_DEFAULT).
-- On duplicate email, preserve the current password so rerunning this seed does
-- not undo a password reset.
INSERT INTO users (role, email, password_hash, full_name, is_active)
VALUES (
    'patient',
    'anneperalta023@gmail.com',
    '$2y$10$7V6bzH3UJk1Q.DBY9ol0GeQASmEbUN..JJuhwavOXoCjKyIYMZ4s6',
    'Anne Peralta',
    1
)
ON DUPLICATE KEY UPDATE
    role = VALUES(role),
    full_name = VALUES(full_name),
    is_active = VALUES(is_active);

INSERT INTO patients (user_id, first_name, last_name, email)
SELECT user_id, 'Anne', 'Peralta', 'anneperalta023@gmail.com'
FROM users u
WHERE u.email = 'anneperalta023@gmail.com'
  AND NOT EXISTS (
      SELECT 1 FROM patients p WHERE p.user_id = u.user_id
  );
