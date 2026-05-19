const { body } = require("express-validator");
const departmentRepo = require("../repos/department.repo");
const staffRepo = require("../repos/staff.repo");
const { normalizeEmail, normalizeNullable } = require("../utils/tenant-form");

function prepareStaffInput(req, res, next) {
  req.body.staff_code = normalizeNullable(req.body.staff_code);
  req.body.first_name = (req.body.first_name || "").trim();
  req.body.middle_name = normalizeNullable(req.body.middle_name);
  req.body.last_name = (req.body.last_name || "").trim();
  req.body.gender = normalizeNullable(req.body.gender);
  req.body.date_of_birth = normalizeNullable(req.body.date_of_birth);
  req.body.phone = normalizeNullable(req.body.phone);
  req.body.email = normalizeEmail(req.body.email);
  req.body.address = normalizeNullable(req.body.address);
  req.body.department_id = normalizeNullable(req.body.department_id);
  req.body.position_title = (req.body.position_title || "").trim();
  req.body.start_date = (req.body.start_date || "").trim();
  req.body.end_date = normalizeNullable(req.body.end_date);
  req.body.emergency_contact_name = normalizeNullable(req.body.emergency_contact_name);
  req.body.emergency_contact_phone = normalizeNullable(req.body.emergency_contact_phone);
  req.body.notes = normalizeNullable(req.body.notes);
  req.body.status = (req.body.status || "active").trim();
  req.body.employment_type = (req.body.employment_type || "").trim();
  next();
}

const staffValidator = [
  body("first_name").notEmpty().withMessage("First name is required."),
  body("last_name").notEmpty().withMessage("Last name is required."),
  body("employment_type")
    .isIn(["staff", "volunteer", "consultant", "intern"])
    .withMessage("Employment type must be staff, volunteer, consultant, or intern."),
  body("position_title").notEmpty().withMessage("Position title is required."),
  body("start_date").isISO8601().withMessage("Start date is required."),
  body("status")
    .isIn(["active", "inactive", "exited", "suspended"])
    .withMessage("Status must be active, inactive, exited, or suspended."),
  body("department_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const department = await departmentRepo.findByIdForTenant(value, req.currentUser.tenant_id);
      if (!department) {
        throw new Error("Selected department was not found.");
      }
      return true;
    }),
  body("email")
    .optional({ values: "falsy" })
    .isEmail()
    .withMessage("Email must be valid.")
    .bail()
    .custom(async (value, { req }) => {
      const exists = await staffRepo.existsEmailForTenant(
        req.currentUser.tenant_id,
        value,
        req.params.id || null
      );
      if (exists) {
        throw new Error("A staff member with this email already exists.");
      }
      return true;
    }),
  body("staff_code")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const exists = await staffRepo.existsStaffCodeForTenant(
        req.currentUser.tenant_id,
        value,
        req.params.id || null
      );
      if (exists) {
        throw new Error("This staff code is already in use.");
      }
      return true;
    }),
  body("end_date")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("End date must be a valid date."),
  body("status_change")
    .optional(),
  body("next_status")
    .optional()
    .isIn(["active", "inactive", "exited", "suspended"])
    .withMessage("Selected status is invalid."),
  body("status_end_date")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("Status end date must be valid.")
];

module.exports = {
  prepareStaffInput,
  staffValidator
};
