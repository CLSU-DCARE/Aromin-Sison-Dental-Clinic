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
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (dentist_id) REFERENCES users(user_id) ON DELETE SET NULL
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
