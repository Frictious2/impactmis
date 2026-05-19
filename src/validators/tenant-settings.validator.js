const { body } = require("express-validator");
const roleRepo = require("../repos/role.repo");
const departmentRepo = require("../repos/department.repo");
const userRepo = require("../repos/user.repo");
const { normalizeEmail, normalizeNullable } = require("../utils/tenant-form");

function prepareOrganizationInput(req, res, next) {
  req.body.organization_name = (req.body.organization_name || "").trim();
  req.body.country = (req.body.country || "Sierra Leone").trim();
  req.body.email = normalizeEmail(req.body.email);
  req.body.logo = normalizeNullable(req.body.logo);
  req.body.address = normalizeNullable(req.body.address);
  req.body.city = normalizeNullable(req.body.city);
  req.body.district = normalizeNullable(req.body.district);
  req.body.registration_number = normalizeNullable(req.body.registration_number);
  req.body.website = normalizeNullable(req.body.website);
  req.body.phone = normalizeNullable(req.body.phone);
  req.body.mission_statement = normalizeNullable(req.body.mission_statement);
  req.body.organization_type = normalizeNullable(req.body.organization_type);
  next();
}

function prepareDepartmentInput(req, res, next) {
  req.body.department_name = (req.body.department_name || "").trim();
  req.body.description = normalizeNullable(req.body.description);
  req.body.status = (req.body.status || "active").trim();
  next();
}

function prepareTenantUserInput(req, res, next) {
  req.body.full_name = (req.body.full_name || "").trim();
  req.body.email = normalizeEmail(req.body.email);
  req.body.role = (req.body.role || "").trim();
  req.body.department_id = req.body.department_id ? String(req.body.department_id).trim() : "";
  req.body.status = (req.body.status || "active").trim();
  next();
}

function prepareApprovalWorkflowInput(req, res, next) {
  const fields = [
    "attendance_approvals",
    "payroll_approvals",
    "expense_approvals",
    "project_report_approvals",
    "staff_approvals"
  ];

  fields.forEach((field) => {
    req.body[field] = String(req.body[field] || "").trim();
  });

  next();
}

const organizationProfileValidator = [
  body("organization_name").notEmpty().withMessage("Organization name is required."),
  body("email").optional({ values: "falsy" }).isEmail().withMessage("Email must be valid."),
  body("website")
    .optional({ values: "falsy" })
    .isLength({ max: 255 })
    .withMessage("Website must be 255 characters or fewer."),
  body("fiscal_year_start_month")
    .isInt({ min: 1, max: 12 })
    .withMessage("Fiscal year start month must be between 1 and 12.")
];

const departmentValidator = [
  body("department_name")
    .notEmpty()
    .withMessage("Department name is required.")
    .bail()
    .custom(async (value, { req }) => {
      const exists = await departmentRepo.existsByNameForTenant(
        value,
        req.currentUser.tenant_id,
        req.params.id || null
      );

      if (exists) {
        throw new Error("A department with this name already exists.");
      }

      return true;
    }),
  body("status").isIn(["active", "inactive"]).withMessage("Status must be active or inactive.")
];

const tenantUserValidator = [
  body("full_name").notEmpty().withMessage("Full name is required."),
  body("email")
    .isEmail()
    .withMessage("Email must be valid.")
    .bail()
    .custom(async (value, { req }) => {
      const exists = await userRepo.existsByEmailForTenant(value, req.currentUser.tenant_id);

      if (exists) {
        throw new Error("A user with this email already exists for this tenant.");
      }

      return true;
    }),
  body("role")
    .notEmpty()
    .withMessage("Role is required.")
    .bail()
    .custom(async (value) => {
      const isValid = await roleRepo.isTenantAssignableRole(value);
      if (!isValid) {
        throw new Error("Selected role is not available for tenant users.");
      }

      return true;
    }),
  body("department_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const department = await departmentRepo.findByIdForTenant(value, req.currentUser.tenant_id);
      if (!department) {
        throw new Error("Selected department was not found.");
      }

      return true;
    }),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long."),
  body("status").isIn(["active", "disabled"]).withMessage("Status must be active or disabled.")
];

const approvalWorkflowValidator = [
  body("attendance_approvals")
    .isInt({ min: 0, max: 10 })
    .withMessage("Attendance approvals must be between 0 and 10."),
  body("payroll_approvals")
    .isInt({ min: 0, max: 10 })
    .withMessage("Payroll approvals must be between 0 and 10."),
  body("expense_approvals")
    .isInt({ min: 0, max: 10 })
    .withMessage("Expense approvals must be between 0 and 10."),
  body("project_report_approvals")
    .isInt({ min: 0, max: 10 })
    .withMessage("Project report approvals must be between 0 and 10."),
  body("staff_approvals")
    .isInt({ min: 0, max: 10 })
    .withMessage("Staff approvals must be between 0 and 10.")
];

module.exports = {
  prepareOrganizationInput,
  prepareDepartmentInput,
  prepareTenantUserInput,
  prepareApprovalWorkflowInput,
  organizationProfileValidator,
  departmentValidator,
  tenantUserValidator,
  approvalWorkflowValidator
};
