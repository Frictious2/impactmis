# ImpactMIS System Overview

ImpactMIS is a combined multi-tenant NGO/CBO Management Information System built with Node.js, Express, EJS, MySQL, Bootstrap 5, and vanilla JavaScript.

## Architecture

- One combined application handles developer administration, tenant operations, donor read-only access, licensing, and module gates.
- All tenant-owned records share one database and are isolated by `tenant_id`.
- Developer/Super Admin users have `tenant_id = NULL`.
- Tenant users must have `tenant_id` and are constrained by role, license status, and enabled license modules.
- Donor users use the donor portal and do not access internal tenant module routes.

## Core Areas

- Developer Dashboard: tenants, licenses, users, backups, diagnostics, system audit logs.
- Tenant Administration: organization profile, departments, tenant users, approvals, tenant audit logs.
- Operations: staff/volunteers, branches, geofenced attendance, projects, tasks.
- M&E: activity reports, indicators, LogFrames, indicator measurements, surveys, survey analytics.
- Donor Accountability: donor-safe projects, reports, indicators, beneficiaries, M&E summaries.
- Finance: categories, budgets, expenses, accounting/GL, bank accounts, bank transactions, statements.
- Payroll: settings, compensation, allowances, deductions, runs, generated payroll items, payslips, CSV exports.
- Reporting: global report center with HTML and CSV exports.
- Production: health, diagnostics, backups, maintenance mode, smoke checks.

## Known Limits

- No statutory tax filing automation.
- No external bank API or payment gateway integration.
- No GIS maps, external BI tools, PowerBI integration, or AI analytics.
- Restore is documented as a manual/offline operation; live UI restore is intentionally not implemented.
