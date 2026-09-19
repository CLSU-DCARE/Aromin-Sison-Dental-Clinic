-- ============================================================
-- Aromin-Sison Dental Clinic — Starter Database Schema
-- Engine: MySQL / MariaDB
-- This is a STARTING POINT covering the modules in your scope.
-- Expand fields as your admin/patient dashboards need them.
-- ============================================================

CREATE DATABASE IF NOT EXISTS aromin_sison_dental;
USE aromin_sison_dental;

-- ---------- USERS & ROLES ----------
-- Covers login for Admin System staff AND Patient Dashboard accounts
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('dentist', 'receptionist', 'patient') NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Seed active dentist accounts used by appointment assignment.
-- Password hashes are for unknown random passwords; set real dentist passwords through reset/bootstrap flow.
INSERT INTO users (role, email, password_hash, full_name, is_active) VALUES
('dentist', 'arsenia.aromin@arominsison.local', '$2y$10$eEgqJjPStpt5rIRJpGMzDOnxsxUBV9v1SQyJERi3hs.7bj0Zkhzsi', 'Dr. Arsenia Aromin', 1),
('dentist', 'kathrine.sison@arominsison.local', '$2y$10$eEgqJjPStpt5rIRJpGMzDOnxsxUBV9v1SQyJERi3hs.7bj0Zkhzsi', 'Dr. Kathrine Sison', 1)
ON DUPLICATE KEY UPDATE
    role = VALUES(role),
    password_hash = VALUES(password_hash),
    full_name = VALUES(full_name),
    is_active = VALUES(is_active);

-- ---------- PASSWORD RESET TOKENS ----------
-- Only a SHA-256 hash of the emailed token is stored.
CREATE TABLE password_reset_tokens (
    reset_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_expiry (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE schema_migrations (
    migration VARCHAR(191) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(191) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    lockout_until DATETIME NULL,
    window_started_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rate_limits_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- PATIENTS ----------
-- Extends users where role = 'patient'; also allows walk-in patients with no login
CREATE TABLE patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,                       -- nullable: walk-ins may not have a portal account
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birthdate DATE,
    sex ENUM('Male','Female','Other'),
    address VARCHAR(255),
    contact_number VARCHAR(20),
    email VARCHAR(150),
    emergency_contact_name VARCHAR(150),
    emergency_contact_number VARCHAR(20),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME NULL,
    archived_by INT NULL,
    retention_note VARCHAR(255) NULL,
    INDEX idx_patients_archived (archived_at),
    FOREIGN KEY (archived_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ---------- APPOINTMENTS ----------
CREATE TABLE appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    dentist_id INT NULL,                    -- FK to users where role = 'dentist'
    service_type VARCHAR(150) NOT NULL,     -- e.g. 'Cleaning', 'Braces Adjustment'
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status ENUM('pending','confirmed','completed','cancelled','no_show','rejected') NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_appointment_week (scheduled_date, scheduled_time, status),
    INDEX idx_appointment_dentist_slot (dentist_id, scheduled_date, scheduled_time, status),
    INDEX idx_appointment_patient_slot (patient_id, scheduled_date, scheduled_time, status),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (dentist_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Public bookings are requests, not patient portal accounts. Staff approval
-- links an existing patient or creates a walk-in patient before making the appointment.
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
    status ENUM('pending','approved','rescheduled','cancelled','rejected') NOT NULL DEFAULT 'pending',
    notes TEXT NULL,
    appointment_id INT NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_request_week (requested_date, requested_time, status),
    INDEX idx_request_dentist_slot (preferred_dentist_id, requested_date, requested_time, status),
    INDEX idx_request_contact (contact_number, requested_date, requested_time, status),
    FOREIGN KEY (preferred_dentist_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ---------- TREATMENT RECORDS ----------
CREATE TABLE treatment_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    appointment_id INT NULL,
    dentist_id INT NULL,
    diagnosis VARCHAR(255),
    treatment_given TEXT,
    treatment_protocol TEXT,                -- plan/notes for ongoing treatment
    date_recorded DATE NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    FOREIGN KEY (dentist_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ---------- BRACES CONTRACTS ----------
CREATE TABLE braces_contracts (
    contract_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    dentist_id INT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    downpayment DECIMAL(10,2) NOT NULL DEFAULT 0,
    monthly_payment DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance_amount DECIMAL(10,2) NOT NULL,
    duration_months INT NOT NULL,
    start_date DATE NOT NULL,
    estimated_completion_date DATE,
    status ENUM('active','completed','defaulted','cancelled') DEFAULT 'active',
    current_stage VARCHAR(100) NOT NULL DEFAULT 'Consultation & Records',
    progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
    progress_note TEXT NULL,
    next_note VARCHAR(255) NULL,
    progress_updated_at TIMESTAMP NULL,
    FOREIGN KEY (dentist_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ---------- CONTRACT PAYMENTS ----------
CREATE TABLE contract_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id INT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash','card','gcash','bank_transfer','other') DEFAULT 'cash',
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
    receipt_path VARCHAR(255) NULL,
    note VARCHAR(255) NULL,
    submitted_by INT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    or_number VARCHAR(50),                  -- official receipt number
    FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (contract_id) REFERENCES braces_contracts(contract_id) ON DELETE CASCADE
);

-- ---------- GENERAL TREATMENT BILLING ----------
CREATE TABLE treatment_bills (
    bill_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    appointment_id INT NULL,
    service_treatment VARCHAR(160) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    balance_amount DECIMAL(10,2) NOT NULL,
    status ENUM('active','paid','cancelled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL
);

CREATE TABLE treatment_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash','card','gcash','bank_transfer','other') DEFAULT 'cash',
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    receipt_path VARCHAR(255) NULL,
    note VARCHAR(255) NULL,
    submitted_by INT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    or_number VARCHAR(50) NULL,
    FOREIGN KEY (bill_id) REFERENCES treatment_bills(bill_id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ---------- PROMOTIONS ----------
CREATE TABLE user_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    patient_id INT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'info',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    INDEX idx_notification_user (user_id, notification_id),
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_inbox_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE promotions (
    promo_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    image_path VARCHAR(255),
    start_date DATE,
    end_date DATE,
    status ENUM('scheduled','live','expired') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- INVENTORY ----------
CREATE TABLE inventory_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    stock_quantity INT NOT NULL DEFAULT 0,
    unit VARCHAR(30),                       -- e.g. 'pcs', 'tubes', 'boxes'
    reorder_level INT DEFAULT 10,           -- triggers "Low Stock" when stock_quantity falls below this
    last_restocked DATE
);

-- ---------- ATTENDANCE / REPORT SUPPORT ----------
-- Most reports (Total Patients, Completed Appointments, No-Shows, Attendance %)
-- can be derived directly from the `appointments` table via queries, e.g.:
--
--   Attendance % = completed / (completed + no_show + cancelled) * 100
--   Active Braces Patients = COUNT(*) FROM braces_contracts WHERE status = 'active'
--
-- No separate attendance table is strictly required — keeping status accurate
-- on `appointments` is enough to generate all report views listed in your scope.

-- ---------- NOTIFICATIONS ----------
-- Stores reusable email notification templates.
-- The {patient_name}, {date}, {time}, {service}, {dentist}, {amount},
-- {balance} placeholders are replaced at send time by the PHP helper.
CREATE TABLE notification_templates (
    template_id INT AUTO_INCREMENT PRIMARY KEY,
    template_key VARCHAR(80) UNIQUE NOT NULL,   -- e.g. 'appointment_reminder', 'payment_due'
    name VARCHAR(150) NOT NULL,                 -- human-readable label
    channel ENUM('email') NOT NULL DEFAULT 'email',
    subject VARCHAR(255) DEFAULT NULL,
    body TEXT NOT NULL,                          -- message body with {placeholders}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default templates for common clinic notifications.
INSERT INTO notification_templates (template_key, name, channel, subject, body) VALUES
('appointment_reminder', 'Appointment Reminder', 'email',
 'Appointment Reminder — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, this is a friendly reminder of your appointment on {date} at {time} for {service}. If you need to reschedule, please call us at least 24 hours in advance. — Aromin-Sison Dental Clinic'),

('appointment_confirmation', 'Appointment Confirmation', 'email',
 'Appointment Confirmed — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your appointment has been confirmed for {date} at {time} ({service}) with {dentist}. We look forward to seeing you! — Aromin-Sison Dental Clinic'),

('appointment_cancellation', 'Appointment Cancellation', 'email',
 'Appointment Cancelled — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your appointment on {date} at {time} ({service}) has been cancelled. To rebook, please visit our website or call us. — Aromin-Sison Dental Clinic'),

('payment_due', 'Payment Due Reminder', 'email',
 'Payment Reminder — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, this is a reminder that your next braces contract payment of {amount} is due. Your remaining balance is {balance}. Please visit the clinic or contact us for payment options. — Aromin-Sison Dental Clinic'),

('payment_received', 'Payment Received Confirmation', 'email',
 'Payment Received — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, we have received your payment of {amount}. Your remaining balance is {balance}. Thank you! — Aromin-Sison Dental Clinic'),

('payment_rejected', 'Payment Rejected', 'email',
 'Payment Update - Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your submitted payment of {amount} could not be approved. Your current balance is {balance}. Please contact the clinic or submit a corrected receipt. - Aromin-Sison Dental Clinic'),

('braces_progress_updated', 'Braces Progress Updated', 'email',
 'Braces Progress Update - Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your braces progress has been updated. Current stage: {stage}. Progress: {progress}%. Next: {next}. - Aromin-Sison Dental Clinic');

-- Logs every email notification. The enum retains sms for legacy audit rows.
CREATE TABLE notification_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    template_id INT NULL,
    channel ENUM('email','sms') NOT NULL,
    recipient VARCHAR(150) NOT NULL,
    subject VARCHAR(255) DEFAULT NULL,
    body TEXT NOT NULL,                          -- final rendered message (placeholders replaced)
    status ENUM('sent','failed','pending') DEFAULT 'pending',
    error_message VARCHAR(255) DEFAULT NULL,    -- failure reason if status = 'failed'
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES notification_templates(template_id) ON DELETE SET NULL
);
