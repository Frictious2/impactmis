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
      moduleCatalog: getModuleCatalog(),
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
      formAction: `/developer/tenants/${tenant.id}/licenses`,
      formTitle: "Issue / Renew License",
      formDescription: `Create a new license for ${tenant.name}.`,
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
        formAction: `/developer/tenants/${tenant.id}/licenses`,
        formTitle: "Issue / Renew License",
        formDescription: `Create a new license for ${tenant.name}.`,
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

async function showEditLicense(req, res, next) {
  try {
    const [tenant, license] = await Promise.all([
      tenantRepo.findById(req.params.tenantId),
      licenseRepo.findByIdForTenant(req.params.tenantId, req.params.licenseId)
    ]);

    if (!tenant || !license) {
      return res.status(404).render("pages/errors/404", {
        pageTitle: "License Not Found"
      });
    }

    return res.render("layouts/developer-layout", {
      pageTitle: "Edit License",
      contentPartial: "../pages/developer/tenants/license-form",
      breadcrumbs: [
        { label: "Dashboard", href: "/developer/dashboard" },
        { label: "Tenants", href: "/developer/tenants" },
        { label: tenant.name, href: `/developer/tenants/${tenant.id}` },
        { label: "Edit License" }
      ],
      tenant,
      license,
      moduleCatalog: getModuleCatalog(),
      formData: buildLicenseFormData(license),
      formAction: `/developer/tenants/${tenant.id}/licenses/${license.id}/edit`,
      formTitle: "Edit Modules / License",
      formDescription: `Update license details and module access for ${tenant.name}.`,
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function updateLicense(req, res, next) {
  try {
    const [tenant, license] = await Promise.all([
      tenantRepo.findById(req.params.tenantId),
      licenseRepo.findByIdForTenant(req.params.tenantId, req.params.licenseId)
    ]);

    if (!tenant || !license) {
      return res.status(404).render("pages/errors/404", {
        pageTitle: "License Not Found"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/developer-layout", {
        pageTitle: "Edit License",
        contentPartial: "../pages/developer/tenants/license-form",
        breadcrumbs: [
          { label: "Dashboard", href: "/developer/dashboard" },
          { label: "Tenants", href: "/developer/tenants" },
          { label: tenant.name, href: `/developer/tenants/${tenant.id}` },
          { label: "Edit License" }
        ],
        tenant,
        license,
        moduleCatalog: getModuleCatalog(),
        formData: buildLicenseFormData(req.body),
        formAction: `/developer/tenants/${tenant.id}/licenses/${license.id}/edit`,
        formTitle: "Edit Modules / License",
        formDescription: `Update license details and module access for ${tenant.name}.`,
        validationErrors: errors.array()
      });
    }

    await tenantOnboardingService.updateLicense({
      tenantId: tenant.id,
      licenseId: license.id,
      actor: req.currentUser,
      ipAddress: req.ip,
      payload: req.body
    });

    req.flash("success", `License modules were updated for ${tenant.name}.`);
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

async function auditLogs(req, res, next) {
  try {
    const filters = {
      tenant_id: req.query.tenant_id || "",
      action: req.query.action || ""
    };
    const [logs, tenantsList] = await Promise.all([
      auditLogRepo.listDeveloperAuditLogs(filters, 200),
      tenantRepo.listForDeveloper({})
    ]);

    return res.render("layouts/developer-layout", {
      pageTitle: "System / Developer Audit Logs",
      contentPartial: "../pages/developer/audit-logs",
      breadcrumbs: [{ label: "Dashboard", href: "/developer/dashboard" }, { label: "Audit Logs" }],
      logs,
      tenants: tenantsList,
      filters
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  dashboard,
  tenants,
  showCreateTenant,
  createTenant,
  showTenantDetail,
  showNewLicense,
  createLicense,
  showEditLicense,
  updateLicense,
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
  auditLogs,
  settings: placeholder(
    "Settings",
    "Settings",
    "Developer settings will be implemented in a future phase.",
    "Settings"
  )
};
