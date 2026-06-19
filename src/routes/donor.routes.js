const express = require("express");
const donorController = require("../controllers/donor.controller");
const { requireAuth } = require("../middleware/require-auth");
const { requireTenantUser } = require("../middleware/require-tenant-user");
const { requireActiveLicense } = require("../middleware/require-active-license");
const { requireDonor } = require("../middleware/require-donor");
const { requireModuleAccess } = require("../middleware/require-module-access");

const router = express.Router();

router.use(requireAuth, requireTenantUser, requireActiveLicense, requireDonor, requireModuleAccess("donors"));

router.get("/dashboard", donorController.dashboard);
router.get("/projects", requireModuleAccess("projects"), donorController.projects);
router.get("/projects/:id", requireModuleAccess("projects"), donorController.showProject);
router.get("/activity-reports", requireModuleAccess("reports"), donorController.activityReports);
router.get("/activity-reports/:id", requireModuleAccess("reports"), donorController.showActivityReport);
router.get("/indicators", requireModuleAccess("projects"), donorController.indicators);
router.get("/beneficiaries", requireModuleAccess("reports"), donorController.beneficiaries);

module.exports = router;
