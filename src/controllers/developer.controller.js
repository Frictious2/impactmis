const { validationResult } = require("express-validator");
const tenantRepo = require("../repos/tenant.repo");
const userRepo = require("../repos/user.repo");
const licenseRepo = require("../repos/license.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const tenantOnboardingService = require("../services/tenant-onboarding.service");
const {
  buildTenantCreateFormData,
  buildLicenseFormData,
  getModuleCatalog
} = require("../utils/tenant-form");

async function dashboard(req, res, next) {
  try {
    const stats = await tenantRepo.getDeveloperDashboardStats();

    return res.render("layouts/developer-layout", {
      pageTitle: "Developer Dashboard",
      contentPartial: "../pages/developer/dashboard",
      breadcrumbs: [{ label: "Dashboard" }],
      stats
    });
  } catch (error) {
    return next(error);
  }
}

async function tenants(req, res, next) {
  try {
    const filters = {
      search: req.query.search || "",
      status: req.query.status || "",
      license: req.query.license || ""
    };
    const tenantsList = await tenantRepo.listForDeveloper(filters);

    return res.render("layouts/developer-layout", {
      pageTitle: "Tenants",
      contentPartial: "../pages/developer/tenants/index",
      breadcrumbs: [{ label: "Dashboard", href: "/developer/dashboard" }, { label: "Tenants" }],
      filters,
      tenants: tenantsList
    });
  } catch (error) {
    return next(error);
  }
}

function showCreateTenant(req, res) {
  return res.render("layouts/developer-layout", {
    pageTitle: "Create Tenant",
    contentPartial: "../pages/developer/tenants/create",
    breadcrumbs: [
      { label: "Dashboard", href: "/developer/dashboard" },
      { label: "Tenants", href: "/developer/tenants" },
      { label: "Create Tenant" }
    ],
    moduleCatalog: getModuleCatalog(),
    formData: buildTenantCreateFormData(),
    validationErrors: []
  });
}

async function createTenant(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/developer-layout", {
        pageTitle: "Create Tenant",
        contentPartial: "../pages/developer/tenants/create",
        breadcrumbs: [
          { label: "Dashboard", href: "/developer/dashboard" },
          { label: "Tenants", href: "/developer/tenants" },
          { label: "Create Tenant" }
        ],
        moduleCatalog: getModuleCatalog(),
        formData: buildTenantCreateFormData(req.body),
        validationErrors: errors.array()
      });
    }

    const result = await tenantOnboardingService.createTenantOnboarding({
      actor: req.currentUser,
      ipAddress: req.ip,
      payload: req.body
    });

    req.flash("success", `${result.tenant.name} was created successfully.`);
    return res.redirect(`/developer/tenants/${result.tenant.id}`);
  } catch (error) {
    return next(error);
  }
}

async function showTenantDetail(req, res, next) {
  try {
    const tenant = await tenantRepo.findDeveloperTenantDetailById(req.params.id);

    if (!tenant) {
      return res.status(404).render("pages/errors/404", {
        pageTitle: "Tenant Not Found"
      });
    }

    const [license, adminUsers, recentAuditLogs] = await Promise.all([
      licenseRepo.findCurrentOrLatestByTenantId(tenant.id),
      userRepo.listAdminUsersByTenantId(tenant.id),
      auditLogRepo.listRecentByTenantId(tenant.id, 10)
    ]);

    return res.render("layouts/developer-layout", {
      pageTitle: tenant.name,
      contentPartial: "../pages/developer/tenants/show",
      breadcrumbs: [
        { label: "Dashboard", href: "/developer/dashboard" },
        { label: "Tenants", href: "/developer/tenants" },
        { label: tenant.name }
      ],
      tenant,
      currentLicense: license,
      adminUsers,
      recentAuditLogs
    });
  } catch (error) {
    return next(error);
  }
}

async function showNewLicense(req, res, next) {
  try {
    const tenant = await tenantRepo.findById(req.params.id);

    if (!tenant) {
      return res.status(404).render("pages/errors/404", {
        pageTitle: "Tenant Not Found"
      });
    }

    return res.render("layouts/developer-layout", {
      pageTitle: "Issue License",
      contentPartial: "../pages/developer/tenants/license-form",
      breadcrumbs: [
        { label: "Dashboard", href: "/developer/dashboard" },
        { label: "Tenants", href: "/developer/tenants" },
        { label: tenant.name, href: `/developer/tenants/${tenant.id}` },
        { label: "Issue License" }
      ],
      tenant,
      moduleCatalog: getModuleCatalog(),
      formData: buildLicenseFormData(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createLicense(req, res, next) {
  try {
    const tenant = await tenantRepo.findById(req.params.id);

    if (!tenant) {
      return res.status(404).render("pages/errors/404", {
        pageTitle: "Tenant Not Found"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/developer-layout", {
        pageTitle: "Issue License",
        contentPartial: "../pages/developer/tenants/license-form",
        breadcrumbs: [
          { label: "Dashboard", href: "/developer/dashboard" },
          { label: "Tenants", href: "/developer/tenants" },
          { label: tenant.name, href: `/developer/tenants/${tenant.id}` },
          { label: "Issue License" }
        ],
        tenant,
        moduleCatalog: getModuleCatalog(),
        formData: buildLicenseFormData(req.body),
        validationErrors: errors.array()
      });
    }

    await tenantOnboardingService.issueLicense({
      tenantId: tenant.id,
      actor: req.currentUser,
      ipAddress: req.ip,
      payload: req.body
    });

    req.flash("success", `A new license was issued for ${tenant.name}.`);
    return res.redirect(`/developer/tenants/${tenant.id}`);
  } catch (error) {
    return next(error);
  }
}

async function suspendTenant(req, res, next) {
  try {
    const tenant = await tenantRepo.findById(req.params.id);

    if (!tenant) {
      return res.status(404).render("pages/errors/404", {
        pageTitle: "Tenant Not Found"
      });
    }

    await tenantOnboardingService.updateTenantStatus({
      tenantId: tenant.id,
      nextStatus: "suspended",
      actor: req.currentUser,
      ipAddress: req.ip
    });

    req.flash("success", `${tenant.name} has been suspended.`);
    return res.redirect(`/developer/tenants/${tenant.id}`);
  } catch (error) {
    return next(error);
  }
}

async function reactivateTenant(req, res, next) {
  try {
    const tenant = await tenantRepo.findById(req.params.id);

    if (!tenant) {
      return res.status(404).render("pages/errors/404", {
        pageTitle: "Tenant Not Found"
      });
    }

    await tenantOnboardingService.updateTenantStatus({
      tenantId: tenant.id,
      nextStatus: "active",
      actor: req.currentUser,
      ipAddress: req.ip
    });

    req.flash("success", `${tenant.name} has been reactivated.`);
    return res.redirect(`/developer/tenants/${tenant.id}`);
  } catch (error) {
    return next(error);
  }
}

function placeholder(pageTitle, heading, description, breadcrumbLabel) {
  return (req, res) =>
    res.render("layouts/developer-layout", {
      pageTitle,
      contentPartial: "../pages/developer/placeholder",
      breadcrumbs: [{ label: "Dashboard", href: "/developer/dashboard" }, { label: breadcrumbLabel }],
      heading,
      description
    });
}

module.exports = {
  dashboard,
  tenants,
  showCreateTenant,
  createTenant,
  showTenantDetail,
  showNewLicense,
  createLicense,
  suspendTenant,
  reactivateTenant,
  licenses: placeholder(
    "Licenses",
    "Licenses",
    "License assignment and lifecycle tools will continue expanding in a future phase.",
    "Licenses"
  ),
  users: placeholder(
    "Users",
    "Users",
    "System-wide user administration will be implemented in a future phase.",
    "Users"
  ),
  auditLogs: placeholder(
    "Audit Logs",
    "Audit Logs",
    "The dedicated system audit trail viewer will be implemented in a future phase.",
    "Audit Logs"
  ),
  settings: placeholder(
    "Settings",
    "Settings",
    "Developer settings will be implemented in a future phase.",
    "Settings"
  )
};
