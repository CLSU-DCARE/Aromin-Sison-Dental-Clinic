# Shared Device Sync Setup

Appointments, promotions, payments, and patient records are stored in MySQL. The dashboards already refresh from the server, but they can only show changes that exist in the same database.

If every member runs XAMPP with `ASDC_DB_HOST=127.0.0.1`, each laptop has a separate database. Changes will not appear on other devices because `localhost` means "my own laptop."

## Recommended Setup

Use one shared database for the whole group.

Option A: One laptop hosts XAMPP MySQL on the same Wi-Fi.

1. Pick one laptop as the host.
2. On the host laptop, import `database/schema.sql` and all needed migrations/seeds.
3. Get the host IPv4 address with `ipconfig`, for example `192.168.1.25`.
4. Allow MySQL through Windows Firewall on port `3306`.
5. Create a MySQL user that can connect from other devices:

```sql
CREATE USER IF NOT EXISTS 'asdc_team'@'%' IDENTIFIED BY 'choose-a-team-password';
GRANT ALL PRIVILEGES ON aromin_sison_dental.* TO 'asdc_team'@'%';
FLUSH PRIVILEGES;
```

6. On every member laptop, configure the app to use the host database:

```text
ASDC_DB_HOST=192.168.1.25
ASDC_DB_PORT=3306
ASDC_DB_NAME=aromin_sison_dental
ASDC_DB_USER=asdc_team
ASDC_DB_PASS=choose-a-team-password
```

7. Fully restart Apache after changing environment variables.

Option B: Put the whole app and database on one shared web server.

Everyone opens the same URL, for example:

```text
http://192.168.1.25/Aromin-Sison-Dental-Clinic/
```

This is the simplest demo setup because everyone is using the same PHP server and the same MySQL database.

## Important

Do not import `schema.sql` repeatedly on different devices and expect automatic sync. That creates separate copies. Only the shared database should receive new appointments, promotions, patients, and payments.

Before a demo, confirm everyone sees the same database by creating one test promotion or appointment on one device and refreshing another device.
