function buildStaffFormData(input = {}) {
  return {
    staff_code: input.staff_code || "",
    user_id: input.user_id || "",
    first_name: input.first_name || "",
    middle_name: input.middle_name || "",
    last_name: input.last_name || "",
    gender: input.gender || "",
    date_of_birth: input.date_of_birth
      ? String(input.date_of_birth).slice(0, 10)
      : "",
    phone: input.phone || "",
    email: input.email || "",
    address: input.address || "",
    department_id: input.department_id || "",
    branch_id: input.branch_id || "",
    position_title: input.position_title || "",
    employment_type: input.employment_type || "staff",
    start_date: input.start_date ? String(input.start_date).slice(0, 10) : "",
    end_date: input.end_date ? String(input.end_date).slice(0, 10) : "",
    status: input.status || "active",
    emergency_contact_name: input.emergency_contact_name || "",
    emergency_contact_phone: input.emergency_contact_phone || "",
    notes: input.notes || ""
  };
}

function getEmploymentTypeOptions() {
  return [
    { value: "staff", label: "Staff" },
    { value: "volunteer", label: "Volunteer" },
    { value: "consultant", label: "Consultant" },
    { value: "intern", label: "Intern" }
  ];
}

function getStatusOptions() {
  return [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "exited", label: "Exited" },
    { value: "suspended", label: "Suspended" }
  ];
}

module.exports = {
  buildStaffFormData,
  getEmploymentTypeOptions,
  getStatusOptions
};
