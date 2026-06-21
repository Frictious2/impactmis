# ImpactMIS v1 Release Notes

## Included

- Multi-tenant foundation with license/module gating.
- Developer tenant/license management, license review, developer user review, diagnostics, backups, and paginated system audit logs.
- Tenant organization setup, users, roles, approvals, and tenant audit logs.
- Staff and volunteer management.
- Branch management and geofenced attendance.
- Projects, staff assignments, tasks, indicators, LogFrames, surveys, activity reports, and M&E measurements.
- Donor read-only portal with donor-safe accountability summaries.
- Payroll foundation, payroll runs, generated payroll items, payslips, staff self-view, and CSV export.
- Finance, expenses, project budgets, accounting/GL foundation, bank accounts, bank transactions, and basic financial statements.
- Notifications and in-app messaging.
- Reporting center with HTML and CSV exports.
- Production readiness features: health, diagnostics, backups, maintenance mode, QA scripts, deployment docs.

## RC Polish Notes

- Developer topbar now hides tenant-only notification and message links.
- Developer dashboard now shows operational tenant/license health, recent tenants, recent audit logs, backup status, and quick actions.
- Developer Licenses, Users, and Settings sidebar pages now show safe, useful read-only information instead of vague placeholders.
- Tenant detail license module display now shows every module as enabled or disabled, including Finance & Expenses.
- License forms now explain and preview calculated expiry dates.
- Sensitive Developer actions such as tenant suspension/reactivation and backup deletion now require confirmation.
- Developer audit logs now support tenant, action, entity type, date filters, and pagination.
- Diagnostics now includes safe DB connection and storage configuration values, including `DB_CONNECTION_LIMIT`.

## Known Limitations

- No external bank integrations.
- No tax filing/statutory compliance automation.
- No GL period close workflow.
- No PDF generation for payslips or reports.
- No GIS maps or external BI integrations.
- No SMS, WhatsApp, email, or push notification integrations.

## Suggested Roadmap

- Formal permission matrix stored in database.
- PDF exports for reports and payslips.
- Maintenance-mode admin banner and scheduled jobs.
- Deeper accounting controls: periods, reconciliation, approvals, and audit exports.
- Advanced M&E dashboards and map-based coverage views.
