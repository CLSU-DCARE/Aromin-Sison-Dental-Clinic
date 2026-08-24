# Aromin-Sison Dental Clinic: System Project

## Folder Structure

```
aromin-sison-dental-system/
│
├── public-website/           Public-facing site (Home, About, Dentists, Services, Promotions, Contact, Book Appointment)
│   ├── index.html
│   ├── about.html
│   ├── dentist.html
│   └── assets/
│       ├── css/main.css      Page-specific styles
│       └── js/main.js        Page-specific scripts
│
├── auth/                     Login / registration pages shared across frontends
│   ├── login.html
│   ├── admin-login.html
│   ├── patient-login.html
│   ├── register.html
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
│   ├── css/variables.css     Color tokens, used via CSS variables (--ink, --gold, --ivory, etc.)
│   ├── css/buttons.css       Shared button design system (.btn, .btn-gold, .btn-primary, etc.)
│   ├── js/dashboard-core.js  Shared dashboard utilities (Modal, toast, sidebar, fullscreen, logout)
│   ├── js/mock-data/         Centralized sample data for both dashboards (admin.js, patient.js)
│   └── images/               logo.png, asdc logo.png, interior.png, and future shared photography
│
├── backend/                  PHP API / server code
│   ├── config/
│   │   └── db.php            PDO connection: include this at the top of every endpoint
│   └── api/
│       ├── auth/
│       │   └── login.php     POST endpoint, prepared statement, session
│       └── patients/
│           └── list.php      GET endpoint, returns JSON
│
├── database/
│   └── schema.sql            Starter MySQL schema: see notes below
│
└── docs/                     Capstone documentation, ERD exports, meeting notes, etc.
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

Each HTML file loads three stylesheets in this order:
```html
<link rel="stylesheet" href="../shared/css/variables.css">   <!-- brand tokens -->
<link rel="stylesheet" href="../shared/css/buttons.css">     <!-- shared button system -->
<link rel="stylesheet" href="assets/css/main.css">           <!-- page-specific styles -->
```
`variables.css` must load first since `main.css`/`admin.css` reference its variables
(e.g. `background: var(--ivory)`), and `buttons.css` second so every page uses the
same button design system: hover/press/focus/disabled/loading states, sizes, and
radii stay consistent across the public site, auth pages, and both dashboards.
Pages may still add their own layout adjustments on top (e.g. full-width buttons in
the mobile menu), but button *look and feel* should never be redefined per page :
add a variant to `shared/css/buttons.css` instead.

## About the database

Yes: this project needs one. See `database/schema.sql` for a starting schema covering:
`users`, `patients`, `appointments`, `treatment_records`, `braces_contracts`,
`contract_payments`, `promotions`, `inventory_items`.

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
2. Copy the whole `aromin-sison-dental-system/` folder into `C:\xampp\htdocs\`
3. Open `http://localhost/phpmyadmin`, create a database, import `database/schema.sql`
4. Test: `http://localhost/aromin-sison-dental-system/backend/api/patients/list.php`

**Laragon:**
1. Install [Laragon](https://laragon.org/), click **Start All**
2. Copy the whole `aromin-sison-dental-system/` folder into `C:\laragon\www\`
3. Right-click the Laragon tray icon → **MySQL** → **phpMyAdmin** (or **HeidiSQL**), create a database, import `database/schema.sql`
4. Test: `http://aromin-sison-dental-system.test/backend/api/patients/list.php` (Laragon auto-generates the `.test` domain) or `http://localhost/aromin-sison-dental-system/backend/api/patients/list.php`

Either way you should get a JSON response (empty array is fine until you add data).

Check `backend/config/db.php`: the default credentials (`root` / no password) work for both XAMPP and Laragon out of the box, adjust if yours differ.

### Backend folder pattern

Every new endpoint follows the same shape: include `db.php`, use a prepared statement
(`$pdo->prepare(...)` + `->execute([...])`), never concatenate raw input into SQL, and
return `json_encode([...])`. Copy `api/patients/list.php` as your template for GET
endpoints and `api/auth/login.php` for endpoints that accept POST data.

## Next steps

1. Install XAMPP, import `database/schema.sql`, confirm `backend/api/patients/list.php` returns JSON
2. Update `admin-system/dashboard.html`'s JS to `fetch()` real data from `backend/api/` endpoints instead of the hardcoded sample rows
3. Build out the rest of `backend/api/` (appointments, braces contracts, promotions, inventory) following the `patients/list.php` pattern
4. Wire the `auth/` pages to `backend/api/auth/` for real login (admin, staff, and patient roles)
5. Build the Patient Dashboard frontend (same pattern as admin-system)
