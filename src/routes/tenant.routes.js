const express = require("express");
const tenantController = require("../controllers/tenant.controller");
const { requireAuth } = require("../middleware/require-auth");
const { requireTenantUser } = require("../middleware/require-tenant-user");
const { requireActiveLicense } = require("../middleware/require-active-license");
const {
  prepareOrganizationInput,
  prepareDepartmentInput,
  prepareTenantUserInput,
  prepareApprovalWorkflowInput,
  organizationProfileValidator,
  departmentValidator,
  tenantUserValidator,
  approvalWorkflowValidator
} = require("../validators/tenant-settings.validator");
const { prepareStaffInput, staffValidator } = require("../validators/staff.validator");

const router = express.Router();

router.get("/license-expired", requireAuth, requireTenantUser, tenantController.licenseExpired);

router.use(requireAuth, requireTenantUser, requireActiveLicense);

router.get("/dashboard", tenantController.dashboard);
router.get("/staff", tenantController.staff);
router.get("/staff/create", tenantController.showCreateStaff);
router.post("/staff", prepareStaffInput, staffValidator, tenantController.createStaff);
router.get("/staff/:id", tenantController.showStaffDetail);
router.get("/staff/:id/edit", tenantController.showEditStaff);
router.post("/staff/:id/edit", prepareStaffInput, staffValidator, tenantController.updateStaff);
router.post("/staff/:id/status", tenantController.updateStaffStatus);
router.get("/attendance", tenantController.attendance);
router.get("/projects", tenantController.projects);
router.get("/payroll", tenantController.payroll);
router.get("/reports", tenantController.reports);
router.get("/approvals", tenantController.approvals);
router.get("/audit-logs", tenantController.auditLogs);
router.get("/settings", tenantController.settingsHome);
router.get("/settings/organization", tenantController.organizationSettings);
router.post(
  "/settings/organization",
  prepareOrganizationInput,
  organizationProfileValidator,
  tenantController.saveOrganizationSettings
);
router.get("/settings/departments", tenantController.departments);
router.post(
  "/settings/departments",
  prepareDepartmentInput,
  departmentValidator,
  tenantController.createDepartment
);
router.post(
  "/settings/departments/:id/edit",
  prepareDepartmentInput,
  departmentValidator,
  tenantController.editDepartment
);
router.post("/settings/departments/:id/delete", tenantController.deleteDepartment);
router.get("/settings/users", tenantController.users);
router.get("/settings/users/create", tenantController.showCreateUser);
router.post(
  "/settings/users",
  prepareTenantUserInput,
  tenantUserValidator,
  tenantController.createUser
);
router.get("/settings/approvals", tenantController.approvalSettings);
router.post(
  "/settings/approvals",
  prepareApprovalWorkflowInput,
  approvalWorkflowValidator,
  tenantController.saveApprovalSettings
);

module.exports = router;
