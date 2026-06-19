const { body } = require("express-validator");
const branchRepo = require("../repos/branch.repo");
const userRepo = require("../repos/user.repo");
const staffRepo = require("../repos/staff.repo");
const projectRepo = require("../repos/project.repo");
const { normalizeNullable } = require("../utils/tenant-form");

function prepareProjectInput(req, res, next) {
  req.body.project_code = req.body.project_code ? String(req.body.project_code).trim().toUpperCase() : "";
  req.body.project_name = (req.body.project_name || "").trim();
  req.body.project_description = (req.body.project_description || "").trim();
  req.body.branch_id = normalizeNullable(req.body.branch_id);
  req.body.project_manager_id = normalizeNullable(req.body.project_manager_id);
  req.body.donor_name = normalizeNullable(req.body.donor_name);
  req.body.budget = normalizeNullable(req.body.budget);
  req.body.start_date = (req.body.start_date || "").trim();
  req.body.end_date = normalizeNullable(req.body.end_date);
  req.body.status = (req.body.status || "planning").trim();
  req.body.completion_percentage = req.body.completion_percentage ? String(req.body.completion_percentage).trim() : "0";
  next();
}

function prepareAssignmentInput(req, res, next) {
  req.body.staff_member_id = req.body.staff_member_id ? String(req.body.staff_member_id).trim() : "";
  req.body.assignment_role = (req.body.assignment_role || "").trim();
  req.body.assigned_date = (req.body.assigned_date || "").trim();
  req.body.assignment_id = req.body.assignment_id ? String(req.body.assignment_id).trim() : "";
  next();
}

function prepareTaskInput(req, res, next) {
  req.body.assigned_staff_id = normalizeNullable(req.body.assigned_staff_id);
  req.body.title = (req.body.title || "").trim();
  req.body.description = normalizeNullable(req.body.description);
  req.body.due_date = normalizeNullable(req.body.due_date);
  req.body.priority = (req.body.priority || "medium").trim();
  req.body.status = (req.body.status || "pending").trim();
  req.body.completion_percentage = req.body.completion_percentage ? String(req.body.completion_percentage).trim() : "0";
  req.body.task_id = req.body.task_id ? String(req.body.task_id).trim() : "";
  next();
}

function prepareTaskStatusInput(req, res, next) {
  req.body.status = (req.body.status || "").trim();
  next();
}

const projectValidator = [
  body("project_name").notEmpty().withMessage("Project name is required."),
  body("start_date").isISO8601().withMessage("Start date is required."),
  body("end_date")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("End date must be a valid date."),
  body("budget")
    .optional({ values: "falsy" })
    .isFloat({ gt: 0 })
    .withMessage("Budget must be a positive amount."),
  body("branch_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const branch = await branchRepo.findByIdForTenant(value, req.currentUser.tenant_id);
      if (!branch) {
        throw new Error("Selected branch was not found.");
      }
      return true;
    }),
  body("project_manager_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const manager = await userRepo.findByIdForTenant(value, req.currentUser.tenant_id);
      if (!manager) {
        throw new Error("Selected project manager was not found.");
      }
      return true;
    }),
  body("project_code")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const exists = await projectRepo.existsProjectCode(
        req.currentUser.tenant_id,
        value,
        req.params.id || null
      );
      if (exists) {
        throw new Error("This project code is already in use.");
      }
      return true;
    }),
  body("status")
    .isIn(["planning", "active", "on_hold", "completed", "cancelled"])
    .withMessage("Project status is invalid."),
  body("completion_percentage")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Completion percentage must be between 0 and 100.")
];

const assignmentValidator = [
  body("staff_member_id")
    .notEmpty()
    .withMessage("Assigned staff member is required.")
    .bail()
    .custom(async (value, { req }) => {
      const staffMember = await staffRepo.findStaffById(req.currentUser.tenant_id, value);
      if (!staffMember) {
        throw new Error("Selected staff member was not found.");
      }
      return true;
    }),
  body("assignment_role").notEmpty().withMessage("Assignment role is required."),
  body("assigned_date").isISO8601().withMessage("Assigned date is required.")
];

const taskValidator = [
  body("title").notEmpty().withMessage("Task title is required."),
  body("assigned_staff_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const staffMember = await staffRepo.findStaffById(req.currentUser.tenant_id, value);
      if (!staffMember) {
        throw new Error("Selected staff member was not found.");
      }
      return true;
    }),
  body("priority")
    .isIn(["low", "medium", "high"])
    .withMessage("Task priority is invalid."),
  body("status")
    .isIn(["pending", "in_progress", "completed"])
    .withMessage("Task status is invalid."),
  body("due_date")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("Due date must be valid."),
  body("completion_percentage")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Completion percentage must be between 0 and 100.")
];

const taskStatusValidator = [
  body("status")
    .isIn(["pending", "in_progress", "completed"])
    .withMessage("Task status is invalid.")
];

module.exports = {
  prepareProjectInput,
  prepareAssignmentInput,
  prepareTaskInput,
  prepareTaskStatusInput,
  projectValidator,
  assignmentValidator,
  taskValidator,
  taskStatusValidator
};
