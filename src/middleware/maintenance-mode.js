const env = require("../config/env");

function maintenanceMode(req, res, next) {
  if (!env.maintenanceMode) {
    return next();
  }

  if (
    req.path === "/health" ||
    req.path === "/login" ||
    req.path === "/logout" ||
    req.path.startsWith("/developer") ||
    req.path.startsWith("/public") ||
    req.path.startsWith("/css") ||
    req.path.startsWith("/js")
  ) {
    return next();
  }

  if (req.currentUser?.user_type === "developer") {
    return next();
  }

  return res.status(503).render("pages/maintenance", {
    pageTitle: "Maintenance Mode"
  });
}

module.exports = {
  maintenanceMode
};
