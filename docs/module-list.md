# ImpactMIS Module List

Expected license module keys:

- `staff`: staff and volunteer records.
- `branches`: branch management and branch assignment.
- `attendance`: attendance, bulk attendance, self check-in, geofence status.
- `projects`: projects, tasks, assignments, LogFrames, indicators, indicator measurements.
- `reports`: activity reports, surveys, reporting center, M&E reports.
- `donors`: donor read-only portal.
- `payroll`: payroll settings, compensation, allowances, deductions, payroll runs, payslips.
- `finance`: finance categories, expenses, budgets, accounting, GL, bank accounts, statements.
- `approvals`: approval placeholder and approval-related tenant navigation.

License modules are stored in `licenses.modules_json`. Missing keys should be normalized to `false` using:

```bash
npm run audit:license-modules:fix
```

Do not introduce alternate keys such as `expenses`, `finance_expenses`, or `accounting`; finance and accounting are controlled by `finance`.
