const licenseRepo = require("../repos/license.repo");
const { parseJsonField } = require("../utils/tenant-form");

async function requireActiveLicense(req, res, next) {
  try {
    if (!req.currentUser || req.currentUser.user_type === "developer") {
      return next();
    }

    if (req.currentTenant && req.currentTenant.status === "suspended") {
      res.locals.tenantAccessIssue = "suspended";
      req.flash("error", "Your organization account is currently suspended.");
      return res.redirect("/license-expired");
    }

    const license = await licenseRepo.findActiveByTenantId(req.currentUser.tenant_id);
    if (license) {
      license.modules_json = parseJsonField(license.modules_json, {});
    }
    req.activeLicense = license || null;
    res.locals.activeLicense = license || null;

    if (!license) {
      res.locals.tenantAccessIssue = "license_expired";
      return res.redirect("/license-expired");
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireActiveLicense
};
