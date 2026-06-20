const diagnosticsService = require("../services/diagnostics.service");

function health(_req, res) {
  return res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    app: "ImpactMIS"
  });
}

async function diagnostics(req, res, next) {
  try {
    const diagnosticsData = await diagnosticsService.getDiagnostics();
    return res.render("layouts/developer-layout", {
      pageTitle: "Diagnostics",
      contentPartial: "../pages/developer/diagnostics",
      breadcrumbs: [{ label: "Dashboard", href: "/developer/dashboard" }, { label: "Diagnostics" }],
      diagnostics: diagnosticsData
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  health,
  diagnostics
};
