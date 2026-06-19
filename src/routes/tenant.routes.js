const express = require("express");
const tenantController = require("../controllers/tenant.controller");
const payrollController = require("../controllers/payroll.controller");
const financeController = require("../controllers/finance.controller");
const reportController = require("../controllers/report.controller");
const notificationController = require("../controllers/notification.controller");
const messageController = require("../controllers/message.controller");
const { requireAuth } = require("../middleware/require-auth");
const { requireTenantUser } = require("../middleware/require-tenant-user");
const { requireActiveLicense } = require("../middleware/require-active-license");
const { requireNonDonorTenant } = require("../middleware/require-non-donor-tenant");
const { requireModuleAccess } = require("../middleware/require-module-access");
const { requirePayrollView, requirePayrollManage, requirePayrollSelf } = require("../middleware/require-payroll-role");
const { requireFinanceManager, requireExpenseView, requireExpenseCreate } = require("../middleware/require-finance-role");
const { requireReportCenter, requireNamedReport } = require("../middleware/require-report-access");
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
const { prepareBranchInput, branchValidator } = require("../validators/branch.validator");
const {
  prepareAttendanceInput,
  prepareBulkAttendanceInput,
  prepareRejectInput,
  prepareSelfCheckinInput,
  attendanceValidator,
  bulkAttendanceValidator,
  rejectAttendanceValidator,
  selfCheckinValidator
} = require("../validators/attendance.validator");
const {
  prepareProjectInput,
  prepareAssignmentInput,
  prepareTaskInput,
  prepareTaskStatusInput,
  projectValidator,
  assignmentValidator,
  taskValidator,
  taskStatusValidator
} = require("../validators/project.validator");
const {
  prepareActivityReportInput,
  prepareRejectActivityReportInput,
  activityReportValidator,
  rejectActivityReportValidator
} = require("../validators/activity-report.validator");
const {
  prepareIndicatorInput,
  prepareIndicatorUpdateInput,
  indicatorValidator,
  indicatorUpdateValidator
} = require("../validators/indicator.validator");
const {
  preparePayrollSettingsInput,
  prepareCodeInput,
  payrollSettingsValidator,
  compensationValidator,
  allowanceTypeValidator,
  deductionTypeValidator,
  staffAllowanceValidator,
  staffDeductionValidator,
  payrollRunValidator
} = require("../validators/payroll.validator");
const {
  prepareCategoryInput,
  categoryValidator,
  budgetValidator,
  expenseValidator,
  rejectExpenseValidator
} = require("../validators/finance.validator");
const { activityReportUpload } = require("../middleware/activity-report-upload");
const { expenseUpload } = require("../middleware/expense-upload");
const env = require("../config/env");

const router = express.Router();
const requireStaffModule = requireModuleAccess("staff");
const requireAttendanceModule = requireModuleAccess("attendance");
const requireBranchesModule = requireModuleAccess("branches");
const requireProjectsModule = requireModuleAccess("projects");
const requireReportsModule = requireModuleAccess("reports");
const requirePayrollModule = requireModuleAccess("payroll");
const requireFinanceModule = requireModuleAccess("finance");
const requireApprovalsModule = requireModuleAccess("approvals");

router.get("/license-expired", requireAuth, requireTenantUser, tenantController.licenseExpired);

router.use(requireAuth, requireTenantUser, requireActiveLicense);

if (env.appEnv === "development") {
  router.get("/debug/current-license", (req, res) =>
    res.json({
      tenant_id: req.currentUser.tenant_id,
      active_license_id: req.activeLicense?.id || null,
      status: req.activeLicense?.status || null,
      expires_at: req.activeLicense?.expires_at || null,
      modules: req.activeLicense?.modules_json || {},
      finance: req.activeLicense?.modules_json?.finance
    })
  );
}

router.get("/notifications", notificationController.notifications);
router.post("/notifications/:id/read", notificationController.markRead);
router.post("/notifications/read-all", notificationController.markAllRead);
router.get("/messages", messageController.inbox);
router.get("/messages/sent", messageController.sent);
router.get("/messages/create", messageController.showCreate);
router.post("/messages", messageController.create);
router.get("/messages/:id", messageController.detail);
router.post("/messages/:id/read", messageController.markRead);

router.use(requireNonDonorTenant);

router.get("/dashboard", tenantController.dashboard);
router.get("/staff", requireStaffModule, tenantController.staff);
router.get("/staff/create", requireStaffModule, tenantController.showCreateStaff);
router.post("/staff", requireStaffModule, prepareStaffInput, staffValidator, tenantController.createStaff);
router.get("/staff/:id", requireStaffModule, tenantController.showStaffDetail);
router.get("/staff/:id/edit", requireStaffModule, tenantController.showEditStaff);
router.post("/staff/:id/edit", requireStaffModule, prepareStaffInput, staffValidator, tenantController.updateStaff);
router.post("/staff/:id/status", requireStaffModule, tenantController.updateStaffStatus);
router.get("/branches", requireBranchesModule, tenantController.branches);
router.get("/branches/create", requireBranchesModule, tenantController.showCreateBranch);
router.post("/branches", requireBranchesModule, prepareBranchInput, branchValidator, tenantController.createBranch);
router.get("/branches/:id", requireBranchesModule, tenantController.showBranchDetail);
router.get("/branches/:id/edit", requireBranchesModule, tenantController.showEditBranch);
router.post("/branches/:id/edit", requireBranchesModule, prepareBranchInput, branchValidator, tenantController.updateBranch);
router.post("/branches/:id/status", requireBranchesModule, tenantController.updateBranchStatus);
router.get("/attendance", requireAttendanceModule, tenantController.attendance);
router.get("/attendance/create", requireAttendanceModule, tenantController.showCreateAttendance);
router.get("/attendance/self-checkin", requireAttendanceModule, tenantController.showSelfCheckin);
router.post(
  "/attendance/self-checkin",
  requireAttendanceModule,
  prepareSelfCheckinInput,
  selfCheckinValidator,
  tenantController.submitSelfCheckin
);
router.post(
  "/attendance",
  requireAttendanceModule,
  prepareAttendanceInput,
  attendanceValidator,
  tenantController.createAttendance
);
router.get("/attendance/bulk", requireAttendanceModule, tenantController.showBulkAttendance);
router.post(
  "/attendance/bulk",
  requireAttendanceModule,
  prepareBulkAttendanceInput,
  bulkAttendanceValidator,
  tenantController.createBulkAttendance
);
router.get("/attendance/:id", requireAttendanceModule, tenantController.showAttendanceDetail);
router.get("/attendance/:id/edit", requireAttendanceModule, tenantController.showEditAttendance);
router.post(
  "/attendance/:id/edit",
  requireAttendanceModule,
  prepareAttendanceInput,
  attendanceValidator,
  tenantController.updateAttendance
);
router.post("/attendance/:id/approve", requireAttendanceModule, tenantController.approveAttendance);
router.post(
  "/attendance/:id/reject",
  requireAttendanceModule,
  prepareRejectInput,
  rejectAttendanceValidator,
  tenantController.rejectAttendance
);
router.get("/projects", requireProjectsModule, tenantController.projects);
router.get("/projects/create", requireProjectsModule, tenantController.showCreateProject);
router.post("/projects", requireProjectsModule, prepareProjectInput, projectValidator, tenantController.createProject);
router.get("/projects/:id", requireProjectsModule, tenantController.showProjectDetail);
router.get("/projects/:id/edit", requireProjectsModule, tenantController.showEditProject);
router.post(
  "/projects/:id/edit",
  requireProjectsModule,
  prepareProjectInput,
  projectValidator,
  tenantController.updateProject
);
router.post("/projects/:id/status", requireProjectsModule, tenantController.updateProjectStatus);
router.post(
  "/projects/:id/assign",
  requireProjectsModule,
  prepareAssignmentInput,
  assignmentValidator,
  tenantController.assignProjectStaff
);
router.post("/projects/:id/remove-assignment", requireProjectsModule, tenantController.removeProjectAssignment);
router.post(
  "/projects/:id/tasks",
  requireProjectsModule,
  prepareTaskInput,
  taskValidator,
  tenantController.createProjectTask
);
router.post(
  "/tasks/:id/edit",
  requireProjectsModule,
  prepareTaskInput,
  taskValidator,
  tenantController.updateProjectTask
);
router.post(
  "/tasks/:id/status",
  requireProjectsModule,
  prepareTaskStatusInput,
  taskStatusValidator,
  tenantController.updateProjectTaskStatus
);
router.get("/activity-reports", requireReportsModule, tenantController.activityReports);
router.get("/activity-reports/create", requireReportsModule, tenantController.showCreateActivityReport);
router.post(
  "/activity-reports",
  requireReportsModule,
  prepareActivityReportInput,
  activityReportValidator,
  tenantController.createActivityReport
);
router.get("/activity-reports/:id", requireReportsModule, tenantController.showActivityReportDetail);
router.get("/activity-reports/:id/edit", requireReportsModule, tenantController.showEditActivityReport);
router.post(
  "/activity-reports/:id/edit",
  requireReportsModule,
  prepareActivityReportInput,
  activityReportValidator,
  tenantController.updateActivityReport
);
router.post("/activity-reports/:id/submit", requireReportsModule, tenantController.submitActivityReport);
router.post("/activity-reports/:id/approve", requireReportsModule, tenantController.approveActivityReport);
router.post(
  "/activity-reports/:id/reject",
  requireReportsModule,
  prepareRejectActivityReportInput,
  rejectActivityReportValidator,
  tenantController.rejectActivityReport
);
router.post(
  "/activity-reports/:id/attachments",
  requireReportsModule,
  activityReportUpload,
  tenantController.addActivityReportAttachment
);
router.get("/projects/:id/indicators", requireProjectsModule, tenantController.projectIndicators);
router.post(
  "/projects/:id/indicators",
  requireProjectsModule,
  prepareIndicatorInput,
  indicatorValidator,
  tenantController.createProjectIndicator
);
router.post(
  "/indicators/:id/edit",
  requireProjectsModule,
  prepareIndicatorInput,
  indicatorValidator,
  tenantController.updateProjectIndicator
);
router.post(
  "/indicators/:id/update-progress",
  requireProjectsModule,
  prepareIndicatorUpdateInput,
  indicatorUpdateValidator,
  tenantController.updateIndicatorProgress
);
router.get("/finance/categories", requireFinanceModule, requireFinanceManager, financeController.categories);
router.post(
  "/finance/categories",
  requireFinanceModule,
  requireFinanceManager,
  prepareCategoryInput,
  categoryValidator,
  financeController.createCategory
);
router.post(
  "/finance/categories/:id/edit",
  requireFinanceModule,
  requireFinanceManager,
  prepareCategoryInput,
  categoryValidator,
  financeController.updateCategory
);
router.get("/projects/:id/budgets", requireFinanceModule, requireExpenseView, financeController.projectBudgets);
router.post(
  "/projects/:id/budgets",
  requireFinanceModule,
  requireFinanceManager,
  budgetValidator,
  financeController.saveProjectBudget
);
router.get("/expenses", requireFinanceModule, requireExpenseView, financeController.expenses);
router.get("/expenses/create", requireFinanceModule, requireExpenseCreate, financeController.showCreateExpense);
router.post(
  "/expenses",
  requireFinanceModule,
  requireExpenseCreate,
  expenseUpload,
  expenseValidator,
  financeController.createExpense
);
router.get("/expenses/:id", requireFinanceModule, requireExpenseView, financeController.expenseDetail);
router.get("/expenses/:id/edit", requireFinanceModule, requireExpenseCreate, financeController.showEditExpense);
router.post(
  "/expenses/:id/edit",
  requireFinanceModule,
  requireExpenseCreate,
  expenseUpload,
  expenseValidator,
  financeController.updateExpense
);
router.post("/expenses/:id/submit", requireFinanceModule, requireExpenseCreate, financeController.submitExpense);
router.post("/expenses/:id/approve", requireFinanceModule, requireFinanceManager, financeController.approveExpense);
router.post(
  "/expenses/:id/reject",
  requireFinanceModule,
  requireFinanceManager,
  rejectExpenseValidator,
  financeController.rejectExpense
);
router.post("/expenses/:id/mark-paid", requireFinanceModule, requireFinanceManager, financeController.markExpensePaid);
router.post("/expenses/:id/cancel", requireFinanceModule, requireExpenseCreate, financeController.cancelExpense);
router.post("/expenses/:id/attachments", requireFinanceModule, requireExpenseCreate, expenseUpload, financeController.addAttachment);
router.get("/reports/center", requireReportsModule, requireReportCenter, reportController.center);
router.get("/reports/:reportName", requireReportsModule, requireNamedReport, reportController.showReport);
router.get("/my/payroll", requirePayrollModule, requirePayrollSelf, payrollController.myPayroll);
router.get(
  "/my/payroll/runs/:runId/items/:itemId/payslip",
  requirePayrollModule,
  requirePayrollSelf,
  payrollController.myPayslip
);
router.get(
  "/my/payroll/runs/:runId/items/:itemId/payslip/print",
  requirePayrollModule,
  requirePayrollSelf,
  payrollController.myPrintPayslip
);
router.get("/payroll", requirePayrollModule, requirePayrollView, (_req, res) => res.redirect("/payroll/runs"));
router.get("/payroll/settings", requirePayrollModule, requirePayrollManage, payrollController.settings);
router.post(
  "/payroll/settings",
  requirePayrollModule,
  requirePayrollManage,
  preparePayrollSettingsInput,
  payrollSettingsValidator,
  payrollController.saveSettings
);
router.get("/payroll/compensation", requirePayrollModule, requirePayrollManage, payrollController.compensation);
router.get("/payroll/compensation/:staffId", requirePayrollModule, requirePayrollManage, payrollController.compensationDetail);
router.post(
  "/payroll/compensation/:staffId",
  requirePayrollModule,
  requirePayrollManage,
  compensationValidator,
  payrollController.saveCompensation
);
router.get("/payroll/allowance-types", requirePayrollModule, requirePayrollManage, payrollController.allowanceTypes);
router.post(
  "/payroll/allowance-types",
  requirePayrollModule,
  requirePayrollManage,
  prepareCodeInput,
  allowanceTypeValidator,
  payrollController.createAllowanceType
);
router.post(
  "/payroll/allowance-types/:id/edit",
  requirePayrollModule,
  requirePayrollManage,
  prepareCodeInput,
  allowanceTypeValidator,
  payrollController.editAllowanceType
);
router.get("/payroll/deduction-types", requirePayrollModule, requirePayrollManage, payrollController.deductionTypes);
router.post(
  "/payroll/deduction-types",
  requirePayrollModule,
  requirePayrollManage,
  prepareCodeInput,
  deductionTypeValidator,
  payrollController.createDeductionType
);
router.post(
  "/payroll/deduction-types/:id/edit",
  requirePayrollModule,
  requirePayrollManage,
  prepareCodeInput,
  deductionTypeValidator,
  payrollController.editDeductionType
);
router.post(
  "/payroll/staff/:staffId/allowances",
  requirePayrollModule,
  requirePayrollManage,
  staffAllowanceValidator,
  payrollController.addStaffAllowance
);
router.post(
  "/payroll/staff/:staffId/deductions",
  requirePayrollModule,
  requirePayrollManage,
  staffDeductionValidator,
  payrollController.addStaffDeduction
);
router.get("/payroll/runs", requirePayrollModule, requirePayrollView, payrollController.runs);
router.get("/payroll/runs/generate", requirePayrollModule, requirePayrollManage, payrollController.showGenerateRun);
router.post(
  "/payroll/runs/generate",
  requirePayrollModule,
  requirePayrollManage,
  payrollRunValidator,
  payrollController.generateRun
);
router.get("/payroll/runs/:id/export.csv", requirePayrollModule, requirePayrollManage, payrollController.exportRunCsv);
router.get("/payroll/runs/:id/items", requirePayrollModule, requirePayrollView, (req, res) =>
  res.redirect(`/payroll/runs/${req.params.id}`)
);
router.get("/payroll/runs/:id", requirePayrollModule, requirePayrollView, payrollController.runDetail);
router.get(
  "/payroll/runs/:runId/items/:itemId/payslip",
  requirePayrollModule,
  requirePayrollView,
  payrollController.payslip
);
router.get(
  "/payroll/runs/:runId/items/:itemId/payslip/print",
  requirePayrollModule,
  requirePayrollView,
  payrollController.printPayslip
);
router.post(
  "/payroll/runs/:runId/items/:itemId/mark-paid",
  requirePayrollModule,
  requirePayrollManage,
  payrollController.markItemPaid
);
router.post(
  "/payroll/runs/:runId/items/:itemId/mark-unpaid",
  requirePayrollModule,
  requirePayrollManage,
  payrollController.markItemUnpaid
);
router.post("/payroll/runs/:id/submit", requirePayrollModule, requirePayrollManage, payrollController.submitRun);
router.post("/payroll/runs/:id/approve", requirePayrollModule, requirePayrollManage, payrollController.approveRun);
router.post("/payroll/runs/:id/mark-paid", requirePayrollModule, requirePayrollManage, payrollController.markPaid);
router.post("/payroll/runs/:id/cancel", requirePayrollModule, requirePayrollManage, payrollController.cancelRun);
router.get("/reports", requireReportsModule, requireReportCenter, (_req, res) => res.redirect("/reports/center"));
router.get("/approvals", requireApprovalsModule, tenantController.approvals);
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
