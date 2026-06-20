# ImpactMIS Pilot Setup Checklist

## Environment Setup

- [ ] Install Node.js and MySQL.
- [ ] Copy `.env.example` to `.env`.
- [ ] Set `APP_URL`, `SESSION_SECRET`, database credentials, upload path, backup path, and log path.
- [ ] For browser geolocation demos, use HTTPS or localhost.

## Database Setup

- [ ] Create the MySQL database or allow the app bootstrap to create it where permitted.
- [ ] Run `npm install`.
- [ ] Run `npm run migrate`.
- [ ] Run `npm run seed` to create default permissions, roles, and Developer Admin.
- [ ] Confirm Developer Admin credentials from `.env`.

## Pilot Tenant Setup

- [ ] Run `npm run seed:demo` or create the tenant manually from Developer Dashboard.
- [ ] Create pilot tenant.
- [ ] Issue active license with required modules: staff, branches, attendance, projects, reports, donors, payroll, finance, approvals.
- [ ] Create Tenant Admin.
- [ ] Create sample departments.
- [ ] Create sample branches.
- [ ] Create sample staff/volunteers.
- [ ] Create sample project and task.
- [ ] Create sample activity report.
- [ ] Create sample payroll compensation setup and payroll run.
- [ ] Create sample finance category and expense.
- [ ] Create sample donor user.

## Validation

- [ ] Login as Developer.
- [ ] Review tenant and active license modules.
- [ ] Login as Tenant Admin.
- [ ] Confirm dashboard loads.
- [ ] Confirm Staff, Branches, Attendance, Projects, Reports, Payroll, Finance, Accounting, Surveys are visible when enabled.
- [ ] Login as Donor.
- [ ] Confirm donor portal shows only donor-safe data.
- [ ] Run `npm run qa:pilot`.
- [ ] Run `npm run qa:smoke`.
- [ ] Run `npm run qa:ejs`.
- [ ] Run `npm run qa:routes` with `BASE_URL` for live staging.

## Backup Test

- [ ] Create backup from Developer Dashboard.
- [ ] Run `npm run backup`.
- [ ] Confirm backup file appears in `BACKUP_DIR`.
- [ ] Download backup.
- [ ] Document manual restore test result in staging notes.
