-- Keep seeded dentist accounts usable for demo/testing logins.
-- Password: Dentist@ASDC2026!
UPDATE users
SET password_hash = '$2y$10$eEgqJjPStpt5rIRJpGMzDOnxsxUBV9v1SQyJERi3hs.7bj0Zkhzsi',
    is_active = 1
WHERE role = 'dentist'
  AND email IN ('arsenia.aromin@arominsison.local', 'kathrine.sison@arominsison.local');

-- Clear existing long login lockouts created before the 30-second lockout change.
DELETE FROM rate_limits
WHERE identifier LIKE 'login:%'
   OR identifier LIKE 'ip:%';
