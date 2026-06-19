function forcePasswordChange(req, res, next) {
  if (!req.currentUser || !req.currentUser.must_change_password) {
    return next();
  }

  const allowedPaths = new Set(["/change-password", "/logout"]);
  if (allowedPaths.has(req.path) || req.path.startsWith("/public/")) {
    return next();
  }

  req.flash("error", "Please change your temporary password before continuing.");
  return res.redirect("/change-password");
}

module.exports = {
  forcePasswordChange
};
