# ImpactMIS Role Permissions Summary

This document summarizes the current intended permission model for tenant and developer users.

| Role | Primary Access | Create/Edit | Approve/Pay | Read-only Areas | Explicit Restrictions |
|---|---|---|---|---|---|
| Developer / Super Admin | Developer Dashboard, tenants, licenses, platform audit views | Tenants, licenses, developer-managed system records | Tenant suspend/reactivate, license issue/renew | System-wide tenant/license overview | Cannot enter tenant dashboard without tenant impersonation, which is not implemented. |
| NGO/CBO Admin / Tenant Admin | Full tenant administration across licensed modules | Tenant users, settings, departments, staff, branches, projects, attendance, reports, payroll, finance | Attendance, activity reports, payroll, expenses | Tenant audit logs, reports | Cannot access Developer Dashboard. |
| HR Manager | HR, staff, departments, attendance | Staff and attendance workflows where enabled | Attendance approvals | HR and attendance reports | Cannot approve payroll/finance unless also granted a finance/payroll role in code. |
| Finance / Payroll Manager | Payroll, compensation, finance categories, expenses, budgets, accounting | Payroll setup/runs, finance categories, expenses, budgets, chart of accounts, journals, bank accounts, bank transactions | Payroll and expense approval/payment, journal and bank transaction posting | Payroll, finance, and accounting reports | Should not approve activity/project workflows unless separately allowed. |
| Project Manager | Projects, tasks, activity reports, indicators | Projects/tasks/activity reports/indicator updates | Project/activity report approvals | Project, activity, indicator reports | Cannot approve payroll or finance payments. |
| M&E Officer | Activity reports, indicators, LogFrames, surveys | LogFrames, indicator measurements, surveys, survey questions | M&E workflow actions where enabled | M&E reports and survey analytics | Role is supported by code where present, but may need to be seeded/assigned in deployments that require it. |
| Data Entry Officer | Operational data capture | Attendance, activity reports, expenses where allowed | None | Basic non-financial reports | Cannot approve attendance, activity reports, expenses, payroll, or finance actions. |
| Staff | Own profile-related workflows where implemented | Self-check-in and own payroll view when linked | None | Own payroll history and payslips only | No global reports, no finance/payroll admin, no donor portal, no developer routes. |
| Volunteer | Volunteer self-service where implemented | Self-check-in and own payroll view when linked | None | Own payroll history and payslips only | Same restrictions as Staff. |
| Auditor | Tenant oversight and read-only reports | None | None | Reports, payroll runs/payslips, finance/expense/accounting views, audit logs | Must remain read-only; cannot create/edit/approve/pay/export payroll CSV unless explicitly allowed. |
| Donor Read-only User | Donor portal only | None | None | Approved projects, approved reports, indicators, beneficiary summaries, received messages | Cannot access internal tenant modules, staff personal details, payroll, finance, audit logs, settings, or Developer Dashboard. |

## Consistency Rules

- Donor users are routed through `/donor/*` and blocked from normal tenant pages by `requireNonDonorTenant`.
- Staff and Volunteer users are blocked from global report center and administrative payroll/finance routes by role middleware.
- Data Entry users can submit operational records but should not approve their own or others' records.
- Auditor users can view sensitive operational areas for oversight but should not mutate records.
- Finance Manager authority is limited to payroll/finance workflows.
- Project Manager authority is limited to projects, tasks, activity reports, indicators, and related project workflows.
- Tenant Admin remains the broad tenant-side administrative role.

## Current Enforcement Points

- Developer access: `requireDeveloper`.
- Tenant access: `requireTenantUser` and `requireActiveLicense`.
- Donor-only portal: `requireDonor`.
- Internal tenant modules: `requireNonDonorTenant`.
- License modules: `requireModuleAccess`.
- Payroll roles: `require-payroll-role.js`.
- Finance/expense roles: `require-finance-role.js`.
- Report roles: `require-report-access.js`.
- Message compose rules: `message.service.js`.
