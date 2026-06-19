function requireNonDonorTenant(req, res, next) {
  if (!req.currentUser) {
    req.flash("error", "Please log in to continue.");
    return res.redirect("/login");
  }

  if (req.currentUser.user_type !== "tenant" || !req.currentUser.tenant_id) {
    req.flash("error", "Tenant access is required.");
    return res.redirect("/developer/dashboard");
  }

  if (req.currentUser.role === "Donor") {
    req.flash("error", "Your account has read-only donor access.");
    return res.redirect("/donor/dashboard");
  }

  return next();
}

module.exports = {
  requireNonDonorTenant
};
