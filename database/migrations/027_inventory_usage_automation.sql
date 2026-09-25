CREATE TABLE IF NOT EXISTS inventory_usage_rules (
    rule_id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(150) NOT NULL,
    item_id INT NOT NULL,
    quantity_required INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inventory_usage_rule (service_name, item_id),
    CONSTRAINT fk_inventory_usage_rule_item FOREIGN KEY (item_id)
        REFERENCES inventory_items(item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    quantity_change INT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    treatment_record_id INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inventory_treatment_item (treatment_record_id, item_id),
    KEY idx_inventory_transaction_item_date (item_id, created_at),
    CONSTRAINT fk_inventory_transaction_item FOREIGN KEY (item_id)
        REFERENCES inventory_items(item_id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_transaction_record FOREIGN KEY (treatment_record_id)
        REFERENCES treatment_records(record_id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_transaction_user FOREIGN KEY (created_by)
        REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
