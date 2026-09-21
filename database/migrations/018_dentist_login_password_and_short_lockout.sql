-- Clear existing long login lockouts created before the 30-second lockout change.
-- (This file used to also set a shared dentist password. That part was removed.)
DELETE FROM rate_limits
WHERE identifier LIKE 'login:%'
   OR identifier LIKE 'ip:%';
