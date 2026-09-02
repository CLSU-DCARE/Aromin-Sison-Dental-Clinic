CREATE TABLE appointment_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NULL,
    contact_number VARCHAR(20) NOT NULL,
    service_type VARCHAR(150) NOT NULL,
    preferred_dentist_id INT NULL,
    requested_date DATE NOT NULL,
    requested_time TIME NOT NULL,
    status ENUM('pending','approved','rescheduled','cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT NULL,
    appointment_id INT NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_request_week (requested_date, requested_time, status),
    INDEX idx_request_dentist_slot (preferred_dentist_id, requested_date, requested_time, status),
    INDEX idx_request_contact (contact_number, requested_date, requested_time, status),
    CONSTRAINT fk_appointment_request_dentist FOREIGN KEY (preferred_dentist_id)
        REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_appointment_request_appointment FOREIGN KEY (appointment_id)
        REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    CONSTRAINT fk_appointment_request_reviewer FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE appointments
    ADD INDEX idx_appointment_week (scheduled_date, scheduled_time, status),
    ADD INDEX idx_appointment_dentist_slot (dentist_id, scheduled_date, scheduled_time, status),
    ADD INDEX idx_appointment_patient_slot (patient_id, scheduled_date, scheduled_time, status);
