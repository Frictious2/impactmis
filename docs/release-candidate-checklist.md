# ImpactMIS Release Candidate Checklist

## Build And Data

- [ ] Run `npm install`.
- [ ] Run `npm run migrate`.
- [ ] Run `npm run seed` when setting up a new environment.
- [ ] Run `npm run audit:license-modules`.
- [ ] Run `npm run qa:smoke`.
- [ ] Run `npm run qa:ejs`.
- [ ] Run `npm run qa:routes` with `BASE_URL` against staging.

## Backup And Restore

- [ ] Create a backup from `/developer/backups`.
- [ ] Create a backup with `npm run backup`.
- [ ] Confirm backup file exists in `BACKUP_DIR`.
- [ ] Download backup from Developer Dashboard.
- [ ] Perform a manual restore test in a non-production database.
- [ ] Restore or verify `public/uploads` backup separately.

## Login And Access

- [ ] Developer login works.
- [ ] Tenant Admin login works.
- [ ] Staff/Volunteer restricted access works.
- [ ] Donor lands on `/donor/dashboard`.
- [ ] Disabled user cannot login.
- [ ] `must_change_password` flow works.

## Tenant And Module Workflow

- [ ] Developer creates tenant.
- [ ] Developer issues license and enables modules.
- [ ] Finance module controls expenses, budgets, and accounting.
- [ ] Reports module controls reports, surveys, and activity reports.
- [ ] Projects module controls projects, tasks, LogFrames, and indicators.

## Operational Smoke

- [ ] Create staff/volunteer.
- [ ] Create branch.
- [ ] Create attendance record.
- [ ] Create project, task, indicator, and LogFrame.
- [ ] Create activity report and approve it.
- [ ] Create survey, publish it, and submit response.
- [ ] Create expense and approve/mark paid.
- [ ] Create chart of accounts and post balanced journal.
- [ ] Generate payroll run and view generated payroll items.
- [ ] View/print payslip.
- [ ] Export report CSV.
- [ ] Confirm donor portal shows only approved/safe records.

## Production Controls

- [ ] `/health` works.
- [ ] `/diagnostics` is Developer-only.
- [ ] Backup routes are Developer-only.
- [ ] Maintenance mode blocks non-developers and allows developers.
- [ ] Upload directories are writable and backed up.
- [ ] Logs rotate or are managed by hosting environment.
