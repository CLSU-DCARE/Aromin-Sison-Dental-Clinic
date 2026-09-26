# Vercel + Railway deployment

The browser must use the Vercel site for both pages and API requests. Vercel
proxies `/backend/*` to Railway, so existing relative URLs such as
`../backend/api/auth/login.php` remain same-origin. Do not change the frontend
to call the Railway URL, and do not add permissive CORS headers.

## 1. Create Railway services

1. Create a Railway project with a **MySQL** service and an application service
   from this repository. The application uses the included `Dockerfile`.
2. Add a Railway **Volume** to the application service at exactly:

   ```text
   /var/www/html/backend/uploads
   ```

   This preserves receipts, profile pictures, and promotion images across
   application deployments. It also keeps the single replica's file sessions
   in a server-denied hidden subdirectory. The startup command creates the
   needed folders and grants the Apache user access.
3. Set the application service to **one replica**. PHP sessions are file based;
   do not scale out until session storage is moved to shared storage (for
   example Redis) and it has been tested.
4. Generate a public Railway domain. It is the origin used only by Vercel's
   rewrite; it must not be used by frontend JavaScript.

The included `railway.toml` provides the Docker build, health check, and restart
policy. Apache binds Railway's injected `PORT`, rather than assuming port 80.

## 2. Set Railway application variables

Set these as Railway service variables. Use references to the MySQL service's
variables for the five database values; Railway's MySQL variables are normally
named `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, and
`MYSQLPASSWORD`.

| Application variable | Value |
| --- | --- |
| `ASDC_DB_HOST` | MySQL `MYSQLHOST` reference |
| `ASDC_DB_PORT` | MySQL `MYSQLPORT` reference |
| `ASDC_DB_NAME` | MySQL `MYSQLDATABASE` reference |
| `ASDC_DB_USER` | MySQL `MYSQLUSER` reference |
| `ASDC_DB_PASS` | MySQL `MYSQLPASSWORD` reference |
| `ASDC_APP_URL` | Canonical `https://` Vercel production domain |
| `ASDC_FORCE_HTTPS` | `1` |
| `ASDC_GMAIL_ADDRESS` | Production sending address |
| `ASDC_GMAIL_APP_PASSWORD` | Gmail app password |
| `ASDC_MAIL_FROM_NAME` | `Aromin-Sison Dental Clinic` (or chosen sender name) |
| `ASDC_AUDIT_RETENTION_DAYS` | `90` (or clinic retention policy) |

Do not set `ASDC_TRUSTED_PROXIES` for this setup. `ASDC_FORCE_HTTPS=1` marks
host-only session and remember-me cookies as `Secure` without trusting
visitor-supplied forwarding headers. Cookies retain `HttpOnly`, `SameSite=Lax`,
and `Path=/`; because the Vercel rewrite is same-origin, they are issued to the
Vercel site and work with the existing `credentials: 'same-origin'` requests.

Keep all secrets in Railway variables, not `.env`, Vercel variables, or Git.
The Docker build deliberately excludes `.env` files and uploaded content.

## 3. Initialize the database

On a new, empty Railway MySQL database, import `database/schema.sql` once using
the Railway MySQL connection details and a trusted MySQL client. Then open a
Railway shell for the application service and run:

```sh
php database/migrate.php
```

The migration runner records each migration in `schema_migrations`, so it is
safe to rerun during later releases. Back up MySQL before every production
migration. Run `database/bootstrap_staff.php` only when the two bootstrap
password variables are temporarily supplied in that one-off shell; remove them
immediately afterwards.

## 4. Configure Vercel

1. Import the same repository as a Vercel project. It is a static site: leave
   the build command empty and publish the repository root.
2. In `vercel.json`, replace **only** `REPLACE_WITH_YOUR_RAILWAY_DOMAIN` with
   the public Railway hostname, without a trailing slash. For example:

   ```json
   "destination": "https://clinic-api-production.up.railway.app/backend/:path*"
   ```

3. Deploy Vercel, then set its production/custom domain. Copy that exact HTTPS
   domain into Railway's `ASDC_APP_URL` and redeploy Railway if it changed.

The Vercel rule proxies every backend route, including authenticated image
delivery and promotion images. API, authentication, and upload paths get
`no-store` cache headers at both Vercel and Apache. Static frontend assets can
still be cached normally. There is intentionally no CORS configuration: a
browser never makes a direct cross-origin API request in this architecture.

## 5. Release checks

After deployment, test through the Vercel URL only:

1. Sign in, refresh a dashboard, and sign out. Confirm `ASDC_SESSION` is
   `Secure`, `HttpOnly`, host-only, and `SameSite=Lax` in browser devtools.
2. Make a mutating request (including an upload) and confirm CSRF validation
   succeeds. Confirm a reload still sees the session on the single replica.
3. Upload a receipt, profile image, and promotion image; redeploy Railway; then
   confirm each still exists. Direct `/backend/uploads/receipts/...` and
   `/backend/uploads/profiles/...` requests must be denied.
4. Confirm API responses contain `Cache-Control: no-store` and do not expose
   PHP errors or source/configuration files.
5. Test password-reset email delivery from the Vercel URL and a database backup
   restore in a non-production environment.

## Password-reset delivery recovery

The reset endpoint always returns a generic success response so it cannot reveal
whether an email address belongs to an account. If users see that confirmation
but no message arrives, inspect the Railway application logs rather than relying
on the browser response. The relevant entries are:

- `ASDC_APP_URL is not set`: set `ASDC_APP_URL` to the exact Vercel HTTPS domain.
- `PASSWORD RESET MAIL FAILED`: correct the Gmail address or app password, or
  investigate the reported SMTP connection/TLS category.
- `PASSWORD RESET TOKEN CLEANUP FAILED`: investigate Railway database access;
  this is logged only when a failed email's reset token could not be removed.

After updating a Railway variable, redeploy the application and send one reset
request to a controlled active mailbox through the Vercel URL. Confirm that the
email uses the Vercel domain, can reset the password once, and that the updated
password can sign in.

Run a scheduled Railway job (or another trusted scheduler) daily for:

```sh
php database/maintenance.php
```

Also schedule encrypted MySQL backups outside Railway and snapshot/back up the
Railway Volume. A database backup alone does not include uploaded files.
