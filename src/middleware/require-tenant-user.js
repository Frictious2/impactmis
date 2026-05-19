function requireTenantUser(req, res, next) {
  if (!req.currentUser) {
    req.flash("error", "Please log in to continue.");
    return res.redirect("/login");
  }

  if (req.currentUser.user_type !== "tenant" || !req.currentUser.tenant_id) {
    req.flash("error", "Tenant access is required.");
    return res.redirect("/developer/dashboard");
  }

  return next();
}

module.exports = {
  requireTenantUser
};
