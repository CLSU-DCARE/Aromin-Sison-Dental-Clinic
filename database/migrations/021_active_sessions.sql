-- Migration 021: Active sessions tracking for concurrent session limit
-- Enforces max 3 concurrent sessions per user across all roles

CREATE TABLE IF NOT EXISTS active_sessions (
    session_id VARCHAR(128) NOT NULL PRIMARY KEY,  -- PHP session ID
    user_id INT NOT NULL,
    user_agent VARCHAR(255),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_current BOOLEAN DEFAULT FALSE,
    remember_token_used BOOLEAN DEFAULT FALSE,
    INDEX idx_active_sessions_user (user_id),
    INDEX idx_active_sessions_activity (last_activity),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;