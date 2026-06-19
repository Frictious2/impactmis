const { body } = require("express-validator");
const financeRepo = require("../repos/finance.repo");

function prepareCategoryInput(req, _res, next) {
  req.body.code = String(req.body.code || "").trim().toUpperCase().replace(/\s+/g, "_");
  req.body.status = req.body.status || "active";
  next();
}

const categoryValidator = [
  body("name").trim().notEmpty().withMessage("Category name is required."),
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Category code is required.")
    .bail()
    .custom(async (value, { req }) => {
      const exists = await financeRepo.existsCategoryCode(req.currentUser.tenant_id, value, req.params.id || null);
      if (exists) {
        throw new Error("Category code already exists.");
      }
      return true;
    }),
  body("category_type").isIn(["expense", "income"]).withMessage("Category type is invalid."),
  body("status").isIn(["active", "inactive"]).withMessage("Status is invalid.")
];

const budgetValidator = [
  body("category_id").isInt({ min: 1 }).withMessage("Category is required."),
  body("budget_amount").isFloat({ min: 0.01 }).withMessage("Budget amount must be positive."),
  body("status").isIn(["active", "inactive"]).withMessage("Status is invalid.")
];

const expenseValidator = [
  body("expense_date").isISO8601().withMessage("Expense date is required."),
  body("category_id").isInt({ min: 1 }).withMessage("Category is required."),
  body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be positive."),
  body("description").trim().notEmpty().withMessage("Description is required."),
  body("payment_method")
    .isIn(["cash", "mobile_money", "bank_transfer", "cheque", "other"])
    .withMessage("Payment method is invalid.")
];

const rejectExpenseValidator = [body("rejection_reason").trim().notEmpty().withMessage("Rejection reason is required.")];

module.exports = {
  prepareCategoryInput,
  categoryValidator,
  budgetValidator,
  expenseValidator,
  rejectExpenseValidator
};
