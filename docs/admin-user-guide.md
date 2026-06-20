# ImpactMIS Admin User Guide

## Tenant Onboarding

1. Developer creates tenant from `/developer/tenants/create`.
2. Developer issues an active license and selects enabled modules.
3. Developer creates the first Tenant Admin during onboarding.
4. Tenant Admin logs in and configures organization profile, departments, users, and approval workflows.

## Operational Setup

1. Create branches if branch tracking/geofencing is enabled.
2. Create departments.
3. Add staff and volunteers, assigning departments, branches, and optional linked user accounts.
4. Configure projects, assignments, tasks, indicators, LogFrames, and surveys.
5. Configure finance categories, project budgets, payroll settings, and compensation if those modules are enabled.

## Routine Workflows

- Attendance: create single or bulk attendance, approve/reject where authorized.
- Activity Reports: create, submit, approve/reject, attach safe files.
- M&E: maintain LogFrames, add indicator measurements, publish surveys, review survey analytics.
- Finance: create expenses, approve/reject, mark paid, track budget utilization.
- Accounting: maintain chart of accounts, create/post journals, post bank transactions, review statements.
- Payroll: configure compensation, generate payroll runs, review generated payroll items, approve/pay, print payslips.
- Reporting: use `/reports/center` for HTML reports and CSV exports.

## Donor Access

Create donor users from tenant user management with role `Donor`. Donors are read-only and land on `/donor/dashboard`.
