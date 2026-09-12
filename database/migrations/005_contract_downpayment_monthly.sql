-- Migration 005: explicit downpayment + monthly payment fields
--
-- The ERD's Contract entity has Downpayment and Monthly_Payment as their
-- own attributes (not just derived from Total_Cost / duration, which can
-- produce inexact figures like 50000/18 = 2777.777...). Adding them as
-- real columns keeps the stored monthly amount exact and matches the ERD.

ALTER TABLE braces_contracts
  ADD COLUMN downpayment DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total_amount,
  ADD COLUMN monthly_payment DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER downpayment;

-- Backfill existing rows with a computed monthly figure so nothing shows
-- as ₱0/mo after this migration runs on a database that already has data.
UPDATE braces_contracts
   SET monthly_payment = ROUND(total_amount / GREATEST(duration_months, 1), 2)
 WHERE monthly_payment = 0;
