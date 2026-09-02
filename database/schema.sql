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
    role ENUM('admin', 'staff', 'dentist', 'patient') NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

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
    status ENUM('pending','confirmed','completed','cancelled','no_show') DEFAULT 'pending',
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
    total_amount DECIMAL(10,2) NOT NULL,
    balance_amount DECIMAL(10,2) NOT NULL,
    duration_months INT NOT NULL,
    start_date DATE NOT NULL,
    estimated_completion_date DATE,
    status ENUM('active','completed','defaulted','cancelled') DEFAULT 'active',
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ---------- CONTRACT PAYMENTS ----------
CREATE TABLE contract_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id INT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash','card','gcash','bank_transfer','other') DEFAULT 'cash',
    or_number VARCHAR(50),                  -- official receipt number
    FOREIGN KEY (contract_id) REFERENCES braces_contracts(contract_id) ON DELETE CASCADE
);

-- ---------- PROMOTIONS ----------
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
-- Stores reusable message templates for email/SMS notifications.
-- The {patient_name}, {date}, {time}, {service}, {dentist}, {amount},
-- {balance} placeholders are replaced at send time by the PHP helper.
CREATE TABLE notification_templates (
    template_id INT AUTO_INCREMENT PRIMARY KEY,
    template_key VARCHAR(80) UNIQUE NOT NULL,   -- e.g. 'appointment_reminder', 'payment_due'
    name VARCHAR(150) NOT NULL,                 -- human-readable label
    channel ENUM('email','sms','both') NOT NULL DEFAULT 'both',
    subject VARCHAR(255) DEFAULT NULL,          -- email subject line (NULL for SMS-only)
    body TEXT NOT NULL,                          -- message body with {placeholders}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default templates for common clinic notifications.
INSERT INTO notification_templates (template_key, name, channel, subject, body) VALUES
('appointment_reminder', 'Appointment Reminder', 'both',
 'Appointment Reminder — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, this is a friendly reminder of your appointment on {date} at {time} for {service}. If you need to reschedule, please call us at least 24 hours in advance. — Aromin-Sison Dental Clinic'),

('appointment_confirmation', 'Appointment Confirmation', 'both',
 'Appointment Confirmed — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your appointment has been confirmed for {date} at {time} ({service}) with {dentist}. We look forward to seeing you! — Aromin-Sison Dental Clinic'),

('appointment_cancellation', 'Appointment Cancellation', 'both',
 'Appointment Cancelled — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, your appointment on {date} at {time} ({service}) has been cancelled. To rebook, please visit our website or call us. — Aromin-Sison Dental Clinic'),

('payment_due', 'Payment Due Reminder', 'email',
 'Payment Reminder — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, this is a reminder that your next braces contract payment of {amount} is due. Your remaining balance is {balance}. Please visit the clinic or contact us for payment options. — Aromin-Sison Dental Clinic'),

('payment_received', 'Payment Received Confirmation', 'both',
 'Payment Received — Aromin-Sison Dental Clinic',
 'Hi {patient_name}, we have received your payment of {amount}. Your remaining balance is {balance}. Thank you! — Aromin-Sison Dental Clinic');

-- Logs every notification sent (email or SMS) for audit and history.
CREATE TABLE notification_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    template_id INT NULL,
    channel ENUM('email','sms') NOT NULL,
    recipient VARCHAR(150) NOT NULL,            -- email address or phone number
    subject VARCHAR(255) DEFAULT NULL,          -- email subject (NULL for SMS)
    body TEXT NOT NULL,                          -- final rendered message (placeholders replaced)
    status ENUM('sent','failed','pending') DEFAULT 'pending',
    error_message VARCHAR(255) DEFAULT NULL,    -- failure reason if status = 'failed'
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES notification_templates(template_id) ON DELETE SET NULL
);
