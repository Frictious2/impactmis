const payrollService = require("../services/payroll.service");

function deny(req, res) {
  req.flash("error", "You do not have permission to access payroll.");
  return res.redirect("/dashboard");
}

function requirePayrollView(req, res, next) {
  if (!req.currentUser || !payrollService.VIEW_ROLES.has(req.currentUser.role)) {
    return deny(req, res);
  }
  return next();
}

function requirePayrollManage(req, res, next) {
  if (!req.currentUser || !payrollService.MANAGE_ROLES.has(req.currentUser.role)) {
    return deny(req, res);
  }
  return next();
}

function requirePayrollSelf(req, res, next) {
  if (!req.currentUser || !["Staff", "Volunteer"].includes(req.currentUser.role)) {
    return deny(req, res);
  }
  return next();
}

module.exports = {
  requirePayrollView,
  requirePayrollManage,
  requirePayrollSelf
};
