const expenseService = require("../services/expense.service");

function deny(req, res) {
  req.flash("error", "You do not have permission to access finance or expenses.");
  return res.redirect("/dashboard");
}

function requireFinanceManager(req, res, next) {
  if (!req.currentUser || !expenseService.APPROVE_ROLES.has(req.currentUser.role)) {
    return deny(req, res);
  }
  return next();
}

function requireExpenseView(req, res, next) {
  if (!req.currentUser || !expenseService.VIEW_ROLES.has(req.currentUser.role)) {
    return deny(req, res);
  }
  return next();
}

function requireExpenseCreate(req, res, next) {
  if (!req.currentUser || !expenseService.CREATE_ROLES.has(req.currentUser.role)) {
    return deny(req, res);
  }
  return next();
}

module.exports = {
  requireFinanceManager,
  requireExpenseView,
  requireExpenseCreate
};
