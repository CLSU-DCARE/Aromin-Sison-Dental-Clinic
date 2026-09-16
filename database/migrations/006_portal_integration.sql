-- Additive migration. Existing appointment statuses and records are preserved.
ALTER TABLE appointments MODIFY status ENUM('pending','confirmed','completed','cancelled','no_show','rejected') NOT NULL DEFAULT 'pending';
ALTER TABLE appointment_requests MODIFY status ENUM('pending','approved','rescheduled','cancelled','rejected') NOT NULL DEFAULT 'pending';
CREATE TABLE IF NOT EXISTS user_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'info',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    INDEX idx_notification_user (user_id, notification_id),
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
