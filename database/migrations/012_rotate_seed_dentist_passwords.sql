UPDATE users
SET password_hash = CASE email
    WHEN 'arsenia.aromin@arominsison.local' THEN '$2y$10$eEgqJjPStpt5rIRJpGMzDOnxsxUBV9v1SQyJERi3hs.7bj0Zkhzsi'
    WHEN 'kathrine.sison@arominsison.local' THEN '$2y$10$eEgqJjPStpt5rIRJpGMzDOnxsxUBV9v1SQyJERi3hs.7bj0Zkhzsi'
    ELSE password_hash
END
WHERE role = 'dentist'
  AND email IN ('arsenia.aromin@arominsison.local', 'kathrine.sison@arominsison.local');
