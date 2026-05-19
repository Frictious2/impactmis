const tenantRepo = require("../repos/tenant.repo");

async function attachTenantContext(req, res, next) {
  try {
    res.locals.currentTenant = null;

    if (!req.currentUser || !req.currentUser.tenant_id) {
      req.currentTenant = null;
      return next();
    }

    const tenant = await tenantRepo.findById(req.currentUser.tenant_id);
    req.currentTenant = tenant;
    res.locals.currentTenant = tenant;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  attachTenantContext
};
