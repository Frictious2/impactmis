const express = require("express");
const developerController = require("../controllers/developer.controller");
const { requireAuth } = require("../middleware/require-auth");
const { requireDeveloper } = require("../middleware/require-developer");
const {
  prepareTenantCreateInput,
  prepareLicenseInput,
  createTenantValidator,
  issueLicenseValidator
} = require("../validators/developer-tenant.validator");

const router = express.Router();

router.use(requireAuth, requireDeveloper);

router.get("/dashboard", developerController.dashboard);
router.get("/tenants", developerController.tenants);
router.get("/tenants/create", developerController.showCreateTenant);
router.post("/tenants", prepareTenantCreateInput, createTenantValidator, developerController.createTenant);
router.get("/tenants/:id/licenses/new", developerController.showNewLicense);
router.post(
  "/tenants/:id/licenses",
  prepareLicenseInput,
  issueLicenseValidator,
  developerController.createLicense
);
router.get("/tenants/:tenantId/licenses/:licenseId/edit", developerController.showEditLicense);
router.post(
  "/tenants/:tenantId/licenses/:licenseId/edit",
  prepareLicenseInput,
  issueLicenseValidator,
  developerController.updateLicense
);
router.get("/tenants/:id", developerController.showTenantDetail);
router.post("/tenants/:id/suspend", developerController.suspendTenant);
router.post("/tenants/:id/reactivate", developerController.reactivateTenant);
router.get("/licenses", developerController.licenses);
router.get("/users", developerController.users);
router.get("/audit-logs", developerController.auditLogs);
router.get("/settings", developerController.settings);

module.exports = router;
