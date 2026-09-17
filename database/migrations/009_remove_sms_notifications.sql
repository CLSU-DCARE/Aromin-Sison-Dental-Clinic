-- Remove SMS as an active notification channel while retaining historical
-- SMS log rows for audit purposes.
UPDATE notification_templates SET channel = 'email' WHERE channel IN ('sms', 'both');
ALTER TABLE notification_templates MODIFY channel ENUM('email') NOT NULL DEFAULT 'email';
