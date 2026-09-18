UPDATE users
SET password_hash = CASE email
    WHEN 'arsenia.aromin@arominsison.local' THEN '$2y$10$aVmuy8aQ9w1VbY91LlcD4ONT9I9IZ2YQ694XLk.qgR3ePUthErE1S'
    WHEN 'kathrine.sison@arominsison.local' THEN '$2y$10$jOr5I6WA7hTzNFnn4KaHBOfJ2UQc7t4k0/zvDY.jRczfI3z9x05Ua'
    ELSE password_hash
END
WHERE role = 'dentist'
  AND email IN ('arsenia.aromin@arominsison.local', 'kathrine.sison@arominsison.local');
