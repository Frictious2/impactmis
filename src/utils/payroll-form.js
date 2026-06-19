function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 10);
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function buildSettingsFormData(source = {}) {
  return {
    currency: source.currency || "NLe",
    pay_frequency: source.pay_frequency || "monthly",
    default_work_days_per_month: source.default_work_days_per_month || 22,
    default_work_hours_per_day: source.default_work_hours_per_day || "8.00",
    overtime_enabled: Boolean(Number(source.overtime_enabled || 0)) || source.overtime_enabled === "on",
    approval_required: source.approval_required === undefined ? true : Boolean(Number(source.approval_required)) || source.approval_required === "on"
  };
}

function buildCompensationFormData(source = {}) {
  return {
    base_salary: source.base_salary || "",
    pay_type: source.pay_type || "monthly",
    currency: source.currency || "NLe",
    effective_from: formatDate(source.effective_from) || today(),
    effective_to: formatDate(source.effective_to),
    status: source.status || "active"
  };
}

function buildTypeFormData(source = {}) {
  return {
    name: source.name || "",
    code: source.code || "",
    description: source.description || "",
    calculation_type: source.calculation_type || "fixed",
    default_amount: source.default_amount || "",
    taxable: Boolean(Number(source.taxable || 0)) || source.taxable === "on",
    status: source.status || "active"
  };
}

function buildStaffAllowanceFormData(source = {}) {
  return {
    allowance_type_id: source.allowance_type_id || "",
    amount: source.amount || "",
    effective_from: formatDate(source.effective_from) || today(),
    effective_to: formatDate(source.effective_to),
    status: source.status || "active"
  };
}

function buildStaffDeductionFormData(source = {}) {
  return {
    deduction_type_id: source.deduction_type_id || "",
    amount: source.amount || "",
    effective_from: formatDate(source.effective_from) || today(),
    effective_to: formatDate(source.effective_to),
    status: source.status || "active"
  };
}

function buildRunFormData(source = {}) {
  const now = new Date();
  return {
    payroll_month: source.payroll_month || now.getMonth() + 1,
    payroll_year: source.payroll_year || now.getFullYear(),
    period_start: formatDate(source.period_start) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    period_end: formatDate(source.period_end) || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  };
}

function getPayFrequencyOptions() {
  return [
    { value: "monthly", label: "Monthly" },
    { value: "biweekly", label: "Biweekly" },
    { value: "weekly", label: "Weekly" }
  ];
}

function getPayTypeOptions() {
  return [
    { value: "monthly", label: "Monthly" },
    { value: "daily", label: "Daily" },
    { value: "hourly", label: "Hourly" },
    { value: "stipend", label: "Stipend" }
  ];
}

function getCalculationTypeOptions() {
  return [
    { value: "fixed", label: "Fixed amount" },
    { value: "percentage", label: "Percentage" }
  ];
}

function getPayrollStatusOptions() {
  return [
    { value: "draft", label: "Draft", badge: "secondary" },
    { value: "submitted", label: "Submitted", badge: "warning" },
    { value: "approved", label: "Approved", badge: "success" },
    { value: "paid", label: "Paid", badge: "primary" },
    { value: "cancelled", label: "Cancelled", badge: "dark" }
  ];
}

function statusBadge(status) {
  return getPayrollStatusOptions().find((option) => option.value === status)?.badge || "secondary";
}

module.exports = {
  today,
  formatDate,
  money,
  buildSettingsFormData,
  buildCompensationFormData,
  buildTypeFormData,
  buildStaffAllowanceFormData,
  buildStaffDeductionFormData,
  buildRunFormData,
  getPayFrequencyOptions,
  getPayTypeOptions,
  getCalculationTypeOptions,
  getPayrollStatusOptions,
  statusBadge
};
