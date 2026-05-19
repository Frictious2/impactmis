function requireAuth(req, res, next) {
  if (!req.currentUser) {
    req.flash("error", "Please log in to continue.");
    return res.redirect("/login");
  }

  return next();
}

module.exports = {
  requireAuth
};
