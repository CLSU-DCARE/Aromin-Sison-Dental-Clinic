UPDATE notification_templates SET channel='email' WHERE channel <> 'email';
ALTER TABLE notification_templates
    MODIFY channel ENUM('email') NOT NULL DEFAULT 'email';
