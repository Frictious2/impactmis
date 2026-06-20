const accountTypes = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" }
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" }
];

const journalStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" }
];

const transactionTypes = [
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "transfer", label: "Transfer" }
];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function statusBadge(status) {
  const colors = {
    active: "success",
    inactive: "secondary",
    draft: "secondary",
    posted: "success",
    cancelled: "danger",
    deposit: "success",
    withdrawal: "warning",
    transfer: "info"
  };
  return colors[status] || "secondary";
}

function accountTypeLabel(type) {
  return accountTypes.find((option) => option.value === type)?.label || type;
}

module.exports = {
  accountTypes,
  statusOptions,
  journalStatusOptions,
  transactionTypes,
  money,
  formatDate,
  statusBadge,
  accountTypeLabel
};
