-- Migration 019: general treatment billing/payment support
--
-- Braces contracts remain orthodontics-specific. These tables allow ordinary
-- treatments to have billable balances and payment proof submissions too.
CREATE TABLE IF NOT EXISTS treatment_bills (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS treatment_payments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
