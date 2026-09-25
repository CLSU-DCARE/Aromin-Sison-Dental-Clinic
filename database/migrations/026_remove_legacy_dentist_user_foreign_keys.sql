-- Dentist assignments use provider profiles in dentists, not staff user IDs.
-- Migration 025 added the provider foreign keys but did not remove the legacy
-- users references, leaving both constraints active on the same columns.

SET @drop_legacy_fk = (
    SELECT CONCAT('ALTER TABLE `', TABLE_NAME, '` DROP FOREIGN KEY `', CONSTRAINT_NAME, '`')
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'dentist_id'
      AND REFERENCED_TABLE_NAME = 'users'
    LIMIT 1
);
SET @drop_legacy_fk = COALESCE(@drop_legacy_fk, 'SELECT 1');
PREPARE statement FROM @drop_legacy_fk;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @drop_legacy_fk = (
    SELECT CONCAT('ALTER TABLE `', TABLE_NAME, '` DROP FOREIGN KEY `', CONSTRAINT_NAME, '`')
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointment_requests'
      AND COLUMN_NAME = 'preferred_dentist_id'
      AND REFERENCED_TABLE_NAME = 'users'
    LIMIT 1
);
SET @drop_legacy_fk = COALESCE(@drop_legacy_fk, 'SELECT 1');
PREPARE statement FROM @drop_legacy_fk;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @drop_legacy_fk = (
    SELECT CONCAT('ALTER TABLE `', TABLE_NAME, '` DROP FOREIGN KEY `', CONSTRAINT_NAME, '`')
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'braces_contracts'
      AND COLUMN_NAME = 'dentist_id'
      AND REFERENCED_TABLE_NAME = 'users'
    LIMIT 1
);
SET @drop_legacy_fk = COALESCE(@drop_legacy_fk, 'SELECT 1');
PREPARE statement FROM @drop_legacy_fk;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @drop_legacy_fk = (
    SELECT CONCAT('ALTER TABLE `', TABLE_NAME, '` DROP FOREIGN KEY `', CONSTRAINT_NAME, '`')
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'treatment_records'
      AND COLUMN_NAME = 'dentist_id'
      AND REFERENCED_TABLE_NAME = 'users'
    LIMIT 1
);
SET @drop_legacy_fk = COALESCE(@drop_legacy_fk, 'SELECT 1');
PREPARE statement FROM @drop_legacy_fk;
EXECUTE statement;
DEALLOCATE PREPARE statement;
