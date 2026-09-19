-- Migration 020: Remember Me tokens for persistent login
-- Allows users to skip login form for 30 days while still enforcing 30-min inactivity timeout

CREATE TABLE IF NOT EXISTS remember_tokens (
    token_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash of the token
    user_agent VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_remember_user (user_id),
    INDEX idx_remember_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;