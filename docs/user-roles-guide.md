# ImpactMIS User Roles Guide

## Developer / Super Admin

Manages tenants, licenses, backups, diagnostics, and system audit logs. Developer users have `tenant_id = NULL` and cannot enter tenant dashboards without an impersonation feature, which is not implemented.

## Tenant Admin

Full tenant administration across enabled modules. Can manage users, organization setup, staff, branches, projects, M&E, payroll, finance, accounting, and reports.

## HR Manager

Manages staff and attendance areas. Can approve attendance where role gates allow. Does not approve payroll or finance by default.

## Finance / Payroll Manager

Manages payroll, finance, expenses, project budgets, accounting, journals, bank accounts, and financial statement views.

## Project Manager

Manages project workflows, tasks, activity reports, indicators, LogFrames, and surveys. Does not approve payroll or finance payments by default.

## Data Entry Officer

Can capture operational records where allowed, but cannot approve workflows.

## Staff / Volunteer

Limited self-service access, including self check-in and own payroll history when linked to a staff record. No global admin, finance, payroll admin, or report center access.

## Auditor

Read-only oversight across reports and permitted tenant areas. Auditor must not create, edit, approve, pay, post, or delete records.

## Donor

Read-only donor portal user. Can see donor-safe projects, approved activity reports, indicators, beneficiary summaries, and M&E summaries. Cannot access internal tenant modules, payroll, finance, audit logs, or developer routes.
