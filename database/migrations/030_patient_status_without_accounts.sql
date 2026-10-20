-- Additive only: preserve users, patient links, and all historical records.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;
UPDATE patients p LEFT JOIN users u ON u.user_id=p.user_id
SET p.is_active=CASE WHEN p.archived_at IS NOT NULL THEN 0 ELSE COALESCE(u.is_active,1) END;
