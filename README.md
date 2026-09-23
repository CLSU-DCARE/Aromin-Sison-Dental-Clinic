# Aromin-Sison Dental Clinic: System Project

## Folder Structure

```
asdc_v2/
│
├── index.html                Root redirect → public-website/index.html
│
├── public-website/           Public-facing site (Home, About, Dentists, Gallery, Services, Promotions, Contact, Book Appointment)
│   ├── index.html
│   ├── about.html
│   ├── dentist.html
│   ├── gallery.html
│   └── assets/
│       ├── css/main.css      Page-specific styles
│       └── js/
│           ├── main.js       Page-specific scripts
│           ├── dentists.js   Dentist profile data & rendering
│           └── gallery.js    Carousel, category filters, lightbox
│
├── auth/                     Login pages shared across frontends
│   ├── login.html
│   ├── admin-login.html
│   ├── patient-login.html
│   ├── forgot-password.html
│   └── assets/
│       ├── css/auth.css
│       └── js/auth.js
│
├── admin-system/             Staff-facing admin dashboard
│   ├── dashboard.html
│   └── assets/
│       ├── css/admin.css
│       └── js/admin.js
│
├── patient-dashboard/        Patient-facing portal
│   ├── dashboard.html
│   └── assets/
│       ├── css/patient.css
│       └── js/patient.js
│
├── shared/                   Single source of truth for branding: imported by ALL frontends
│   ├── css/
│   │   ├── variables.css     Color tokens, used via CSS variables (--ink, --gold, --ivory, etc.)
│   │   ├── buttons.css       Shared button design system (.btn, .btn-gold, .btn-primary, etc.)
│   │   └── panels.css        Dashboard popover panels (notifications, account menu, search)
│   ├── js/
│   │   ├── dashboard-core.js Shared dashboard utilities (Modal, toast, sidebar, fullscreen, logout)
│   │   └── state/        Empty initial state for both dashboards (admin.js, patient.js)
│   └── images/               Shared photography & logos (see below)
│
├── backend/                  PHP API / server code
│   ├── config/
│   │   ├── db.php            PDO connection: include this at the top of every endpoint
│   │   ├── auth.php          Session helper: require_login(), require_role(), secure_session_start()
│   │   ├── mail.php          Email helpers: send_email(), render_template()
│   │   └── notifications.php Auto-trigger helper: notify_event($pdo, $event, $patientId, $replacements)
│   └── api/
│       ├── auth/
│       │   ├── login.php     POST endpoint, prepared statement, session
│       │   └── logout.php    POST endpoint, destroys server-side session
│       ├── patients/
│       │   └── list.php      GET endpoint, returns JSON
│       └── notifications/
│           ├── send.php      POST endpoint, sends email using templates
│           ├── list.php      GET endpoint, notification history with filters
│           └── templates.php GET/POST endpoint, manage notification templates
│
├── database/
│   └── schema.sql            Starter MySQL schema: see notes below
│
├── docs/
│   └── backend-integration-checklist.md   Every TODO(backend) marker mapped to its endpoint
│
└── package.json
```

## Why this structure

- **One `shared/` folder for branding.** Colors and fonts live in `shared/css/variables.css` only.
  If you ever tweak the clinic's brand color, you edit ONE file and all frontends
  (public site, auth pages, admin, patient dashboard) update together: nothing gets out of sync.
- **Each frontend is self-contained.** `public-website/`, `auth/`, `admin-system/`, and `patient-dashboard/`
  each have their own `assets/css` and `assets/js`, so a change in the admin dashboard's
  JavaScript can never accidentally break the public website.
- **`database/` and `backend/` are separated from the frontend folders** so your teammates
  can work on UI and backend logic independently without stepping on each other's files :
  useful if this is a group capstone.

## How the CSS linking works

Each public-website HTML file loads three stylesheets in this order:
```html
<link rel="stylesheet" href="../shared/css/variables.css">   <!-- brand tokens -->
<link rel="stylesheet" href="../shared/css/buttons.css">     <!-- shared button system -->
<link rel="stylesheet" href="assets/css/main.css">           <!-- page-specific styles -->
```

Dashboard HTML files load four - adding `panels.css` for the popover dropdowns:
```html
<link rel="stylesheet" href="../shared/css/variables.css">
<link rel="stylesheet" href="../shared/css/buttons.css">
<link rel="stylesheet" href="../shared/css/panels.css">      <!-- dashboard popovers -->
<link rel="stylesheet" href="assets/css/admin.css">           <!-- or patient.css -->
```

`variables.css` must load first since `main.css`/`admin.css`/`patient.css` reference its
variables (e.g. `background: var(--ivory)`), `buttons.css` second so every page uses the
same button design system (hover/press/focus/disabled/loading states, sizes, and radii stay
consistent across all frontends), and `panels.css` third for dashboards so popover
dropdowns (notifications, account menu, search) share one implementation.
Pages may still add their own layout adjustments on top (e.g. full-width buttons in
the mobile menu), but button *look and feel* should never be redefined per page :
add a variant to `shared/css/buttons.css` instead.

## About the database

Yes: this project needs one. See `database/schema.sql` for a starting schema covering:
`users`, `patients`, `appointments`, `treatment_records`, `braces_contracts`,
`contract_payments`, `promotions`, `inventory_items`, `notification_templates`,
`notification_logs`.

**Stack: PHP + MySQL (XAMPP)**: chosen because it's the standard for BSIT capstones in
the Philippines, runs entirely on your laptop (no hosting needed for your defense demo),
and is well-supported by your coursework.

Most of your "Reports" module (Total Patients, Completed Appointments, No-Shows,
Attendance %) doesn't need its own table: it can be calculated directly from the
`appointments` table's `status` column via SQL queries (see comment at the bottom
of `schema.sql`).

## Backend setup (XAMPP or Laragon)

Either works: both give you Apache + MySQL + PHP locally, no hosting needed for your defense demo.

**XAMPP:**
1. Install [XAMPP](https://www.apachefriends.org/), start **Apache** + **MySQL** from the control panel
2. Copy the whole `asdc_v2/` folder into `C:\xampp\htdocs\`
3. Open `http://localhost/phpmyadmin`, create a database, import `database/schema.sql`
4. Apply migrations: `php database/migrate.php`
5. Provision the shared dentist and receptionist accounts with `database/bootstrap_staff.php`
6. Test: `http://localhost/asdc_v2/backend/api/patients/list.php`

**Laragon:**
1. Install [Laragon](https://laragon.org/), click **Start All**
2. Copy the whole `asdc_v2/` folder into `C:\laragon\www\`
3. Right-click the Laragon tray icon → **MySQL** → **phpMyAdmin** (or **HeidiSQL**), create a database, import `database/schema.sql`
4. Apply migrations: `php database/migrate.php`
5. Set the two shared staff passwords securely and run `database/bootstrap_staff.php`
6. Test: `http://asdc-v2.test/backend/api/patients/list.php` (Laragon auto-generates the `.test` domain) or `http://localhost/asdc_v2/backend/api/patients/list.php`

Either way you should get a JSON response (empty array is fine until you add data).

Database credentials are read by `backend/classes/Database.php` from server environment variables first, then `.env.local`, then `.env`. The repository only includes `.env.example`, which is a template and must not contain shared or production secrets.

### Migrations and staff bootstrap

Use the migration runner after importing `database/schema.sql`, after pulling new backend/database changes, or when setting up a teammate's device:

```sh
php database/migrate.php
```

The runner records applied files in `schema_migrations` and skips objects that already exist on older local databases.

The clinic uses one shared account per staff role. Set both passwords through environment variables, then run the bootstrap script. It creates or updates only `dentist@arominsison.com` and `receptionist@arominsison.com`, disabling any legacy duplicate staff logins. Provider names remain separate from login accounts. Do not commit real staff passwords.

```sh
$env:ASDC_BOOTSTRAP_RECEPTIONIST_PASSWORD = '<set securely>'
$env:ASDC_BOOTSTRAP_DENTIST_PASSWORD = '<set securely>'
php database/bootstrap_staff.php
Remove-Item Env:ASDC_BOOTSTRAP_RECEPTIONIST_PASSWORD, Env:ASDC_BOOTSTRAP_DENTIST_PASSWORD
```

### Future shared development database

When D-CARE is ready to use a shared development database, each developer will need these values from the database owner/provider:

- host name or IP address
- port
- database name
- username
- password
- SSL requirement and certificate files, if the provider requires encrypted connections
- allowed source IP/VPN requirements, if access is restricted

To migrate the current `aromin_sison_dental` development data safely:

1. Freeze local writes briefly so no one changes data during export.
2. Export schema and data from the current source database using phpMyAdmin or `mysqldump`.
3. Create the shared development database and a least-privilege app user.
4. Import the dump into the shared database.
5. Run pending migrations with `php database/migrate.php`.
6. Give each developer their own `.env.local` values for the shared database.
7. Keep a backup dump from before and after migration.

Do not commit the shared database password. Share credentials through a password manager or another approved secure channel.

### Backend folder pattern

Every new endpoint follows the same shape: include `db.php`, use a prepared statement
(`$pdo->prepare(...)` + `->execute([...])`), never concatenate raw input into SQL, and
return `json_encode([...])`. Copy `api/patients/list.php` as your template for GET
endpoints and `api/auth/login.php` for endpoints that accept POST data.

For endpoints that require a logged-in user, also include the auth helper:
```php
require_once __DIR__ . '/../../config/auth.php';
require_login();                    // any authenticated user
require_role('receptionist', 'dentist');  // restrict to specific roles
```
This starts a hardened session (HttpOnly + SameSite cookie), enforces an idle timeout,
and centralizes 401/403 JSON responses so every endpoint returns the same shape.

## Notifications (Email)

The clinic can send patients email notifications for appointment reminders,
payment due alerts, confirmations, and more. The system is template-driven so staff
can reuse pre-written messages with dynamic `{placeholders}`.

### How it works

Notifications can be sent in two ways:

1. **Automatic** - fire from PHP endpoints when events happen (appointment booked, payment approved, etc.) using the `notify_event()` helper in `backend/config/notifications.php`
2. **Manual** - admin staff use the Notifications view in the admin dashboard to pick a patient, choose a template, and send

### Auto-trigger helper

Include `backend/config/notifications.php` in any endpoint, then call:

```php
notify_event($pdo, 'appointment.booked', $patientId, [
    'date'    => '2026-09-01',
    'time'    => '10:00 AM',
    'service' => 'Cleaning',
    'dentist' => 'Dr. Aromin',
]);
```

Available events: `appointment.booked`, `appointment.cancelled`, `payment.approved`, `payment.due`

### Default templates (seeded in schema.sql)

| Template key | Purpose | Channel |
|---|---|---|
| `appointment_reminder` | Reminder 24h before an appointment | Email |
| `appointment_confirmation` | Confirm a booked appointment | Email |
| `appointment_cancellation` | Notify of a cancelled appointment | Email |
| `payment_due` | Braces contract payment reminder | Email |
| `payment_received` | Payment received confirmation | Email |

Placeholders: `{patient_name}`, `{date}`, `{time}`, `{service}`, `{dentist}`, `{amount}`, `{balance}`

### API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `backend/api/notifications/send.php` | Send a notification to a patient |
| `GET` | `backend/api/notifications/list.php` | View notification history |
| `GET` | `backend/api/notifications/templates.php` | List all templates |
| `POST` | `backend/api/notifications/templates.php` | Create or update a template |

### Sending a notification (example)

```json
POST /backend/api/notifications/send.php
{
  "patient_id": 1,
  "template_key": "appointment_reminder",
  "replacements": {
    "date": "2026-09-01",
    "time": "10:00 AM",
    "service": "Cleaning",
    "dentist": "Dr. Aromin"
  }
}
```

### Email configuration

Email uses the installed PHPMailer dependency with Gmail SMTP over STARTTLS on
port 587. Configure these Windows **System environment variables** (do not put
the App Password in this repository):

- `ASDC_GMAIL_ADDRESS` - the complete Gmail address used to authenticate and send
- `ASDC_GMAIL_APP_PASSWORD` - the 16-character Gmail App Password
- `ASDC_MAIL_FROM_NAME` - optional; defaults to `Aromin-Sison Dental Clinic`

After adding or changing them, fully exit the XAMPP Control Panel, reopen it,
and restart Apache so PHP inherits the updated environment. If Apache is
installed as a Windows service, System variables are required because User
variables may not be visible to the service.


## Dashboard data

Appointments, contracts, patients, payments, promotions, treatment records, inventory, attendance reports, profile editing, notifications, and patient dashboard sync use PHP endpoints backed by MySQL. Request failures are shown as errors; browser-only demo data is not used to fabricate successful actions or records.

Promotions can be managed by receptionists from the admin dashboard and are displayed in the patient portal and public homepage. Uploaded promotion images are stored under `backend/uploads/promotions`; scripts and directory listings are blocked while image reads remain web-viewable.

## Next steps

### Automatic patient updates

The patient dashboard reads a patient-scoped server snapshot every three seconds while visible. Returning to the tab or reconnecting refreshes immediately. Appointments, contracts, dentist progress, payment reviews, balances, and stored treatment records update without reloading the page. Form inputs remain intact; open rescheduling dialogs track appointment IDs rather than row positions.

During connection failures, the last successful data stays visible with a retry notice. Retries back off to at most 30 seconds. This is polling, so delivery takes roughly three seconds plus request time under a healthy connection.

Apply database migrations after importing the base schema:

```sh
php database/migrate.php
```

Verification:

```sh
node tests/patient_live_sync.cjs
node tests/server_data_regression.cjs
php tests/patient_sync_integration.php
```

The integration test uses local Apache and MySQL, exercises separate receptionist/dentist/patient sessions, and removes its temporary records. Its patients have no email or phone, so it sends no external messages.

### Remaining setup

1. Install XAMPP, import `database/schema.sql`, run `php database/migrate.php`, and confirm `backend/api/patients/list.php` returns JSON.
2. Configure email delivery and create the receptionist bootstrap account.
3. Put all group members on one shared MySQL database if appointments and promotions must appear on every device.
