function buildIndicatorFormData(input = {}) {
  return {
    indicator_name: input.indicator_name || "",
    description: input.description || "",
    target_value: input.target_value || "",
    current_value:
      input.current_value === 0 || input.current_value ? String(input.current_value) : "0",
    unit: input.unit || "",
    status: input.status || "active"
  };
}

function buildIndicatorUpdateFormData(input = {}) {
  return {
    activity_report_id: input.activity_report_id || "",
    update_value: input.update_value || "",
    notes: input.notes || ""
  };
}

function getIndicatorStatusOptions() {
  return [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" }
  ];
}

module.exports = {
  buildIndicatorFormData,
  buildIndicatorUpdateFormData,
  getIndicatorStatusOptions
};
