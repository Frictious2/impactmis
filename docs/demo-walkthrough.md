# ImpactMIS Demo Walkthrough

## 1. Developer Login

Login using the Developer Admin configured in `.env`.

Show:
- Developer dashboard.
- Tenants list.
- Pilot tenant detail.
- Active license modules.
- Backups and diagnostics.

## 2. Tenant Creation And License Review

Open the pilot tenant from `/developer/tenants`.

Review:
- Tenant profile.
- Current license status and expiry.
- Enabled modules.
- Tenant admin user.

## 3. Tenant Admin Login

Login with:

- Email: `DEMO_ADMIN_EMAIL`
- Password: `DEMO_ADMIN_PASSWORD`

Show:
- Tenant dashboard metrics.
- Organization setup.
- Departments.
- Users.

## 4. Staff

Open Staff & Volunteers.

Show:
- Staff register.
- Staff detail.
- Department and branch assignment.

## 5. Branches And Geofenced Attendance

Open Branches and Attendance.

Explain:
- Branch has latitude, longitude, and geofence radius.
- Staff can be assigned to branches.
- Self check-in requires browser/device location permission.
- In production, geolocation should be served over HTTPS.

## 6. Projects

Open Projects.

Show:
- Sample project.
- Task tab.
- Indicator tab.
- LogFrame link.
- Activity Reports tab.

## 7. Activity Reports And M&E

Show:
- Approved activity report.
- Indicator progress.
- Indicator measurements.
- LogFrame hierarchy.
- Surveys and response analytics.

## 8. Donor Portal

Login with:

- Email: `DEMO_DONOR_EMAIL`
- Password: `DEMO_DONOR_PASSWORD`

Show:
- Donor dashboard.
- Projects.
- Approved reports only.
- Indicator and beneficiary summaries.
- Donor-safe M&E summaries.

## 9. Payroll

Open Payroll.

Explain:
- Compensation must be configured before payroll generation.
- Payroll items are generated inside payroll runs.
- Payslips can be viewed/printed.

## 10. Finance And Accounting

Open Finance & Expenses.

Show:
- Finance categories.
- Expense register and detail.
- Project budgets.
- Accounting chart of accounts.
- Journals and statements.

## 11. Reports Center

Open Reports Center.

Show:
- Staff Register.
- Activity Register.
- Indicator Progress.
- LogFrame Progress.
- Survey Summary.
- Expense Register.
- CSV export.

## 12. Backup And Diagnostics

Return to Developer Dashboard.

Show:
- `/diagnostics`.
- `/developer/backups`.
- Create/download backup.
