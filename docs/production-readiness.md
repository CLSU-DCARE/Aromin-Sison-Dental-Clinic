# Production deployment checklist

This repository is ready for production deployment only after every item below
is completed on the live environment. Do not place production secrets in the
repository or in `.env.example`.

## Before going live

1. Use a valid HTTPS certificate and redirect all HTTP requests to HTTPS at the
   web server or load balancer. Confirm a live API response includes
   `Strict-Transport-Security`.
2. Set `ASDC_APP_URL` to the canonical HTTPS site URL. Set SMTP credentials,
   send a password-reset test to a controlled mailbox, and verify delivery.
3. Create a dedicated MySQL account with access only to this application's
   database. Do not use MySQL `root` in production.
4. Back up the database before `php database/migrate.php`, run migrations once,
   then verify `schema_migrations` contains every repository migration.
5. Configure a daily encrypted database backup stored outside the web server.
   Test restoring it into an isolated database before launch.
6. Schedule the maintenance task once daily using the PHP binary used by the
   web server:

   ```text
   php /path/to/asdc_v2/database/maintenance.php
   ```

   Windows Task Scheduler: run it as a service account with only the database
   and application permissions it needs. Linux: run it through cron or a
   systemd timer.
7. Set `ASDC_TRUSTED_PROXIES` only when TLS is terminated by a proxy you own;
   list the proxy's source IP addresses, not public visitor IPs. Leave it empty
   for direct Apache HTTPS.
8. Verify web-server permissions: the web process may write only the designated
   upload directories; `.env.local`, `database/`, `tests/`, `docs/`, and source
   code must not be web-accessible.
9. Enable server error-log rotation, uptime/error alerting, and restricted
   access to logs because they can contain diagnostic metadata.

## Release verification

Run these from the deployed application host against an isolated production
snapshot or staging environment:

```text
php database/migrate.php
php tests/server_data_regression.php
node tests/server_data_regression.cjs
```

Then manually verify login/logout, password reset email delivery, patient
isolation, appointment conflict rejection, receipt authorization, and a backup
restore. Keep the Content Security Policy's `unsafe-inline` allowances until
the frontend has been refactored and browser-tested without them.
