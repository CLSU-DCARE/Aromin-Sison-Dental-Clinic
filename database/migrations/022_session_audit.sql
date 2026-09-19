-- Migration 022: Session audit logging
-- Logs session create, destroy, refresh, expire, revoke events

CREATE TABLE IF NOT EXISTS session_audit_log (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_type ENUM('create', 'destroy', 'refresh', 'expire', 'revoke', 'remember_used') NOT NULL,
    session_id VARCHAR(128),
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_event (event_type),
    INDEX idx_audit_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;