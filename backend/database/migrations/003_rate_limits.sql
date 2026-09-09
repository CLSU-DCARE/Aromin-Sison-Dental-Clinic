-- Rate limiting table: Aromin-Sison Dental Clinic System.
-- Tracks brute-force attempts across sessions with IP-based fallback.

CREATE TABLE IF NOT EXISTS rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(191) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    lockout_until DATETIME NULL,
    window_started_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rate_limits_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
