function buildOrganizationProfileFormData(profile = {}) {
  return {
    organization_name: profile.organization_name || "",
    logo: profile.logo || "",
    address: profile.address || "",
    city: profile.city || "",
    district: profile.district || "",
    country: profile.country || "Sierra Leone",
    registration_number: profile.registration_number || "",
    website: profile.website || "",
    email: profile.email || "",
    phone: profile.phone || "",
    mission_statement: profile.mission_statement || "",
    organization_type: profile.organization_type || "",
    fiscal_year_start_month: String(profile.fiscal_year_start_month || 1)
  };
}

function buildDepartmentFormData(input = {}) {
  return {
    department_name: input.department_name || "",
    description: input.description || "",
    status: input.status || "active"
  };
}

function buildTenantUserFormData(input = {}) {
  return {
    full_name: input.full_name || "",
    email: input.email || "",
    role: input.role || "",
    department_id: input.department_id || "",
    password: input.password || "",
    status: input.status || "active"
  };
}

function buildApprovalWorkflowFormData(input = {}) {
  return {
    attendance_approvals: input.attendance_approvals ?? 1,
    payroll_approvals: input.payroll_approvals ?? 1,
    expense_approvals: input.expense_approvals ?? 1,
    project_report_approvals: input.project_report_approvals ?? 1,
    staff_approvals: input.staff_approvals ?? 1
  };
}

function getMonthOptions() {
  return [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" }
  ];
}

module.exports = {
  buildOrganizationProfileFormData,
  buildDepartmentFormData,
  buildTenantUserFormData,
  buildApprovalWorkflowFormData,
  getMonthOptions
};
