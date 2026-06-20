const logframeService = require("../services/logframe.service");
const surveyService = require("../services/survey.service");

function deny(req, res) {
  req.flash("error", "You do not have permission to access this M&E area.");
  return res.redirect("/dashboard");
}

function requireMneView(req, res, next) {
  if (!req.currentUser || !(logframeService.VIEW_ROLES.has(req.currentUser.role) || surveyService.VIEW_ROLES.has(req.currentUser.role))) {
    return deny(req, res);
  }
  return next();
}

function requireMneManage(req, res, next) {
  if (!req.currentUser || !(logframeService.MANAGE_ROLES.has(req.currentUser.role) || surveyService.MANAGE_ROLES.has(req.currentUser.role))) {
    return deny(req, res);
  }
  return next();
}

module.exports = { requireMneView, requireMneManage };
