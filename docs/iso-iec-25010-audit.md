# ISO/IEC 25010:2023 quality audit

Audit date: 2026-09-24. Scope: public website, authentication, patient portal, dentist portal, receptionist portal, shared client code, and PHP API. The repository did not contain a separate uploaded evaluation-form artifact, so this audit applies the eight characteristics specified for the delivery.

| Characteristic | Evidence reviewed | Result / improvement |
| --- | --- | --- |
| Functional suitability | Appointment, patient sync, password reset, state-management, and dashboard data regression tests | Core role workflows and validation are covered. Public booking now returns a clear 429 response during a submission burst. |
| Performance efficiency | Shared responsive shell, lazy image usage, mobile compositor rules, CSS transitions | Removed four `transition: all` declarations from public controls and retained transform/opacity-safe motion. |
| Compatibility | HTML viewport configuration, shared CSS breakpoints (960px, 640px, 380px), native control types | Phone/tablet shell uses drawer navigation, safe-area padding, horizontal filter overflow containment, and mobile dialogs. Booking fields now provide names, autofill, and mobile telephone hints. |
| Interaction capability | Labels, status regions, focus styling, keyboard dialogs/menus, touch targets | The existing labelled controls, live feedback, modal focus traps, Escape handling, and visible focus replacements are preserved. Shared buttons now use `touch-action: manipulation`. |
| Reliability | Session refresh/live-sync behaviour, API validation, transaction-based services | Regression coverage confirms polling backoff, hidden-tab pause, request deduplication, session expiry, appointment conflict handling, and profile scoping. |
| Security | Session configuration, role checks, CSRF, scoped SQL, upload validation, response headers | Added public booking rate limiting. Profile uploads are now served only through an authenticated endpoint; direct files remain denied. |
| Flexibility | Role-aware routes/data scopes, shared dashboard system, responsive layout | Existing receptionist, dentist, and patient role paths are maintained, with shared shell behaviour across narrow and wide displays. |
| Safety | Confirm dialogs, archive retention, destructive-action styles, server validation | Existing confirmation and retention flows remain. Public booking now limits automated repeated submissions without counting invalid corrections. |

## Verification

- PHP lint: 92 PHP files passed before changes; all changed PHP files passed after changes.
- JavaScript syntax: 55 files passed.
- Passed: password reset service and form regression, server data regression, and patient live-sync regression.
- `git diff --check` passed.

## Deployment checks

Run the database-backed appointment and portal-browser integration tests against a started Laragon/Apache + MySQL instance before release. They require `ASDC_TEST_BASE_URL` to resolve to that running local system and intentionally create isolated fixtures.
