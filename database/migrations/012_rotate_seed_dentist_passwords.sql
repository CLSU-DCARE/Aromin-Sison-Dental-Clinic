UPDATE users
SET password_hash = CASE email
    WHEN 'arsenia.aromin@arominsison.local' THEN '$2y$10$XZufABQCw6oroU/Kfkcu2OjRDf/Sjxihczayedp7WOyAkwxYSlCma'
    WHEN 'kathrine.sison@arominsison.local' THEN '$2y$10$XZufABQCw6oroU/Kfkcu2OjRDf/Sjxihczayedp7WOyAkwxYSlCma'
    ELSE password_hash
END
WHERE role = 'dentist'
  AND email IN ('arsenia.aromin@arominsison.local', 'kathrine.sison@arominsison.local');
