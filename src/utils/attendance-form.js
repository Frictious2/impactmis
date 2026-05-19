function buildAttendanceFormData(input = {}) {
  return {
    staff_member_id: input.staff_member_id || "",
    attendance_date: input.attendance_date ? String(input.attendance_date).slice(0, 10) : "",
    status: input.status || "present",
    check_in_time: input.check_in_time ? String(input.check_in_time).slice(0, 5) : "",
    check_out_time: input.check_out_time ? String(input.check_out_time).slice(0, 5) : "",
    location: input.location || "",
    notes: input.notes || "",
    approval_status: input.approval_status || "submitted",
    rejection_reason: input.rejection_reason || ""
  };
}

function buildAttendanceFilters(query = {}) {
  return {
    date_from: query.date_from || "",
    date_to: query.date_to || "",
    staff_member_id: query.staff_member_id || "",
    department_id: query.department_id || "",
    status: query.status || "",
    approval_status: query.approval_status || ""
  };
}

function getAttendanceStatusOptions() {
  return [
    { value: "present", label: "Present" },
    { value: "absent", label: "Absent" },
    { value: "late", label: "Late" },
    { value: "excused", label: "Excused" },
    { value: "sick", label: "Sick" },
    { value: "on_leave", label: "On Leave" }
  ];
}

function getAttendanceApprovalOptions() {
  return [
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" }
  ];
}

module.exports = {
  buildAttendanceFormData,
  buildAttendanceFilters,
  getAttendanceStatusOptions,
  getAttendanceApprovalOptions
};
