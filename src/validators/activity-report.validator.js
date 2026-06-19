const { body } = require("express-validator");
const projectRepo = require("../repos/project.repo");
const branchRepo = require("../repos/branch.repo");
const staffRepo = require("../repos/staff.repo");
const { normalizeNullable } = require("../utils/tenant-form");

function prepareActivityReportInput(req, res, next) {
  req.body.report_code = normalizeNullable(req.body.report_code);
  req.body.project_id = req.body.project_id ? String(req.body.project_id).trim() : "";
  req.body.task_id = normalizeNullable(req.body.task_id);
  req.body.staff_member_id = normalizeNullable(req.body.staff_member_id);
  req.body.branch_id = normalizeNullable(req.body.branch_id);
  req.body.report_date = (req.body.report_date || "").trim();
  req.body.report_type = (req.body.report_type || "").trim();
  req.body.title = (req.body.title || "").trim();
  req.body.summary = (req.body.summary || "").trim();
  req.body.activities_completed = normalizeNullable(req.body.activities_completed);
  req.body.challenges = normalizeNullable(req.body.challenges);
  req.body.recommendations = normalizeNullable(req.body.recommendations);
  req.body.beneficiaries_reached = req.body.beneficiaries_reached ? String(req.body.beneficiaries_reached).trim() : "0";
  req.body.male_beneficiaries = req.body.male_beneficiaries ? String(req.body.male_beneficiaries).trim() : "0";
  req.body.female_beneficiaries = req.body.female_beneficiaries ? String(req.body.female_beneficiaries).trim() : "0";
  req.body.youth_beneficiaries = req.body.youth_beneficiaries ? String(req.body.youth_beneficiaries).trim() : "0";
  req.body.status = (req.body.status || "submitted").trim();
  req.body.rejection_reason = normalizeNullable(req.body.rejection_reason);
  next();
}

function prepareRejectActivityReportInput(req, res, next) {
  req.body.rejection_reason = req.body.rejection_reason ? String(req.body.rejection_reason).trim() : "";
  next();
}

const activityReportValidator = [
  body("project_id")
    .notEmpty()
    .withMessage("Project is required.")
    .bail()
    .custom(async (value, { req }) => {
      const project = await projectRepo.findProject(req.currentUser.tenant_id, value);
      if (!project) {
        throw new Error("Selected project was not found.");
      }
      return true;
    }),
  body("report_date").isISO8601().withMessage("Report date is required."),
  body("report_type")
    .isIn(["daily", "weekly", "monthly", "incident", "field_visit", "training", "community_engagement"])
    .withMessage("Report type is invalid."),
  body("title").notEmpty().withMessage("Title is required."),
  body("summary").notEmpty().withMessage("Summary is required."),
  body("task_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const task = await projectRepo.findTask(req.currentUser.tenant_id, value);
      if (!task || String(task.project_id) !== String(req.body.project_id)) {
        throw new Error("Selected task was not found for this project.");
      }
      return true;
    }),
  body("staff_member_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const staffMember = await staffRepo.findStaffById(req.currentUser.tenant_id, value);
      if (!staffMember) {
        throw new Error("Selected staff member was not found.");
      }
      return true;
    }),
  body("branch_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const branch = await branchRepo.findByIdForTenant(value, req.currentUser.tenant_id);
      if (!branch) {
        throw new Error("Selected branch was not found.");
      }
      return true;
    }),
  body("beneficiaries_reached").isInt({ min: 0 }).withMessage("Total beneficiaries must be non-negative."),
  body("male_beneficiaries").isInt({ min: 0 }).withMessage("Male beneficiaries must be non-negative."),
  body("female_beneficiaries").isInt({ min: 0 }).withMessage("Female beneficiaries must be non-negative."),
  body("youth_beneficiaries").isInt({ min: 0 }).withMessage("Youth beneficiaries must be non-negative."),
  body("female_beneficiaries").custom((value, { req }) => {
    const total = Number(req.body.beneficiaries_reached || 0);
    const male = Number(req.body.male_beneficiaries || 0);
    const female = Number(value || 0);
    if (male + female > total) {
      throw new Error("Male and female beneficiaries cannot exceed total beneficiaries reached.");
    }
    return true;
  }),
  body("status")
    .optional()
    .isIn(["draft", "submitted", "approved", "rejected"])
    .withMessage("Report status is invalid.")
];

const rejectActivityReportValidator = [
  body("rejection_reason").notEmpty().withMessage("Rejection reason is required.")
];

module.exports = {
  prepareActivityReportInput,
  prepareRejectActivityReportInput,
  activityReportValidator,
  rejectActivityReportValidator
};
