function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildExpenseFilters(query = {}) {
  return {
    search: query.search || "",
    project_id: query.project_id || "",
    category_id: query.category_id || "",
    branch_id: query.branch_id || "",
    status: query.status || "",
    payment_method: query.payment_method || "",
    date_from: query.date_from || "",
    date_to: query.date_to || ""
  };
}

function buildExpenseFormData(input = {}) {
  return {
    expense_date: formatDate(input.expense_date) || today(),
    project_id: input.project_id || "",
    branch_id: input.branch_id || "",
    category_id: input.category_id || "",
    vendor_name: input.vendor_name || "",
    description: input.description || "",
    amount: input.amount || "",
    payment_method: input.payment_method || "cash",
    receipt_number: input.receipt_number || "",
    status: input.status || "submitted"
  };
}

function getExpenseStatusOptions() {
  return ["draft", "submitted", "approved", "rejected", "paid", "cancelled"];
}

function getPaymentMethodOptions() {
  return [
    { value: "cash", label: "Cash" },
    { value: "mobile_money", label: "Mobile Money" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "cheque", label: "Cheque" },
    { value: "other", label: "Other" }
  ];
}

function statusBadge(status) {
  return {
    draft: "secondary",
    submitted: "warning",
    approved: "success",
    rejected: "danger",
    paid: "primary",
    cancelled: "dark"
  }[status] || "secondary";
}

module.exports = {
  today,
  formatDate,
  money,
  buildExpenseFilters,
  buildExpenseFormData,
  getExpenseStatusOptions,
  getPaymentMethodOptions,
  statusBadge
};
