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
│   │   └── mock-data/        Centralized sample data for both dashboards (admin.js, patient.js)
│   └── images/               Shared photography & logos (see below)
│
├── backend/                  PHP API / server code
│   ├── config/
│   │   ├── db.php            PDO connection: include this at the top of every endpoint
│   │   ├── auth.php          Session helper: require_login(), require_role(), secure_session_start()
│   │   ├── mail.php          Email/SMS helpers: send_email(), send_sms(), render_template()
│   │   └── notifications.php Auto-trigger helper: notify_event($pdo, $event, $patientId, $replacements)
│   └── api/
│       ├── auth/
│       │   ├── login.php     POST endpoint, prepared statement, session
│       │   └── logout.php    POST endpoint, destroys server-side session
│       ├── patients/
│       │   └── list.php      GET endpoint, returns JSON
│       └── notifications/
│           ├── send.php      POST endpoint, sends email/SMS using templates
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

Dashboard HTML files load four — adding `panels.css` for the popover dropdowns:
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
4. Test: `http://localhost/asdc_v2/backend/api/patients/list.php`

**Laragon:**
1. Install [Laragon](https://laragon.org/), click **Start All**
2. Copy the whole `asdc_v2/` folder into `C:\laragon\www\`
3. Right-click the Laragon tray icon → **MySQL** → **phpMyAdmin** (or **HeidiSQL**), create a database, import `database/schema.sql`
4. Test: `http://asdc-v2.test/backend/api/patients/list.php` (Laragon auto-generates the `.test` domain) or `http://localhost/asdc_v2/backend/api/patients/list.php`

Either way you should get a JSON response (empty array is fine until you add data).

Check `backend/config/db.php`: the default credentials (`root` / no password) work for both XAMPP and Laragon out of the box, adjust if yours differ.

### Backend folder pattern

Every new endpoint follows the same shape: include `db.php`, use a prepared statement
(`$pdo->prepare(...)` + `->execute([...])`), never concatenate raw input into SQL, and
return `json_encode([...])`. Copy `api/patients/list.php` as your template for GET
endpoints and `api/auth/login.php` for endpoints that accept POST data.

For endpoints that require a logged-in user, also include the auth helper:
```php
require_once __DIR__ . '/../../config/auth.php';
require_login();                    // any authenticated user
require_role('admin', 'staff');     // restrict to specific roles
```
This starts a hardened session (HttpOnly + SameSite cookie), enforces an idle timeout,
and centralizes 401/403 JSON responses so every endpoint returns the same shape.

## Notifications (Email / SMS)

The clinic can send patients email and SMS notifications for appointment reminders,
payment due alerts, confirmations, and more. The system is template-driven so staff
can reuse pre-written messages with dynamic `{placeholders}`.

### How it works

Notifications can be sent in two ways:

1. **Automatic** — fire from PHP endpoints when events happen (appointment booked, payment approved, etc.) using the `notify_event()` helper in `backend/config/notifications.php`
2. **Manual** — admin staff use the Notifications view in the admin dashboard to pick a patient, choose a template, and send

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
| `appointment_reminder` | Reminder 24h before an appointment | Email + SMS |
| `appointment_confirmation` | Confirm a booked appointment | Email + SMS |
| `appointment_cancellation` | Notify of a cancelled appointment | Email + SMS |
| `payment_due` | Braces contract payment reminder | Email |
| `payment_received` | Payment received confirmation | Email + SMS |

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

### Mail/SMS configuration

Edit `backend/config/mail.php` to switch delivery methods:

- **Email**: defaults to PHP `mail()` (works on XAMPP locally). For real delivery,
  install PHPMailer (`composer require phpmailer/phpmailer`) and uncomment the
  Gmail SMTP section with your clinic email + app password.
- **SMS**: simulated (logged only) by default. For real SMS, install the Twilio SDK
  (`composer require twilio/sdk`) and uncomment the Twilio section with your
  account SID, auth token, and Twilio phone number.

## Next steps

1. Install XAMPP, import `database/schema.sql`, confirm `backend/api/patients/list.php` returns JSON
2. Wire the `auth/` pages to `backend/api/auth/` for real login — see `docs/backend-integration-checklist.md` for every `TODO(backend)` marker
3. Update `admin-system/dashboard.html`'s JS to `fetch()` real data from `backend/api/` endpoints instead of the hardcoded sample rows
4. Build out the rest of `backend/api/` (appointments, braces contracts, promotions, inventory) following the `patients/list.php` pattern
5. Build the Patient Dashboard frontend (same pattern as admin-system)
