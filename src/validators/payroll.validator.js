const { body } = require("express-validator");

const payFrequencies = ["monthly", "biweekly", "weekly"];
const payTypes = ["monthly", "daily", "hourly", "stipend"];
const calculationTypes = ["fixed", "percentage"];
const statuses = ["active", "inactive"];

function preparePayrollSettingsInput(req, _res, next) {
  req.body.overtime_enabled = req.body.overtime_enabled === "on";
  req.body.approval_required = req.body.approval_required === "on";
  next();
}

function prepareCodeInput(req, _res, next) {
  if (req.body.code) {
    req.body.code = String(req.body.code).trim().toUpperCase().replace(/\s+/g, "_");
  }
  next();
}

const payrollSettingsValidator = [
  body("currency").trim().notEmpty().withMessage("Currency is required."),
  body("pay_frequency").isIn(payFrequencies).withMessage("Pay frequency is invalid."),
  body("default_work_days_per_month")
    .isInt({ min: 1 })
    .withMessage("Default work days per month must be positive."),
  body("default_work_hours_per_day")
    .isFloat({ min: 0 })
    .withMessage("Default work hours per day must be non-negative.")
];

const compensationValidator = [
  body("base_salary").isFloat({ min: 0 }).withMessage("Base salary must be non-negative."),
  body("pay_type").isIn(payTypes).withMessage("Pay type is invalid."),
  body("currency").trim().notEmpty().withMessage("Currency is required."),
  body("effective_from").isISO8601().withMessage("Effective from date is required."),
  body("effective_to").optional({ checkFalsy: true }).isISO8601().withMessage("Effective to date is invalid."),
  body("status").isIn(statuses).withMessage("Status is invalid.")
];

const allowanceTypeValidator = [
  body("name").trim().notEmpty().withMessage("Name is required."),
  body("code").trim().notEmpty().withMessage("Code is required."),
  body("calculation_type").isIn(calculationTypes).withMessage("Calculation type is invalid."),
  body("default_amount").isFloat({ min: 0 }).withMessage("Default amount must be non-negative."),
  body("status").isIn(statuses).withMessage("Status is invalid.")
];

const deductionTypeValidator = allowanceTypeValidator;

const staffAllowanceValidator = [
  body("allowance_type_id").isInt({ min: 1 }).withMessage("Allowance type is required."),
  body("amount").isFloat({ min: 0 }).withMessage("Allowance amount must be non-negative."),
  body("effective_from").isISO8601().withMessage("Effective from date is required."),
  body("effective_to").optional({ checkFalsy: true }).isISO8601().withMessage("Effective to date is invalid."),
  body("status").isIn(statuses).withMessage("Status is invalid.")
];

const staffDeductionValidator = [
  body("deduction_type_id").isInt({ min: 1 }).withMessage("Deduction type is required."),
  body("amount").isFloat({ min: 0 }).withMessage("Deduction amount must be non-negative."),
  body("effective_from").isISO8601().withMessage("Effective from date is required."),
  body("effective_to").optional({ checkFalsy: true }).isISO8601().withMessage("Effective to date is invalid."),
  body("status").isIn(statuses).withMessage("Status is invalid.")
];

const payrollRunValidator = [
  body("payroll_month").isInt({ min: 1, max: 12 }).withMessage("Payroll month must be between 1 and 12."),
  body("payroll_year").isInt({ min: 2020, max: 2100 }).withMessage("Payroll year is outside the allowed range."),
  body("period_start").isISO8601().withMessage("Period start is required."),
  body("period_end")
    .isISO8601()
    .withMessage("Period end is required.")
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.period_start)) {
        throw new Error("Period end cannot be earlier than period start.");
      }
      return true;
    })
];

module.exports = {
  preparePayrollSettingsInput,
  prepareCodeInput,
  payrollSettingsValidator,
  compensationValidator,
  allowanceTypeValidator,
  deductionTypeValidator,
  staffAllowanceValidator,
  staffDeductionValidator,
  payrollRunValidator
};
