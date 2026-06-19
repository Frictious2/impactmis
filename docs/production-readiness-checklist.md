# ImpactMIS Production Readiness Checklist

Use this checklist before deploying ImpactMIS to a real NGO/CBO environment.

## Environment

- Set `APP_ENV=production`.
- Set a strong `SESSION_SECRET`; production startup fails if it is missing or left as `change_me`.
- Set `PORT`, `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `DB_PORT`.
- Set `DEV_ADMIN_NAME`, `DEV_ADMIN_EMAIL`, and a strong `DEV_ADMIN_PASSWORD` before first seed.
- Use HTTPS in production. Secure cookies are enabled when `APP_ENV=production`.

## Database

- Create the MySQL database and least-privilege application user.
- Run `npm run migrate`.
- Run `npm run seed` for the first deployment only, or when seed changes are intended.
- Run `npm run audit:license-modules` after migrations.
- Run `node scripts/audit-license-modules.js --fix` only when you want missing module keys normalized to `false`.
- Schedule regular database backups and verify restores.

## Uploads and File Storage

- Ensure `public/uploads/activity-reports` and `public/uploads/expenses` exist and are writable by the Node process.
- Back up uploaded files together with database backups.
- Current upload links are served statically from `public/uploads`. Tenant paths and randomized filenames reduce accidental discovery, but direct URL possession can bypass tenant authorization.
- For higher-security deployments, replace public upload URLs with guarded download routes that verify tenant/user access before streaming files.
- Do not allow executable file types. Existing upload handlers accept image/PDF types only and enforce 5MB limits.

## Security

- Keep `helmet` enabled.
- Keep CSRF protection enabled for POST routes.
- Confirm login rate limiting is active.
- Confirm session regeneration on login.
- Confirm disabled users cannot log in.
- Confirm temporary-password users are forced through `/change-password`.
- Keep all secrets out of source control.
- Rotate `SESSION_SECRET` and database credentials if exposed.

## Deployment: VPS

- Install a current LTS Node.js runtime.
- Install dependencies with `npm ci` when `package-lock.json` is present.
- Configure `.env` on the server.
- Run `npm run migrate`.
- Run `npm run qa:smoke`.
- Use a process manager such as PM2 or systemd.
- Put Nginx/Apache/Caddy in front as a reverse proxy with HTTPS.
- Enable log rotation for app and reverse-proxy logs.

## Deployment: cPanel / Node App

- Upload the project files without local `.env` secrets from development.
- Configure environment variables in cPanel's Node.js app settings.
- Install dependencies from cPanel terminal or setup UI.
- Run migrations from terminal if available.
- Point the app startup file to `app.js`.
- Confirm public assets and upload directories are writable.

## First Developer Admin

- Set `DEV_ADMIN_NAME`, `DEV_ADMIN_EMAIL`, and `DEV_ADMIN_PASSWORD`.
- Run `npm run seed`.
- Log in as the developer admin.
- Immediately change the seeded password if it was temporary/shared.

## First Tenant

- Log in as Developer.
- Go to Developer Dashboard > Tenants > Create Tenant.
- Select the required license modules, including `finance` only when Finance & Expenses should be enabled.
- Create the tenant admin with `must_change_password` enabled.
- Confirm the tenant admin can log in and is forced to change password.

## Operational QA

- Run `npm run qa:smoke` after deployments.
- Test login/logout, tenant dashboard, donor dashboard, one POST form, and one upload form.
- Confirm `/developer/*` is blocked for tenant users.
- Confirm `/donor/*` is blocked for non-donor users.
- Confirm tenant users cannot access another tenant's records by changing URL IDs.
