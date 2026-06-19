const donorService = require("../services/donor.service");
const branchRepo = require("../repos/branch.repo");
const { buildActivityReportFilters, getActivityReportTypeOptions } = require("../utils/activity-report-form");

function renderNotFound(res, title) {
  return res.status(404).render("pages/errors/404", { pageTitle: title });
}

async function dashboard(req, res, next) {
  try {
    const tenantId = req.currentUser.tenant_id;
    const [stats, organizationProfile] = await Promise.all([
      donorService.getDashboardMetrics(tenantId),
      donorService.getOrganizationSummary(tenantId)
    ]);

    await donorService.logDonorView({
      tenantId,
      userId: req.currentUser.id,
      action: "donor.dashboard_viewed",
      entityType: "dashboard",
      entityId: null,
      metadata: null,
      ipAddress: req.ip
    });

    return res.render("layouts/donor-layout", {
      pageTitle: "Donor Dashboard",
      contentPartial: "../pages/donor/dashboard",
      breadcrumbs: [{ label: "Dashboard" }],
      stats,
      organizationProfile
    });
  } catch (error) {
    return next(error);
  }
}

async function projects(req, res, next) {
  try {
    const filters = {
      status: req.query.status || "",
      branch_id: req.query.branch_id || ""
    };
    const [projectsList, branches] = await Promise.all([
      donorService.listProjects(req.currentUser.tenant_id, filters),
      branchRepo.listByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/donor-layout", {
      pageTitle: "Projects",
      contentPartial: "../pages/donor/projects/index",
      breadcrumbs: [{ label: "Dashboard", href: "/donor/dashboard" }, { label: "Projects" }],
      projects: projectsList,
      branches,
      filters
    });
  } catch (error) {
    return next(error);
  }
}

async function showProject(req, res, next) {
  try {
    const tenantId = req.currentUser.tenant_id;
    const project = await donorService.findProjectById(tenantId, req.params.id);
    if (!project) {
      return renderNotFound(res, "Project Not Found");
    }

    const [indicators, reports, beneficiarySummary] = await Promise.all([
      donorService.getProjectIndicators(tenantId, project.id),
      donorService.listApprovedReports(tenantId, { project_id: project.id }),
      donorService.getBeneficiarySummary(tenantId, { project_id: project.id })
    ]);

    await donorService.logDonorView({
      tenantId,
      userId: req.currentUser.id,
      action: "donor.project_viewed",
      entityType: "project",
      entityId: project.id,
      metadata: { project_id: project.id, project_code: project.project_code },
      ipAddress: req.ip
    });

    return res.render("layouts/donor-layout", {
      pageTitle: project.project_name,
      contentPartial: "../pages/donor/projects/show",
      breadcrumbs: [
        { label: "Dashboard", href: "/donor/dashboard" },
        { label: "Projects", href: "/donor/projects" },
        { label: project.project_name }
      ],
      project,
      indicators,
      reports,
      beneficiarySummary,
      activeTab: ["overview", "indicators", "reports", "beneficiaries"].includes(req.query.tab)
        ? req.query.tab
        : "overview"
    });
  } catch (error) {
    return next(error);
  }
}

async function activityReports(req, res, next) {
  try {
    const filters = buildActivityReportFilters(req.query);
    const reports = await donorService.listApprovedReports(req.currentUser.tenant_id, filters);
    const projects = await donorService.listProjects(req.currentUser.tenant_id, {});

    return res.render("layouts/donor-layout", {
      pageTitle: "Activity Reports",
      contentPartial: "../pages/donor/activity-reports/index",
      breadcrumbs: [{ label: "Dashboard", href: "/donor/dashboard" }, { label: "Activity Reports" }],
      reports,
      projects,
      filters,
      reportTypeOptions: getActivityReportTypeOptions()
    });
  } catch (error) {
    return next(error);
  }
}

async function showActivityReport(req, res, next) {
  try {
    const tenantId = req.currentUser.tenant_id;
    const report = await donorService.findApprovedReportById(tenantId, req.params.id);
    if (!report) {
      return renderNotFound(res, "Activity Report Not Found");
    }

    const attachments = await donorService.listReportAttachments(tenantId, report.id);

    await donorService.logDonorView({
      tenantId,
      userId: req.currentUser.id,
      action: "donor.report_viewed",
      entityType: "activity_report",
      entityId: report.id,
      metadata: { report_id: report.id, report_code: report.report_code, project_id: report.project_id },
      ipAddress: req.ip
    });

    return res.render("layouts/donor-layout", {
      pageTitle: report.title,
      contentPartial: "../pages/donor/activity-reports/show",
      breadcrumbs: [
        { label: "Dashboard", href: "/donor/dashboard" },
        { label: "Activity Reports", href: "/donor/activity-reports" },
        { label: report.title }
      ],
      report,
      attachments
    });
  } catch (error) {
    return next(error);
  }
}

async function indicators(req, res, next) {
  try {
    const filters = {
      project_id: req.query.project_id || ""
    };
    const [indicatorsList, projects] = await Promise.all([
      donorService.listIndicators(req.currentUser.tenant_id, filters),
      donorService.listProjects(req.currentUser.tenant_id, {})
    ]);

    return res.render("layouts/donor-layout", {
      pageTitle: "Indicators",
      contentPartial: "../pages/donor/indicators/index",
      breadcrumbs: [{ label: "Dashboard", href: "/donor/dashboard" }, { label: "Indicators" }],
      indicators: indicatorsList,
      projects,
      filters
    });
  } catch (error) {
    return next(error);
  }
}

async function beneficiaries(req, res, next) {
  try {
    const filters = {
      project_id: req.query.project_id || "",
      branch_id: req.query.branch_id || "",
      date_from: req.query.date_from || "",
      date_to: req.query.date_to || ""
    };
    const [summary, projects, branches] = await Promise.all([
      donorService.getBeneficiarySummary(req.currentUser.tenant_id, filters),
      donorService.listProjects(req.currentUser.tenant_id, {}),
      branchRepo.listByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/donor-layout", {
      pageTitle: "Beneficiaries",
      contentPartial: "../pages/donor/beneficiaries/index",
      breadcrumbs: [{ label: "Dashboard", href: "/donor/dashboard" }, { label: "Beneficiaries" }],
      summary,
      projects,
      branches,
      filters
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  dashboard,
  projects,
  showProject,
  activityReports,
  showActivityReport,
  indicators,
  beneficiaries
};
