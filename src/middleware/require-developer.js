function requireDeveloper(req, res, next) {
  if (!req.currentUser) {
    req.flash("error", "Please log in to continue.");
    return res.redirect("/login");
  }

  if (req.currentUser.user_type !== "developer" || req.currentUser.tenant_id !== null) {
    req.flash("error", "Developer access is required.");
    return res.redirect("/dashboard");
  }

  return next();
}

module.exports = {
  requireDeveloper
};
