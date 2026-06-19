# ImpactMIS Route Security Matrix

This matrix summarizes the intended middleware and access controls after the Phase 12 hardening pass.

| Route | Method | Required auth | Required role/module | Tenant scoped? | Notes |
|---|---:|---|---|---|---|
| `/login` | GET | Public | None | No | Redirects authenticated users to the correct dashboard or password-change flow. |
| `/login` | POST | Public + CSRF | Login rate limit | No | Disabled users cannot authenticate; session is regenerated after login. |
| `/change-password` | GET/POST | `requireAuth` + CSRF on POST | Current authenticated user | User scoped | Required when `must_change_password` is true. |
| `/logout` | POST | CSRF | Current authenticated user/session | User scoped | Destroys session and clears cookie. |
| `/developer/*` | GET/POST | `requireAuth` | `requireDeveloper` | Developer-wide | Developer users must have `tenant_id = NULL`. |
| `/developer/tenants` | GET | `requireAuth` | Developer | No tenant scope | Lists all tenants for platform administration. |
| `/developer/tenants/create` | GET | `requireAuth` | Developer | No tenant scope | Uses module catalog including `finance`. |
| `/developer/tenants` | POST | `requireAuth` + CSRF | Developer + tenant/license validators | New tenant scoped transaction | Creates tenant, active license, and tenant admin in one transaction. |
| `/developer/tenants/:id/licenses/new` | GET | `requireAuth` | Developer | Tenant selected by route | License issue/renew form. |
| `/developer/tenants/:id/licenses` | POST | `requireAuth` + CSRF | Developer + license validator | Tenant selected by route | New licenses persist normalized module access map. |
| `/developer/tenants/:id/suspend` | POST | `requireAuth` + CSRF | Developer | Tenant selected by route | Suspended tenants are blocked by `requireActiveLicense`. |
| `/donor/*` | GET | `requireAuth` | `requireTenantUser`, `requireActiveLicense`, `requireDonor` | Yes | Donor portal is read-only. |
| `/donor/projects*` | GET | Tenant donor | `projects` module | Yes | Active/completed projects only. |
| `/donor/activity-reports*` | GET | Tenant donor | `reports` module | Yes | Approved reports only. |
| `/donor/indicators` | GET | Tenant donor | `projects` module | Yes | Donor-safe indicators only. |
| `/donor/beneficiaries` | GET | Tenant donor | `reports` module | Yes | Approved report summaries only. |
| `/license-expired` | GET | `requireAuth` | `requireTenantUser` | Yes | Available even when license is missing/expired. |
| `/notifications` | GET | `requireAuth` | `requireTenantUser`, `requireActiveLicense` | Yes | User sees own and tenant-wide notifications. |
| `/notifications/:id/read` | POST | Tenant user + CSRF | Own/tenant-wide notification only | Yes | Audits `notification.read`. |
| `/notifications/read-all` | POST | Tenant user + CSRF | Own/tenant-wide notifications only | Yes | Audits `notification.read_all`. |
| `/messages*` | GET/POST | Tenant user + CSRF on POST | Message sender/recipient rules | Yes | Donor can view received messages but cannot compose. |
| `/dashboard` | GET | Tenant user | `requireActiveLicense`, `requireNonDonorTenant` | Yes | Donors are redirected to donor dashboard. |
| `/staff*` | GET/POST | Tenant user + CSRF on POST | Non-donor tenant + `staff` module | Yes | Staff records are tenant-scoped. |
| `/branches*` | GET/POST | Tenant user + CSRF on POST | Non-donor tenant + `branches` module | Yes | Branch records are tenant-scoped. |
| `/attendance*` | GET/POST | Tenant user + CSRF on POST | Non-donor tenant + `attendance` module; approval role checks in service | Yes | Attendance records and geofence data are tenant-scoped. |
| `/projects*` | GET/POST | Tenant user + CSRF on POST | Non-donor tenant; `projects` or `finance` module depending route | Yes | Project, assignment, task, indicators, and budgets use tenant filters. |
| `/activity-reports*` | GET/POST | Tenant user + CSRF on POST | `reports` module | Yes | Upload route uses multer limits and tenant storage path. |
| `/finance/categories*` | GET/POST | Tenant user + CSRF on POST | `finance` module + Finance Manager/Tenant Admin | Yes | Category codes unique per tenant. |
| `/expenses*` | GET/POST | Tenant user + CSRF on POST | `finance` module + finance role gates | Yes | Expense attachments use tenant upload path. |
| `/payroll*` | GET/POST | Tenant user + CSRF on POST | `payroll` module + payroll role gates | Yes | Payroll items are generated and viewed through payroll runs. |
| `/my/payroll*` | GET | Tenant user | `payroll` module + self payroll gate | Yes | Staff/Volunteer can see only linked own payroll items. |
| `/reports/center` | GET | Tenant user | `reports` module + report-center role gate | Yes | Donor and Staff/Volunteer are blocked. |
| `/reports/:reportName` | GET | Tenant user | `reports` module + report-specific role gate | Yes | CSV export remains tenant-scoped. |
| `/settings*` | GET/POST | Tenant user + CSRF on POST | Non-donor tenant | Yes | Organization, departments, users, approvals are tenant-scoped. |
| `/audit-logs` | GET | Tenant user | Non-donor tenant | Yes | Shows current tenant records only. |

## Follow-up Notes

- Static files under `public/uploads` are directly served by Express. Filenames are randomized and tenant paths are separated, but direct URL possession can bypass tenant authorization. For high-security deployments, replace direct static upload links with guarded download routes.
