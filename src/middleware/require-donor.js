function requireDonor(req, res, next) {
  if (!req.currentUser) {
    req.flash("error", "Please log in to continue.");
    return res.redirect("/login");
  }

  if (
    req.currentUser.user_type !== "tenant" ||
    !req.currentUser.tenant_id ||
    req.currentUser.role !== "Donor"
  ) {
    req.flash("error", "Donor access is required.");
    return res.redirect("/dashboard");
  }

  return next();
}

module.exports = {
  requireDonor
};
