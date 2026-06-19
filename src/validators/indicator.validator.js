const { body } = require("express-validator");
const projectRepo = require("../repos/project.repo");
const activityReportRepo = require("../repos/activity-report.repo");
const { normalizeNullable } = require("../utils/tenant-form");

function prepareIndicatorInput(req, res, next) {
  req.body.indicator_name = (req.body.indicator_name || "").trim();
  req.body.description = normalizeNullable(req.body.description);
  req.body.target_value = req.body.target_value ? String(req.body.target_value).trim() : "";
  req.body.current_value = req.body.current_value ? String(req.body.current_value).trim() : "0";
  req.body.unit = normalizeNullable(req.body.unit);
  req.body.status = (req.body.status || "active").trim();
  next();
}

function prepareIndicatorUpdateInput(req, res, next) {
  req.body.activity_report_id = normalizeNullable(req.body.activity_report_id);
  req.body.update_value = req.body.update_value ? String(req.body.update_value).trim() : "";
  req.body.notes = normalizeNullable(req.body.notes);
  next();
}

const indicatorValidator = [
  body("indicator_name").notEmpty().withMessage("Indicator name is required."),
  body("target_value").isFloat({ gt: 0 }).withMessage("Target value must be positive."),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Indicator status is invalid.")
];

const indicatorUpdateValidator = [
  body("update_value").isFloat({ gt: 0 }).withMessage("Update value must be positive."),
  body("activity_report_id")
    .optional({ values: "falsy" })
    .custom(async (value, { req }) => {
      const report = await activityReportRepo.findReportById(req.currentUser.tenant_id, value);
      if (!report) {
        throw new Error("Selected activity report was not found.");
      }
      return true;
    })
];

module.exports = {
  prepareIndicatorInput,
  prepareIndicatorUpdateInput,
  indicatorValidator,
  indicatorUpdateValidator
};
