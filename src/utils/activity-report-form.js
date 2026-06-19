function buildActivityReportFilters(query = {}) {
  return {
    project_id: query.project_id || "",
    branch_id: query.branch_id || "",
    staff_member_id: query.staff_member_id || "",
    report_type: query.report_type || "",
    status: query.status || "",
    date_from: query.date_from || "",
    date_to: query.date_to || ""
  };
}

function buildActivityReportFormData(input = {}) {
  return {
    report_code: input.report_code || "",
    project_id: input.project_id || "",
    task_id: input.task_id || "",
    staff_member_id: input.staff_member_id || "",
    branch_id: input.branch_id || "",
    report_date: input.report_date ? String(input.report_date).slice(0, 10) : "",
    report_type: input.report_type || "daily",
    title: input.title || "",
    summary: input.summary || "",
    activities_completed: input.activities_completed || "",
    challenges: input.challenges || "",
    recommendations: input.recommendations || "",
    beneficiaries_reached:
      input.beneficiaries_reached === 0 || input.beneficiaries_reached
        ? String(input.beneficiaries_reached)
        : "0",
    male_beneficiaries:
      input.male_beneficiaries === 0 || input.male_beneficiaries
        ? String(input.male_beneficiaries)
        : "0",
    female_beneficiaries:
      input.female_beneficiaries === 0 || input.female_beneficiaries
        ? String(input.female_beneficiaries)
        : "0",
    youth_beneficiaries:
      input.youth_beneficiaries === 0 || input.youth_beneficiaries
        ? String(input.youth_beneficiaries)
        : "0",
    status: input.status || "submitted",
    rejection_reason: input.rejection_reason || ""
  };
}

function getActivityReportTypeOptions() {
  return [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "incident", label: "Incident" },
    { value: "field_visit", label: "Field Visit" },
    { value: "training", label: "Training" },
    { value: "community_engagement", label: "Community Engagement" }
  ];
}

function getActivityReportStatusOptions() {
  return [
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" }
  ];
}

module.exports = {
  buildActivityReportFilters,
  buildActivityReportFormData,
  getActivityReportTypeOptions,
  getActivityReportStatusOptions
};
