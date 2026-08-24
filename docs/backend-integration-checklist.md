# Backend Integration Checklist

Every `TODO(backend)` marker in the codebase, mapped to the endpoint it needs.
Cross-referenced with `database/schema.sql` and the existing
`backend/api/` endpoints on 2026-08-13.

## How to use

- **Doing a marker**: find the file/line, wire the real request, remove the
  `TODO(backend)` comment (and the surrounding mock `setTimeout` where present).
- **Patterns to copy**: `backend/api/auth/login.php` (POST + prepared statement +
  session) and `backend/api/patients/list.php` (GET + JSON). Both already follow
  the README's backend pattern; copy them, don't invent a new structure.
- **Response shape**: match what the render functions in `admin.js`/`patient.js`
  already expect (they currently receive `AdminMock.*` / `PatientMock.*`).

## Required endpoints

### Auth

| # | Endpoint | Where the TODO lives | Schema support | Status |
|---|----------|----------------------|----------------|--------|
| 1 | `POST /api/auth/patient/login` | `auth/assets/js/auth.js:341,351` (mockSubmit, `endpoint` var), `auth/login.html:114` | `users` (email, password_hash, is_active, role='patient') | **Needs implementation** (pattern: `auth/login.php`) |
| 2 | `POST /api/auth/staff/login` | `auth/assets/js/auth.js:341,351`, `auth/login.html:162` | `users` (role='admin'/'staff'/'dentist') | **Needs implementation** |
| 3 | `POST /api/auth/patient/register` | `auth/register.html:103` (note says "endpoint TBD") | `users` + `patients` (insert both; `patients.user_id` nullable so walk-ins stay supported) | **Needs implementation** (transaction across both tables) |
| 4 | `POST /api/auth/{role}/forgot-password` | `auth/assets/js/auth.js:477`, `auth/forgot-password.html:61` | **None** — no token table, no mail setup | **Needs implementation + a decision** (see below) |
| 5 | Logout (clear session) — admin | `admin-system/assets/js/admin.js` -> moved to `shared/js/dashboard-core.js` (`initLogout`) | session only | **Needs implementation** (e.g. `POST /api/auth/logout` calling `session_destroy()`) |
| 6 | Logout (clear session) — patient | `patient-dashboard/assets/js/patient.js` -> moved to `shared/js/dashboard-core.js`, plus comment at `patient-dashboard/dashboard.html:79` | session only | **Needs implementation** (same endpoint as #5) |

All auth markers are still "mock by design" (see `auth.js` header comment and the
"Testing this form?" hints). Every mock outcome map of `auth/assets/js/auth.js`:
the `MOCK_MESSAGES` block is where the real `fetch` error strings go.

### Appointments / booking

| # | Endpoint | Where the TODO lives | Schema support | Status |
|---|----------|----------------------|----------------|--------|
| 7 | `POST /api/public/booking-requests` (public site CTA form) | `public-website/assets/js/main.js:158` | **Gap** — `appointments.patient_id NOT NULL`; a public form has no logged-in patient | **Needs implementation + a decision** (see below) |
| 8 | `POST /api/patient/appointments` | `patient-dashboard/assets/js/patient.js:101` (confirm booking button) | `appointments` (patient_id, service_type, scheduled_date, scheduled_time, status) | **Needs implementation** |
| — | `GET /api/patient/appointments` (upcoming list / history) | Swaps in for `PatientMock.dashboard.upcoming` / `PatientMock.schedule` / `PatientMock.history` (patient.js renderers) | `appointments` | **Needs implementation** |
| — | `GET /api/patients/list.php` | Already used by the admin patients table (see `admin.js` renderPatients comment) | `patients` + `braces_contracts` (scope filter: active/defaulted only) | **Exists** — see Database Verification |

### Admin dashboard list endpoints (no TODO markers yet, but required for the
same views once mock data is swapped)

| Endpoint | Replaces | Schema support | Status |
|----------|----------|----------------|--------|
| `GET /api/appointments/list.php` | `AdminMock.dashboard.week` (both week grids) + queue | `appointments` | Needs implementation (pattern: `patients/list.php`) |
| `GET /api/records/list.php` (treatment records) | `AdminMock.records` | `treatment_records` | Needs implementation |
| `GET /api/braces-contracts/list.php` | `AdminMock.braces` | `braces_contracts` + `contract_payments` | Needs implementation |
| `GET /api/promotions/list.php` | `AdminMock.promotions` | `promotions` | Needs implementation |
| `GET /api/inventory/list.php` | `AdminMock.inventory` | `inventory_items` | Needs implementation |
| `GET /api/reports/attendance.php` | `AdminMock.reports` (derivable per schema.sql comment) | `appointments` derived queries | Needs implementation |
| `GET /api/patients/{id}/contract.php`, `.../treatment.php`, `.../payments.php` | `PatientMock.braces` / `PatientMock.contract` / `PatientMock.treatments` | `braces_contracts`, `treatment_records`, `contract_payments` | Needs implementation |
| `GET /api/patient/profile.php` | `PatientMock.user` + `PatientMock.profile` | `users` + `patients` | Needs implementation |

## Gap notes (decisions the team must make)

1. **Forgot password** — `schema.sql` has no password-reset token table and
   nothing sends email locally. Decide: (a) add a reset-tokens table + mail(),
   (b) dev-only "token logged to console" behavior, or (c) keep the current
   "Feature Not Available Yet" modal. Do not build the endpoint before this is
   chosen.
2. **Public booking requests** — `appointments.patient_id` is `NOT NULL` and
   there is no `booking_requests` table. Decide: (a) add a `booking_requests`
   table, or (b) auto-create a walk-in `patients` row on submit. **Do not invent
   an API contract without updating `schema.sql` first.**
3. **Login endpoint shape** — `auth/login.php` is a single generic endpoint,
   but the frontend contract calls for role-specific paths
   (`/api/auth/patient/login`, `/api/auth/staff/login`). Either create thin
   role-specific wrappers or change the frontend to post the role. Reuse the
   existing `login.php` code either way.
4. **Reports** — per the comment at the bottom of `schema.sql`, reports come
   from derived queries on `appointments`; no new table needed.
5. **System scope (decided 2026-08-15)** — the admin dashboard only focuses on
   patients with a **current braces contract**. The mock data
   (`shared/js/mock-data/admin.js`) now only contains such patients (every row
   carries a `contract` ref; status `Current`/`Delinquent` ≈ `braces_contracts.status`
   `active`/`defaulted`), and `admin.js` enforces this client-side. When building
   endpoints, filter server-side too:
   - `GET /api/patients/list.php` → `LEFT JOIN braces_contracts bc ... WHERE bc.status IN ('active','defaulted')`
   - `GET /api/records/list.php` → same JOIN/filter
   - `GET /api/appointments/list.php` → filter to patients with active contracts
   - `GET /api/braces-contracts/list.php` → only return `active`/`defaulted` by default
     (the UI's default filter is now `Current`, not `All`)

## Marker inventory (all 12 found)

| File:line | Endpoint |
|-----------|----------|
| `auth/assets/js/auth.js:3` | Module header (informational — "everything is a MOCK") |
| `auth/assets/js/auth.js:351` | `POST /api/auth/patient/login` / `POST /api/auth/staff/login` (via `endpoint` var at line 341) |
| `auth/assets/js/auth.js:477` | `POST /api/auth/{role}/forgot-password` |
| `auth/login.html:114` | `POST /api/auth/patient/login` |
| `auth/login.html:162` | `POST /api/auth/staff/login` |
| `auth/register.html:103` | `POST /api/auth/patient/register` |
| `auth/forgot-password.html:61` | `POST /api/auth/{role}/forgot-password` |
| `public-website/assets/js/main.js:158` | `POST /api/public/booking-requests` |
| `patient-dashboard/assets/js/patient.js:101` | `POST /api/patient/appointments` |
| `patient-dashboard/assets/js/patient.js:299` (moved to `shared/js/dashboard-core.js`) | logout: clear session server-side |
| `admin-system/assets/js/admin.js:245` (moved to `shared/js/dashboard-core.js`) | logout: clear session server-side |
| `patient-dashboard/dashboard.html:79` | logout (HTML comment near the logout button) |

The two `assets/js` logout markers were consolidated into the single
`initLogout()` in `shared/js/dashboard-core.js` during the dedup pass.