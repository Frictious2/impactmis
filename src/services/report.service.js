const reportRepo = require("../repos/report.repo");
const auditLogRepo = require("../repos/audit-log.repo");

const REPORTS = {
  "staff-register": {
    title: "Staff Register",
    group: "HR & Staff Reports",
    roles: ["Tenant Admin", "Auditor", "HR Manager", "Data Entry Officer"],
    query: reportRepo.staffRegister,
    columns: [
      ["staff_code", "Staff Code"],
      ["full_name", "Full Name"],
      ["employment_type", "Employment Type"],
      ["department", "Department"],
      ["branch", "Branch"],
      ["position", "Position"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["status", "Status"],
      ["start_date", "Start Date"]
    ]
  },
  "attendance-summary": {
    title: "Attendance Summary",
    group: "Attendance Reports",
    roles: ["Tenant Admin", "Auditor", "HR Manager", "Data Entry Officer"],
    query: reportRepo.attendanceSummary,
    columns: [
      ["staff_code", "Staff Code"],
      ["full_name", "Full Name"],
      ["department", "Department"],
      ["branch", "Branch"],
      ["present_count", "Present"],
      ["absent_count", "Absent"],
      ["late_count", "Late"],
      ["on_leave_count", "On Leave"],
      ["date_from", "Date From"],
      ["date_to", "Date To"]
    ]
  },
  "geofence-exceptions": {
    title: "Geofence Attendance Exceptions",
    group: "Attendance Reports",
    roles: ["Tenant Admin", "Auditor", "HR Manager", "Data Entry Officer"],
    query: reportRepo.geofenceExceptions,
    columns: [
      ["attendance_date", "Date"],
      ["staff_code", "Staff Code"],
      ["full_name", "Full Name"],
      ["branch", "Branch"],
      ["latitude", "Latitude"],
      ["longitude", "Longitude"],
      ["distance_from_branch_meters", "Distance"],
      ["geofence_status", "Geofence Status"]
    ]
  },
  "project-portfolio": {
    title: "Project Portfolio",
    group: "Project Reports",
    roles: ["Tenant Admin", "Auditor", "Project Manager", "Data Entry Officer"],
    query: reportRepo.projectPortfolio,
    columns: [
      ["project_code", "Project Code"],
      ["project_name", "Project Name"],
      ["branch", "Branch"],
      ["manager", "Manager"],
      ["donor_name", "Donor"],
      ["budget", "Budget"],
      ["status", "Status"],
      ["completion_percentage", "Completion %"],
      ["start_date", "Start Date"],
      ["end_date", "End Date"]
    ]
  },
  "activity-register": {
    title: "Activity Report Register",
    group: "Activity & M&E Reports",
    roles: ["Tenant Admin", "Auditor", "Project Manager", "Data Entry Officer"],
    query: reportRepo.activityRegister,
    columns: [
      ["report_code", "Report Code"],
      ["title", "Title"],
      ["project", "Project"],
      ["branch", "Branch"],
      ["report_type", "Type"],
      ["report_date", "Report Date"],
      ["beneficiaries_reached", "Beneficiaries"],
      ["status", "Status"]
    ]
  },
  "beneficiary-summary": {
    title: "Beneficiary Summary",
    group: "Activity & M&E Reports",
    roles: ["Tenant Admin", "Auditor", "Project Manager", "Data Entry Officer"],
    query: reportRepo.beneficiarySummary,
    columns: [
      ["project", "Project"],
      ["branch", "Branch"],
      ["total_beneficiaries", "Total Beneficiaries"],
      ["male_beneficiaries", "Male"],
      ["female_beneficiaries", "Female"],
      ["youth_beneficiaries", "Youth"]
    ]
  },
  "indicator-progress": {
    title: "Indicator Progress Report",
    group: "Activity & M&E Reports",
    roles: ["Tenant Admin", "Auditor", "Project Manager", "Data Entry Officer"],
    query: reportRepo.indicatorProgress,
    columns: [
      ["project", "Project"],
      ["indicator_name", "Indicator"],
      ["target_value", "Target"],
      ["current_value", "Current"],
      ["unit", "Unit"],
      ["progress_percentage", "Progress %"],
      ["status", "Status"]
    ]
  },
  "payroll-summary": {
    title: "Payroll Summary",
    group: "Payroll Reports",
    roles: ["Tenant Admin", "Auditor", "Finance Manager"],
    query: reportRepo.payrollSummary,
    columns: [
      ["payroll_month", "Month"],
      ["payroll_year", "Year"],
      ["status", "Status"],
      ["total_gross", "Gross"],
      ["total_deductions", "Deductions"],
      ["total_net", "Net"]
    ]
  },
  "expense-register": {
    title: "Expense Register",
    group: "Finance Reports",
    roles: ["Tenant Admin", "Auditor", "Finance Manager"],
    query: reportRepo.expenseRegister,
    columns: [
      ["expense_code", "Expense Code"],
      ["expense_date", "Date"],
      ["project", "Project"],
      ["branch", "Branch"],
      ["category", "Category"],
      ["description", "Description"],
      ["amount", "Amount"],
      ["payment_method", "Payment Method"],
      ["status", "Status"]
    ]
  },
  "budget-utilization": {
    title: "Project Budget Utilization",
    group: "Finance Reports",
    roles: ["Tenant Admin", "Auditor", "Finance Manager"],
    query: reportRepo.budgetUtilization,
    columns: [
      ["project", "Project"],
      ["category", "Category"],
      ["budget_amount", "Budget Amount"],
      ["spent_amount", "Spent Amount"],
      ["remaining_amount", "Remaining"],
      ["utilization_percentage", "Utilization %"]
    ]
  }
};

const CENTER_GROUPS = [
  {
    title: "HR & Staff Reports",
    reports: ["Staff Register", "Staff by Department", "Staff by Branch", "Staff Status Report"],
    implemented: ["staff-register"]
  },
  {
    title: "Attendance Reports",
    reports: ["Attendance Summary", "Daily Attendance Register", "Geofence Attendance Exceptions"],
    implemented: ["attendance-summary", "geofence-exceptions"]
  },
  {
    title: "Project Reports",
    reports: ["Project Portfolio", "Project Staff Assignment Report", "Project Task Status Report"],
    implemented: ["project-portfolio"]
  },
  {
    title: "Activity & M&E Reports",
    reports: ["Activity Report Register", "Beneficiary Summary", "Indicator Progress Report"],
    implemented: ["activity-register", "beneficiary-summary", "indicator-progress"]
  },
  {
    title: "Payroll Reports",
    reports: ["Payroll Summary", "Payroll Detail", "Paid/Unpaid Payroll Items"],
    implemented: ["payroll-summary"]
  },
  {
    title: "Finance Reports",
    reports: ["Expense Register", "Expense Approval Report", "Project Budget Utilization"],
    implemented: ["expense-register", "budget-utilization"]
  },
  {
    title: "Donor Accountability Reports",
    reports: ["Approved Activity Reports", "Beneficiary Report", "Project Indicator Report"],
    implemented: []
  }
];

function columnsFor(report) {
  return report.columns.map(([key, label]) => ({ key, label }));
}

function canAccessReport(user, reportName) {
  const report = REPORTS[reportName];
  if (!user || !report || ["Donor", "Staff", "Volunteer"].includes(user.role)) {
    return false;
  }
  return report.roles.includes(user.role);
}

function listCenterGroupsForUser(user) {
  return CENTER_GROUPS.map((group) => ({
    ...group,
    implemented: group.implemented.filter((name) => canAccessReport(user, name))
  }));
}

async function runReport(tenantId, reportName, filters, user, ipAddress, exportMode = false) {
  const report = REPORTS[reportName];
  if (!canAccessReport(user, reportName)) {
    const error = new Error("You do not have permission to access this report.");
    error.statusCode = 403;
    throw error;
  }
  const rows = await report.query(tenantId, filters);
  await auditLogRepo.create({
    tenant_id: tenantId,
    user_id: user.id,
    action: exportMode ? "report.exported" : "report.viewed",
    entity_type: "report",
    entity_id: reportName,
    metadata_json: { report_name: reportName, filters_used: filters },
    ip_address: ipAddress
  });
  return { report, columns: columnsFor(report), rows };
}

module.exports = {
  REPORTS,
  canAccessReport,
  listCenterGroupsForUser,
  runReport
};
