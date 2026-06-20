const { body } = require("express-validator");

function prepareAccountInput(req, _res, next) {
  req.body.account_code = String(req.body.account_code || "").trim().toUpperCase();
  req.body.account_name = String(req.body.account_name || "").trim();
  req.body.description = String(req.body.description || "").trim();
  next();
}

function prepareJournalInput(req, _res, next) {
  req.body.description = String(req.body.description || "").trim();
  next();
}

function prepareBankAccountInput(req, _res, next) {
  req.body.account_name = String(req.body.account_name || "").trim();
  req.body.bank_name = String(req.body.bank_name || "").trim();
  req.body.currency = String(req.body.currency || "NLe").trim();
  next();
}

function prepareBankTransactionInput(req, _res, next) {
  req.body.description = String(req.body.description || "").trim();
  req.body.reference_number = String(req.body.reference_number || "").trim();
  next();
}

const accountValidator = [
  body("account_code").notEmpty().withMessage("Account code is required."),
  body("account_name").notEmpty().withMessage("Account name is required."),
  body("account_type").isIn(["asset", "liability", "equity", "income", "expense"]).withMessage("Select a valid account type."),
  body("status").optional().isIn(["active", "inactive"]).withMessage("Select a valid status.")
];

const journalValidator = [
  body("journal_date").isISO8601().withMessage("Journal date is required."),
  body("description").notEmpty().withMessage("Journal description is required."),
  body("lines").custom((lines) => {
    const values = Array.isArray(lines) ? lines : Object.values(lines || {});
    if (values.length < 2) throw new Error("At least two journal lines are required.");
    return true;
  })
];

const bankAccountValidator = [
  body("account_name").notEmpty().withMessage("Account name is required."),
  body("bank_name").notEmpty().withMessage("Bank name is required."),
  body("linked_gl_account_id").notEmpty().withMessage("Linked GL asset account is required."),
  body("opening_balance").optional().isFloat({ min: 0 }).withMessage("Opening balance cannot be negative.")
];

const bankTransactionValidator = [
  body("bank_account_id").notEmpty().withMessage("Bank account is required."),
  body("offset_account_id").notEmpty().withMessage("Offset GL account is required."),
  body("transaction_date").isISO8601().withMessage("Transaction date is required."),
  body("description").notEmpty().withMessage("Description is required."),
  body("transaction_type").isIn(["deposit", "withdrawal", "transfer"]).withMessage("Select a valid transaction type."),
  body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be greater than zero.")
];

module.exports = {
  prepareAccountInput,
  prepareJournalInput,
  prepareBankAccountInput,
  prepareBankTransactionInput,
  accountValidator,
  journalValidator,
  bankAccountValidator,
  bankTransactionValidator
};
