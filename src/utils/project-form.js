function buildProjectFilters(query = {}) {
  return {
    status: query.status || "",
    branch_id: query.branch_id || "",
    project_manager_id: query.project_manager_id || ""
  };
}

function buildProjectFormData(input = {}) {
  return {
    project_code: input.project_code || "",
    project_name: input.project_name || "",
    project_description: input.project_description || "",
    branch_id: input.branch_id || "",
    project_manager_id: input.project_manager_id || "",
    donor_name: input.donor_name || "",
    budget: input.budget || "",
    start_date: input.start_date ? String(input.start_date).slice(0, 10) : "",
    end_date: input.end_date ? String(input.end_date).slice(0, 10) : "",
    status: input.status || "planning",
    completion_percentage:
      input.completion_percentage === 0 || input.completion_percentage
        ? String(input.completion_percentage)
        : "0"
  };
}

function buildProjectAssignmentFormData(input = {}) {
  return {
    staff_member_id: input.staff_member_id || "",
    assignment_role: input.assignment_role || "",
    assigned_date: input.assigned_date ? String(input.assigned_date).slice(0, 10) : new Date().toISOString().slice(0, 10)
  };
}

function buildProjectTaskFormData(input = {}) {
  return {
    assigned_staff_id: input.assigned_staff_id || "",
    title: input.title || "",
    description: input.description || "",
    due_date: input.due_date ? String(input.due_date).slice(0, 10) : "",
    priority: input.priority || "medium",
    status: input.status || "pending",
    completion_percentage:
      input.completion_percentage === 0 || input.completion_percentage
        ? String(input.completion_percentage)
        : "0"
  };
}

function getProjectStatusOptions() {
  return [
    { value: "planning", label: "Planning" },
    { value: "active", label: "Active" },
    { value: "on_hold", label: "On Hold" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" }
  ];
}

function getAssignmentStatusOptions() {
  return [
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "removed", label: "Removed" }
  ];
}

function getTaskPriorityOptions() {
  return [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" }
  ];
}

function getTaskStatusOptions() {
  return [
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }
  ];
}

module.exports = {
  buildProjectFilters,
  buildProjectFormData,
  buildProjectAssignmentFormData,
  buildProjectTaskFormData,
  getProjectStatusOptions,
  getAssignmentStatusOptions,
  getTaskPriorityOptions,
  getTaskStatusOptions
};
