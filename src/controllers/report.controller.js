const reportService = require("../services/report.service");
const csvExportService = require("../services/csv-export.service");
const departmentRepo = require("../repos/department.repo");
const branchRepo = require("../repos/branch.repo");
const projectRepo = require("../repos/project.repo");
const staffRepo = require("../repos/staff.repo");
const { buildExpenseFilters } = require("../utils/finance-form");

const REPORT_ROUTES = {
  "staff-register": "/reports/staff-register",
  "attendance-summary": "/reports/attendance-summary",
  "geofence-exceptions": "/reports/geofence-exceptions",
  "project-portfolio": "/reports/project-portfolio",
  "activity-register": "/reports/activity-register",
  "beneficiary-summary": "/reports/beneficiary-summary",
  "indicator-progress": "/reports/indicator-progress",
  "payroll-summary": "/reports/payroll-summary",
  "expense-register": "/reports/expense-register",
  "budget-utilization": "/reports/budget-utilization"
};

function normalizeFilters(query = {}) {
  return {
    date_from: query.date_from || "",
    date_to: query.date_to || "",
    department_id: query.department_id || "",
    branch_id: query.branch_id || "",
    project_id: query.project_id || "",
    staff_member_id: query.staff_member_id || "",
    status: query.status || "",
    approval_status: query.approval_status || "",
    payment_method: query.payment_method || ""
  };
}

async function loadFilterOptions(tenantId) {
  const [departments, branches, projects, staffMembers] = await Promise.all([
    departmentRepo.listByTenantId(tenantId),
    branchRepo.listByTenantId(tenantId),
    projectRepo.listProjects(tenantId, {}),
    staffRepo.listActiveAttendanceEligibleByTenantId(tenantId)
  ]);
  return { departments, branches, projects, staffMembers };
}

async function center(req, res, next) {
  try {
    return res.render("layouts/tenant-layout", {
      pageTitle: "Reports Center",
      contentPartial: "../pages/tenant/reports/center",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Reports Center" }],
      groups: reportService.listCenterGroupsForUser(req.currentUser),
      reportRoutes: REPORT_ROUTES
    });
  } catch (error) {
    return next(error);
  }
}

async function showReport(req, res, next) {
  try {
    const reportName = req.params.reportName;
    const filters = normalizeFilters(req.query);
    const exportMode = req.query.export === "csv";
    const result = await reportService.runReport(
      req.currentUser.tenant_id,
      reportName,
      filters,
      req.currentUser,
      req.ip,
      exportMode
    );

    if (exportMode) {
      return csvExportService.sendCsv(res, reportName, result.columns, result.rows);
    }

    const filterOptions = await loadFilterOptions(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: result.report.title,
      contentPartial: "../pages/tenant/reports/show",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Reports Center", href: "/reports/center" },
        { label: result.report.title }
      ],
      reportName,
      report: result.report,
      columns: result.columns,
      rows: result.rows,
      filters,
      filterOptions,
      exportHref: `${REPORT_ROUTES[reportName]}?${new URLSearchParams({ ...filters, export: "csv" }).toString()}`
    });
  } catch (error) {
    if (error.statusCode === 403) {
      req.flash("error", error.message);
      return res.redirect("/reports/center");
    }
    return next(error);
  }
}

module.exports = {
  center,
  showReport,
  REPORT_ROUTES
};
