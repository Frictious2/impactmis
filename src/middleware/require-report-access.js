const reportService = require("../services/report.service");

function requireReportCenter(req, res, next) {
  if (!req.currentUser || ["Donor", "Staff", "Volunteer"].includes(req.currentUser.role)) {
    req.flash("error", "You do not have permission to access the report center.");
    return res.redirect("/dashboard");
  }
  return next();
}

function requireNamedReport(req, res, next) {
  const reportName = req.params.reportName || req.route.path.split("/").pop();
  if (!reportService.canAccessReport(req.currentUser, reportName)) {
    req.flash("error", "You do not have permission to access this report.");
    return res.redirect("/reports/center");
  }
  return next();
}

module.exports = {
  requireReportCenter,
  requireNamedReport
};
