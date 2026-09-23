-- Provider profiles are not accounts. Account provisioning is handled by
-- database/bootstrap_staff.php after migrations have been applied.
CREATE TABLE IF NOT EXISTS dentists (
    dentist_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO dentists (full_name, is_active) VALUES
('Dr. Arsenia Aromin', 1), ('Dr. Kathrine Sison', 1);
