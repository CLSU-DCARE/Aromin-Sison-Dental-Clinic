# Patient portal and payment retirement

The system now uses staff and dentist accounts only. Receptionists create patient records through `patients/profile.php` and book appointments through the existing internal scheduler. A patient account is not required. Public visitors may submit appointment requests through the restored booking form; staff review and confirm them.

## Component decisions

| Component | Decision |
| --- | --- |
| Patient dashboard, registration, login and client scripts | Remove functional interfaces; keep legacy HTML URLs as contact notices |
| Patient dashboard, appointment, braces and payment APIs; account registration API | Disable with HTTP 410, including direct requests |
| Patient login, remembered login and existing sessions | Reject patient roles centrally; keep existing user rows and references |
| Online payment submission, receipt uploads and approval/rejection | Disable API and service mutation entry points |
| Staff billing history, authenticated receipt viewing, reports and archived records | Retain for historical reference; payment transactions are read-only |
| Treatment balances and orthodontic contract schedules | Retain for internal clinical and administrative work |
| Patients, appointments, requests, treatments, contracts, billing, payments, receipts and notification history | Retain; no deletion or automatic financial reconciliation |
| `patients.user_id`, submission/reviewer references and other foreign keys | Retain historical relationships; no foreign keys or tables dropped |
| Patient active status | Migrate from the optional user account onto `patients.is_active` |

## Database rollout

The local database has been recovered, imported into MySQL on port 3306, and migrated through 030. Record counts and historical financial totals were verified. Before deploying to any other environment, back up the database and receipt storage, then apply `database/migrations/030_patient_status_without_accounts.sql` using the normal migration runner (`php database/migrate.php`). The migration adds patient status and copies existing account status, with archived patients inactive and patients without accounts active. It does not delete or unlink records, disable historical user rows, or change financial amounts.

Deploy the migration before the code that reads `patients.is_active`. Validate patient counts, appointment/treatment counts, billing totals and receipt availability against the backup. Newly created patients have no user account. Staff status updates and restoration now operate on the patient record independently.

Do not drop legacy account or payment tables without a separately reviewed export and retention plan. Pending submissions remain pending historical evidence; the revised system does not approve, reject, refund or otherwise settle them automatically.

Older portal/browser integration suites describe retired behavior. Run `node tests/retired_features_regression.cjs` for the retirement boundaries, `php tests/public_booking_integration.php` for account-free booking and receptionist visibility, and `node tests/staff_live_sync.cjs` for automatic updates. These checks pass locally; validate internal registration, booking, records, contracts and history against a migrated test database before production rollout.
