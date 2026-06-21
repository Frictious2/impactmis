const path = require("path");
const { validationResult } = require("express-validator");
const tenantRepo = require("../repos/tenant.repo");
const organizationProfileRepo = require("../repos/organization-profile.repo");
const departmentRepo = require("../repos/department.repo");
const userRepo = require("../repos/user.repo");
const roleRepo = require("../repos/role.repo");
const approvalWorkflowRepo = require("../repos/approval-workflow.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const branchRepo = require("../repos/branch.repo");
const projectRepo = require("../repos/project.repo");
const activityReportRepo = require("../repos/activity-report.repo");
const indicatorRepo = require("../repos/indicator.repo");
const budgetRepo = require("../repos/budget.repo");
const attendanceRepo = require("../repos/attendance.repo");
const expenseRepo = require("../repos/expense.repo");
const payrollRepo = require("../repos/payroll.repo");
const staffService = require("../services/staff.service");
const attendanceService = require("../services/attendance.service");
const branchService = require("../services/branch.service");
const projectService = require("../services/project.service");
const activityReportService = require("../services/activity-report.service");
const indicatorService = require("../services/indicator.service");
const notificationService = require("../services/notification.service");
const expenseService = require("../services/expense.service");
const payrollService = require("../services/payroll.service");
const staffRepo = require("../repos/staff.repo");
const tenantAdminService = require("../services/tenant-admin.service");
const {
  buildOrganizationProfileFormData,
  buildDepartmentFormData,
  buildTenantUserFormData,
  buildApprovalWorkflowFormData,
  getMonthOptions
} = require("../utils/tenant-settings-form");
const {
  buildStaffFormData,
  getEmploymentTypeOptions,
  getStatusOptions
} = require("../utils/staff-form");
const {
  buildBranchFormData,
  buildBranchFilters,
  getBranchStatusOptions
} = require("../utils/branch-form");
const {
  buildAttendanceFormData,
  buildAttendanceFilters,
  getAttendanceStatusOptions,
  getAttendanceApprovalOptions
} = require("../utils/attendance-form");
const {
  buildActivityReportFilters,
  buildActivityReportFormData,
  getActivityReportTypeOptions,
  getActivityReportStatusOptions
} = require("../utils/activity-report-form");
const {
  buildIndicatorFormData,
  buildIndicatorUpdateFormData,
  getIndicatorStatusOptions
} = require("../utils/indicator-form");
const {
  buildProjectFilters,
  buildProjectFormData,
  buildProjectAssignmentFormData,
  buildProjectTaskFormData,
  getProjectStatusOptions,
  getTaskPriorityOptions,
  getTaskStatusOptions
} = require("../utils/project-form");

function placeholder(pageTitle, heading, description, breadcrumbLabel) {
  return (req, res) =>
    res.render("layouts/tenant-layout", {
      pageTitle,
      contentPartial: "../pages/tenant/placeholder",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: breadcrumbLabel }],
      heading,
      description
    });
}

function isAttendanceApprover(user) {
  return attendanceService.APPROVER_ROLES.has(user.role);
}

function canApproveActivityReport(user, report) {
  if (!user || !report) {
    return false;
  }
  if (activityReportService.APPROVER_ROLES.has(user.role)) {
    return true;
  }
  return user.role === activityReportService.HR_ROLE && Boolean(report.staff_member_id);
}

function parseLicenseModules(license) {
  const rawModules = license?.modules_json;
  if (!rawModules) {
    return {};
  }

  if (typeof rawModules === "object") {
    return rawModules;
  }

  try {
    return JSON.parse(rawModules);
  } catch (_) {
    return {};
  }
}

function hasLicensedModule(req, moduleCode) {
  const modules = parseLicenseModules(req.activeLicense);
  if (Array.isArray(modules)) {
    return modules.includes(moduleCode);
  }

  if (!modules || typeof modules !== "object") {
    return false;
  }

  const rawValue = modules[moduleCode];
  return !(
    rawValue === false ||
    rawValue === "false" ||
    rawValue === 0 ||
    rawValue === "0" ||
    rawValue === "disabled" ||
    rawValue === "off" ||
    typeof rawValue === "undefined"
  );
}

function renderNotFound(res, title) {
  return res.status(404).render("pages/errors/404", { pageTitle: title });
}

async function dashboard(req, res, next) {
  try {
    if (req.currentUser.role === "Tenant Admin" && req.activeLicense?.expires_at) {
      const expiresAt = new Date(req.activeLicense.expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry >= 0 && daysUntilExpiry <= 14) {
        notificationService.safeUserNotificationOnceToday(req.currentUser.tenant_id, req.currentUser.id, {
          title: "License expiring soon",
          message: `Your license expires in ${daysUntilExpiry} day(s).`,
          type: "warning",
          category: "license",
          link_url: "/dashboard",
          created_by: null
        });
      }
    }
    const stats = await tenantRepo.getTenantDashboardStats(req.currentUser.tenant_id);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Dashboard",
      contentPartial: "../pages/tenant/dashboard",
      breadcrumbs: [{ label: "Dashboard" }],
      stats
    });
  } catch (error) {
    return next(error);
  }
}

function licenseExpired(req, res) {
  return res.render("layouts/tenant-layout", {
    pageTitle: "License Expired",
    contentPartial: "../pages/tenant/license-expired",
    breadcrumbs: [{ label: "License Expired" }],
    tenantAccessIssue: req.currentTenant && req.currentTenant.status === "suspended" ? "suspended" : "license_expired"
  });
}

async function staff(req, res, next) {
  try {
    const filters = {
      search: req.query.search || "",
      department_id: req.query.department_id || "",
      employment_type: req.query.employment_type || "",
      status: req.query.status || ""
    };
    const [staffMembers, departmentsList] = await Promise.all([
      staffService.listStaff(req.currentUser.tenant_id, filters),
      departmentRepo.listByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Staff & Volunteers",
      contentPartial: "../pages/tenant/staff/index",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Staff & Volunteers" }],
      staffMembers,
      departments: departmentsList,
      filters,
      employmentTypeOptions: getEmploymentTypeOptions(),
      statusOptions: getStatusOptions()
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateStaff(req, res, next) {
  try {
    const [departmentsList, branches, users] = await Promise.all([
      departmentRepo.listByTenantId(req.currentUser.tenant_id),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      userRepo.listActiveByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Staff Record",
      contentPartial: "../pages/tenant/staff/create",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Staff & Volunteers", href: "/staff" },
        { label: "Create Staff Record" }
      ],
      formData: buildStaffFormData({ status: "active", start_date: new Date().toISOString().slice(0, 10) }),
      departments: departmentsList,
      branches,
      users,
      employmentTypeOptions: getEmploymentTypeOptions(),
      statusOptions: getStatusOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createStaff(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const [departmentsList, branches, users] = await Promise.all([
        departmentRepo.listByTenantId(req.currentUser.tenant_id),
        branchRepo.listByTenantId(req.currentUser.tenant_id),
        userRepo.listActiveByTenantId(req.currentUser.tenant_id)
      ]);
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Create Staff Record",
        contentPartial: "../pages/tenant/staff/create",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Staff & Volunteers", href: "/staff" },
          { label: "Create Staff Record" }
        ],
        formData: buildStaffFormData(req.body),
        departments: departmentsList,
        branches,
        users,
        employmentTypeOptions: getEmploymentTypeOptions(),
        statusOptions: getStatusOptions(),
        validationErrors: errors.array()
      });
    }

    const staffMember = await staffService.createStaff(
      req.currentUser.tenant_id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", `${staffMember.full_name} was created successfully.`);
    return res.redirect(`/staff/${staffMember.id}`);
  } catch (error) {
    return next(error);
  }
}

async function showStaffDetail(req, res, next) {
  try {
    const staffMember = await staffService.findStaffById(req.currentUser.tenant_id, req.params.id);
    if (!staffMember) {
      return renderNotFound(res, "Staff Record Not Found");
    }

    return res.render("layouts/tenant-layout", {
      pageTitle: staffMember.full_name,
      contentPartial: "../pages/tenant/staff/show",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Staff & Volunteers", href: "/staff" },
        { label: staffMember.full_name }
      ],
      staffMember,
      statusOptions: getStatusOptions()
    });
  } catch (error) {
    return next(error);
  }
}

async function showEditStaff(req, res, next) {
  try {
    const [staffMember, departmentsList, branches, users] = await Promise.all([
      staffService.findStaffById(req.currentUser.tenant_id, req.params.id),
      departmentRepo.listByTenantId(req.currentUser.tenant_id),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      userRepo.listActiveByTenantId(req.currentUser.tenant_id)
    ]);

    if (!staffMember) {
      return renderNotFound(res, "Staff Record Not Found");
    }

    return res.render("layouts/tenant-layout", {
      pageTitle: `Edit ${staffMember.full_name}`,
      contentPartial: "../pages/tenant/staff/edit",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Staff & Volunteers", href: "/staff" },
        { label: staffMember.full_name, href: `/staff/${staffMember.id}` },
        { label: "Edit" }
      ],
      formData: buildStaffFormData(staffMember),
      departments: departmentsList,
      branches,
      users,
      employmentTypeOptions: getEmploymentTypeOptions(),
      statusOptions: getStatusOptions(),
      validationErrors: [],
      staffMember
    });
  } catch (error) {
    return next(error);
  }
}

async function updateStaff(req, res, next) {
  try {
    const [staffMember, departmentsList, branches, users] = await Promise.all([
      staffService.findStaffById(req.currentUser.tenant_id, req.params.id),
      departmentRepo.listByTenantId(req.currentUser.tenant_id),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      userRepo.listActiveByTenantId(req.currentUser.tenant_id)
    ]);

    if (!staffMember) {
      return renderNotFound(res, "Staff Record Not Found");
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: `Edit ${staffMember.full_name}`,
        contentPartial: "../pages/tenant/staff/edit",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Staff & Volunteers", href: "/staff" },
          { label: staffMember.full_name, href: `/staff/${staffMember.id}` },
          { label: "Edit" }
        ],
        formData: buildStaffFormData(req.body),
        departments: departmentsList,
        branches,
        users,
        employmentTypeOptions: getEmploymentTypeOptions(),
        statusOptions: getStatusOptions(),
        validationErrors: errors.array(),
        staffMember
      });
    }

    const updated = await staffService.updateStaff(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", `${updated.full_name} was updated successfully.`);
    return res.redirect(`/staff/${updated.id}`);
  } catch (error) {
    return next(error);
  }
}

async function updateStaffStatus(req, res, next) {
  try {
    const allowedStatuses = new Set(getStatusOptions().map((option) => option.value));
    if (!allowedStatuses.has(req.body.next_status)) {
      req.flash("error", "Selected status is invalid.");
      return res.redirect(`/staff/${req.params.id}`);
    }

    const updated = await staffService.changeStaffStatus(
      req.currentUser.tenant_id,
      req.params.id,
      req.body.next_status,
      req.body.status_end_date,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", `${updated.full_name} status changed to ${updated.status}.`);
    return res.redirect(`/staff/${updated.id}`);
  } catch (error) {
    return next(error);
  }
}

async function branches(req, res, next) {
  try {
    const filters = buildBranchFilters(req.query);
    const branchList = await branchRepo.listByTenantId(req.currentUser.tenant_id, filters);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Branches",
      contentPartial: "../pages/tenant/branches/index",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Branches" }],
      branches: branchList,
      filters,
      statusOptions: getBranchStatusOptions()
    });
  } catch (error) {
    return next(error);
  }
}

function showCreateBranch(req, res) {
  return res.render("layouts/tenant-layout", {
    pageTitle: "Create Branch",
    contentPartial: "../pages/tenant/branches/create",
    breadcrumbs: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Branches", href: "/branches" },
      { label: "Create Branch" }
    ],
    formData: buildBranchFormData(),
    statusOptions: getBranchStatusOptions(),
    validationErrors: []
  });
}

async function createBranch(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Create Branch",
        contentPartial: "../pages/tenant/branches/create",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Branches", href: "/branches" },
          { label: "Create Branch" }
        ],
        formData: buildBranchFormData(req.body),
        statusOptions: getBranchStatusOptions(),
        validationErrors: errors.array()
      });
    }

    const branch = await branchService.createBranch(
      req.currentUser.tenant_id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Branch created successfully.");
    return res.redirect(`/branches/${branch.id}`);
  } catch (error) {
    return next(error);
  }
}

async function showBranchDetail(req, res, next) {
  try {
    const branch = await branchRepo.findByIdForTenant(req.params.id, req.currentUser.tenant_id);
    if (!branch) {
      return renderNotFound(res, "Branch Not Found");
    }

    return res.render("layouts/tenant-layout", {
      pageTitle: branch.name,
      contentPartial: "../pages/tenant/branches/show",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Branches", href: "/branches" },
        { label: branch.name }
      ],
      branch,
      statusOptions: getBranchStatusOptions()
    });
  } catch (error) {
    return next(error);
  }
}

async function showEditBranch(req, res, next) {
  try {
    const branch = await branchRepo.findByIdForTenant(req.params.id, req.currentUser.tenant_id);
    if (!branch) {
      return renderNotFound(res, "Branch Not Found");
    }

    return res.render("layouts/tenant-layout", {
      pageTitle: `Edit ${branch.name}`,
      contentPartial: "../pages/tenant/branches/edit",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Branches", href: "/branches" },
        { label: branch.name, href: `/branches/${branch.id}` },
        { label: "Edit" }
      ],
      formData: buildBranchFormData(branch),
      statusOptions: getBranchStatusOptions(),
      validationErrors: [],
      branch
    });
  } catch (error) {
    return next(error);
  }
}

async function updateBranch(req, res, next) {
  try {
    const branch = await branchRepo.findByIdForTenant(req.params.id, req.currentUser.tenant_id);
    if (!branch) {
      return renderNotFound(res, "Branch Not Found");
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: `Edit ${branch.name}`,
        contentPartial: "../pages/tenant/branches/edit",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Branches", href: "/branches" },
          { label: branch.name, href: `/branches/${branch.id}` },
          { label: "Edit" }
        ],
        formData: buildBranchFormData(req.body),
        statusOptions: getBranchStatusOptions(),
        validationErrors: errors.array(),
        branch
      });
    }

    const updated = await branchService.updateBranch(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Branch updated successfully.");
    return res.redirect(`/branches/${updated.id}`);
  } catch (error) {
    return next(error);
  }
}

async function updateBranchStatus(req, res, next) {
  try {
    const nextStatus = String(req.body.next_status || "").trim();
    if (!new Set(["active", "inactive"]).has(nextStatus)) {
      req.flash("error", "Selected branch status is invalid.");
      return res.redirect(`/branches/${req.params.id}`);
    }

    const updated = await branchService.updateBranchStatus(
      req.currentUser.tenant_id,
      req.params.id,
      nextStatus,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", `Branch status changed to ${updated.status}.`);
    return res.redirect(`/branches/${updated.id}`);
  } catch (error) {
    return next(error);
  }
}

async function attendance(req, res, next) {
  try {
    const filters = buildAttendanceFilters(req.query);
    const [records, staffMembers, departmentsList] = await Promise.all([
      attendanceService.listAttendance(req.currentUser.tenant_id, filters),
      staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id),
      departmentRepo.listByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Attendance",
      contentPartial: "../pages/tenant/attendance/index",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Attendance" }],
      records,
      staffMembers,
      departments: departmentsList,
      filters,
      attendanceStatusOptions: getAttendanceStatusOptions(),
      approvalOptions: getAttendanceApprovalOptions()
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateAttendance(req, res, next) {
  try {
    const staffMembers = await staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Attendance Entry",
      contentPartial: "../pages/tenant/attendance/create",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Attendance", href: "/attendance" },
        { label: "Single Entry" }
      ],
      formData: buildAttendanceFormData({
        attendance_date: new Date().toISOString().slice(0, 10),
        status: "present",
        approval_status: "submitted"
      }),
      staffMembers,
      attendanceStatusOptions: getAttendanceStatusOptions(),
      approvalOptions: getAttendanceApprovalOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createAttendance(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const staffMembers = await staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id);
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Create Attendance Entry",
        contentPartial: "../pages/tenant/attendance/create",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Attendance", href: "/attendance" },
          { label: "Single Entry" }
        ],
        formData: buildAttendanceFormData(req.body),
        staffMembers,
        attendanceStatusOptions: getAttendanceStatusOptions(),
        approvalOptions: getAttendanceApprovalOptions(),
        validationErrors: errors.array()
      });
    }

    const record = await attendanceService.createOrUpdateAttendance(
      req.currentUser.tenant_id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Attendance entry saved successfully.");
    return res.redirect(`/attendance/${record.id}`);
  } catch (error) {
    return next(error);
  }
}

async function showBulkAttendance(req, res, next) {
  try {
    const staffMembers = await staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Bulk Attendance Entry",
      contentPartial: "../pages/tenant/attendance/bulk",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Attendance", href: "/attendance" },
        { label: "Bulk Entry" }
      ],
      attendanceDate: req.query.attendance_date || new Date().toISOString().slice(0, 10),
      staffMembers,
      attendanceStatusOptions: getAttendanceStatusOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createBulkAttendance(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const staffMembers = await staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id);
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Bulk Attendance Entry",
        contentPartial: "../pages/tenant/attendance/bulk",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Attendance", href: "/attendance" },
          { label: "Bulk Entry" }
        ],
        attendanceDate: req.body.attendance_date,
        staffMembers,
        attendanceStatusOptions: getAttendanceStatusOptions(),
        validationErrors: errors.array()
      });
    }

    await attendanceService.bulkCreateAttendance(
      req.currentUser.tenant_id,
      req.body.attendance_date,
      req.body.entries,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Bulk attendance saved successfully.");
    return res.redirect("/attendance");
  } catch (error) {
    return next(error);
  }
}

async function showSelfCheckin(req, res, next) {
  try {
    const linkedStaffMember = await staffRepo.findActiveByEmailForTenant(
      req.currentUser.tenant_id,
      req.currentUser.email
    );
    const branch = linkedStaffMember?.branch_id
      ? await branchRepo.findByIdForTenant(linkedStaffMember.branch_id, req.currentUser.tenant_id)
      : null;

    return res.render("layouts/tenant-layout", {
      pageTitle: "Self Check-In",
      contentPartial: "../pages/tenant/attendance/self-checkin",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Attendance", href: "/attendance" },
        { label: "Self Check-In" }
      ],
      linkedStaffMember,
      branch
    });
  } catch (error) {
    return next(error);
  }
}

async function submitSelfCheckin(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/attendance/self-checkin");
    }

    const record = await attendanceService.selfCheckin(
      req.currentUser.tenant_id,
      req.currentUser,
      req.body,
      req.ip
    );

    req.flash("success", "Self check-in captured successfully.");
    return res.redirect(`/attendance/${record.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/attendance/self-checkin");
    }
    return next(error);
  }
}

async function showAttendanceDetail(req, res, next) {
  try {
    const record = await attendanceService.findAttendanceById(req.currentUser.tenant_id, req.params.id);
    if (!record) {
      return renderNotFound(res, "Attendance Record Not Found");
    }

    return res.render("layouts/tenant-layout", {
      pageTitle: "Attendance Detail",
      contentPartial: "../pages/tenant/attendance/show",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Attendance", href: "/attendance" },
        { label: `${record.staff_name} - ${record.attendance_date}` }
      ],
      record,
      canApprove: isAttendanceApprover(req.currentUser),
      approvalOptions: getAttendanceApprovalOptions()
    });
  } catch (error) {
    return next(error);
  }
}

async function showEditAttendance(req, res, next) {
  try {
    const [record, staffMembers] = await Promise.all([
      attendanceService.findAttendanceById(req.currentUser.tenant_id, req.params.id),
      staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id)
    ]);

    if (!record) {
      return renderNotFound(res, "Attendance Record Not Found");
    }

    return res.render("layouts/tenant-layout", {
      pageTitle: "Edit Attendance",
      contentPartial: "../pages/tenant/attendance/edit",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Attendance", href: "/attendance" },
        { label: `${record.staff_name} - ${record.attendance_date}`, href: `/attendance/${record.id}` },
        { label: "Edit" }
      ],
      formData: buildAttendanceFormData(record),
      staffMembers,
      attendanceStatusOptions: getAttendanceStatusOptions(),
      approvalOptions: getAttendanceApprovalOptions(),
      validationErrors: [],
      record
    });
  } catch (error) {
    return next(error);
  }
}

async function updateAttendance(req, res, next) {
  try {
    const [record, staffMembers] = await Promise.all([
      attendanceService.findAttendanceById(req.currentUser.tenant_id, req.params.id),
      staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id)
    ]);

    if (!record) {
      return renderNotFound(res, "Attendance Record Not Found");
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Edit Attendance",
        contentPartial: "../pages/tenant/attendance/edit",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Attendance", href: "/attendance" },
          { label: `${record.staff_name} - ${record.attendance_date}`, href: `/attendance/${record.id}` },
          { label: "Edit" }
        ],
        formData: buildAttendanceFormData(req.body),
        staffMembers,
        attendanceStatusOptions: getAttendanceStatusOptions(),
        approvalOptions: getAttendanceApprovalOptions(),
        validationErrors: errors.array(),
        record
      });
    }

    const updated = await attendanceService.createOrUpdateAttendance(
      req.currentUser.tenant_id,
      { ...req.body, id: req.params.id },
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Attendance entry updated successfully.");
    return res.redirect(`/attendance/${updated.id}`);
  } catch (error) {
    return next(error);
  }
}

async function approveAttendance(req, res, next) {
  try {
    const updated = await attendanceService.approveAttendance(
      req.currentUser.tenant_id,
      req.params.id,
      req.currentUser,
      req.ip
    );

    req.flash("success", "Attendance approved successfully.");
    return res.redirect(`/attendance/${updated.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/attendance/${req.params.id}`);
    }
    return next(error);
  }
}

async function rejectAttendance(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/attendance/${req.params.id}`);
    }

    const updated = await attendanceService.rejectAttendance(
      req.currentUser.tenant_id,
      req.params.id,
      req.currentUser,
      req.body.rejection_reason,
      req.ip
    );

    req.flash("success", "Attendance rejected successfully.");
    return res.redirect(`/attendance/${updated.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/attendance/${req.params.id}`);
    }
    return next(error);
  }
}

async function loadProjectDetailContext(req, projectId, overrides = {}) {
  const tenantId = req.currentUser.tenant_id;
  const [project, assignments, tasks, activity, branches, managers, staffMembers, indicators, projectReports, budgetSummary] =
    await Promise.all([
    projectService.findProject(tenantId, projectId),
    projectService.listAssignments(tenantId, projectId),
    projectRepo.listTasks(tenantId, projectId),
    auditLogRepo.listProjectActivityByTenantId(tenantId, projectId, 50),
    branchRepo.listByTenantId(tenantId),
    userRepo.listActiveByTenantId(tenantId),
    staffRepo.listActiveAttendanceEligibleByTenantId(tenantId),
    indicatorService.listIndicators(tenantId, projectId),
    activityReportRepo.listByProjectId(tenantId, projectId, 10),
    budgetRepo.getProjectBudgetSummary(tenantId, projectId)
  ]);

  if (!project) {
    return null;
  }

  return {
    pageTitle: project.project_name,
    contentPartial: "../pages/tenant/projects/show",
    breadcrumbs: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Projects", href: "/projects" },
      { label: project.project_name }
    ],
    project,
    assignments,
    tasks,
    activity,
    branches,
    managers,
    staffMembers,
    indicators,
    projectReports,
    budgetSummary,
    projectStatusOptions: getProjectStatusOptions(),
    taskPriorityOptions: getTaskPriorityOptions(),
    taskStatusOptions: getTaskStatusOptions(),
    indicatorStatusOptions: getIndicatorStatusOptions(),
    assignmentFormData: buildProjectAssignmentFormData(),
    taskFormData: buildProjectTaskFormData(),
    indicatorFormData: buildIndicatorFormData(),
    indicatorUpdateFormData: buildIndicatorUpdateFormData(),
    assignmentValidationErrors: [],
    taskValidationErrors: [],
    indicatorValidationErrors: [],
    indicatorUpdateValidationErrors: [],
    activeTab: "overview",
    ...overrides
  };
}

async function projects(req, res, next) {
  try {
    const filters = buildProjectFilters(req.query);
    const [projectsList, branches, managers] = await Promise.all([
      projectService.listProjects(req.currentUser.tenant_id, filters),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      userRepo.listActiveByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Projects",
      contentPartial: "../pages/tenant/projects/index",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Projects" }],
      projects: projectsList,
      branches,
      managers,
      filters,
      statusOptions: getProjectStatusOptions()
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateProject(req, res, next) {
  try {
    const [branches, managers] = await Promise.all([
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      userRepo.listActiveByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Project",
      contentPartial: "../pages/tenant/projects/create",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Projects", href: "/projects" },
        { label: "Create Project" }
      ],
      formData: buildProjectFormData({
        status: "planning",
        start_date: new Date().toISOString().slice(0, 10),
        completion_percentage: 0
      }),
      branches,
      managers,
      statusOptions: getProjectStatusOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createProject(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const [branches, managers] = await Promise.all([
        branchRepo.listByTenantId(req.currentUser.tenant_id),
        userRepo.listActiveByTenantId(req.currentUser.tenant_id)
      ]);

      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Create Project",
        contentPartial: "../pages/tenant/projects/create",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/projects" },
          { label: "Create Project" }
        ],
        formData: buildProjectFormData(req.body),
        branches,
        managers,
        statusOptions: getProjectStatusOptions(),
        validationErrors: errors.array()
      });
    }

    const project = await projectService.createProject(
      req.currentUser.tenant_id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Project created successfully.");
    return res.redirect(`/projects/${project.id}`);
  } catch (error) {
    return next(error);
  }
}

async function showProjectDetail(req, res, next) {
  try {
    const viewModel = await loadProjectDetailContext(req, req.params.id, {
      activeTab: req.query.tab || "overview"
    });

    if (!viewModel) {
      return renderNotFound(res, "Project Not Found");
    }

    return res.render("layouts/tenant-layout", viewModel);
  } catch (error) {
    return next(error);
  }
}

async function showEditProject(req, res, next) {
  try {
    const [project, branches, managers] = await Promise.all([
      projectService.findProject(req.currentUser.tenant_id, req.params.id),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      userRepo.listActiveByTenantId(req.currentUser.tenant_id)
    ]);

    if (!project) {
      return renderNotFound(res, "Project Not Found");
    }

    return res.render("layouts/tenant-layout", {
      pageTitle: `Edit ${project.project_name}`,
      contentPartial: "../pages/tenant/projects/edit",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Projects", href: "/projects" },
        { label: project.project_name, href: `/projects/${project.id}` },
        { label: "Edit" }
      ],
      project,
      formData: buildProjectFormData(project),
      branches,
      managers,
      statusOptions: getProjectStatusOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProject(req, res, next) {
  try {
    const [project, branches, managers] = await Promise.all([
      projectService.findProject(req.currentUser.tenant_id, req.params.id),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      userRepo.listActiveByTenantId(req.currentUser.tenant_id)
    ]);

    if (!project) {
      return renderNotFound(res, "Project Not Found");
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: `Edit ${project.project_name}`,
        contentPartial: "../pages/tenant/projects/edit",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/projects" },
          { label: project.project_name, href: `/projects/${project.id}` },
          { label: "Edit" }
        ],
        project,
        formData: buildProjectFormData(req.body),
        branches,
        managers,
        statusOptions: getProjectStatusOptions(),
        validationErrors: errors.array()
      });
    }

    const updated = await projectService.updateProject(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Project updated successfully.");
    return res.redirect(`/projects/${updated.id}`);
  } catch (error) {
    return next(error);
  }
}

async function updateProjectStatus(req, res, next) {
  try {
    const allowedStatuses = new Set(getProjectStatusOptions().map((option) => option.value));
    const nextStatus = String(req.body.next_status || "").trim();

    if (!allowedStatuses.has(nextStatus)) {
      req.flash("error", "Selected project status is invalid.");
      return res.redirect(`/projects/${req.params.id}`);
    }

    const updated = await projectService.changeProjectStatus(
      req.currentUser.tenant_id,
      req.params.id,
      nextStatus,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", `Project status changed to ${updated.status}.`);
    return res.redirect(`/projects/${updated.id}?tab=overview`);
  } catch (error) {
    return next(error);
  }
}

async function assignProjectStaff(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const viewModel = await loadProjectDetailContext(req, req.params.id, {
        activeTab: "assignments",
        assignmentFormData: buildProjectAssignmentFormData(req.body),
        assignmentValidationErrors: errors.array()
      });

      if (!viewModel) {
        return renderNotFound(res, "Project Not Found");
      }

      return res.status(422).render("layouts/tenant-layout", viewModel);
    }

    await projectService.assignStaff(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Staff assigned to project successfully.");
    return res.redirect(`/projects/${req.params.id}?tab=assignments`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/projects/${req.params.id}?tab=assignments`);
    }
    return next(error);
  }
}

async function removeProjectAssignment(req, res, next) {
  try {
    if (!req.body.assignment_id) {
      req.flash("error", "Assignment selection is required.");
      return res.redirect(`/projects/${req.params.id}?tab=assignments`);
    }

    await projectService.removeStaff(
      req.currentUser.tenant_id,
      req.params.id,
      req.body.assignment_id,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Project assignment removed successfully.");
    return res.redirect(`/projects/${req.params.id}?tab=assignments`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/projects/${req.params.id}?tab=assignments`);
    }
    return next(error);
  }
}

async function createProjectTask(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const viewModel = await loadProjectDetailContext(req, req.params.id, {
        activeTab: "tasks",
        taskFormData: buildProjectTaskFormData(req.body),
        taskValidationErrors: errors.array()
      });

      if (!viewModel) {
        return renderNotFound(res, "Project Not Found");
      }

      return res.status(422).render("layouts/tenant-layout", viewModel);
    }

    await projectService.createTask(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Project task created successfully.");
    return res.redirect(`/projects/${req.params.id}?tab=tasks`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/projects/${req.params.id}?tab=tasks`);
    }
    return next(error);
  }
}

async function updateProjectTask(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const task = await projectRepo.findTask(req.currentUser.tenant_id, req.params.id);
      if (!task) {
        return renderNotFound(res, "Project Task Not Found");
      }

      const viewModel = await loadProjectDetailContext(req, task.project_id, {
        activeTab: "tasks",
        taskFormData: buildProjectTaskFormData(req.body),
        taskValidationErrors: errors.array()
      });

      return res.status(422).render("layouts/tenant-layout", viewModel);
    }

    const updated = await projectService.updateTask(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Project task updated successfully.");
    return res.redirect(`/projects/${updated.project_id}?tab=tasks`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/projects");
    }
    return next(error);
  }
}

async function updateProjectTaskStatus(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/projects");
    }

    const updated = await projectService.updateTaskStatus(
      req.currentUser.tenant_id,
      req.params.id,
      req.body.status,
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Project task status updated successfully.");
    return res.redirect(`/projects/${updated.project_id}?tab=tasks`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/projects");
    }
    return next(error);
  }
}

async function activityReports(req, res, next) {
  try {
    const filters = buildActivityReportFilters(req.query);
    const [reports, projectsList, branches, staffMembers] = await Promise.all([
      activityReportService.listReports(req.currentUser.tenant_id, filters),
      projectService.listProjects(req.currentUser.tenant_id, {}),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Activity Reports",
      contentPartial: "../pages/tenant/activity-reports/index",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Activity Reports" }],
      reports,
      projects: projectsList,
      branches,
      staffMembers,
      filters,
      reportTypeOptions: getActivityReportTypeOptions(),
      statusOptions: getActivityReportStatusOptions()
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateActivityReport(req, res, next) {
  try {
    const [projectsList, branches, staffMembers] = await Promise.all([
      projectService.listProjects(req.currentUser.tenant_id, {}),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id)
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Activity Report",
      contentPartial: "../pages/tenant/activity-reports/create",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Activity Reports", href: "/activity-reports" },
        { label: "Create Activity Report" }
      ],
      formData: buildActivityReportFormData({
        report_date: new Date().toISOString().slice(0, 10),
        report_type: "daily",
        status: "submitted"
      }),
      projects: projectsList,
      branches,
      staffMembers,
      tasks: [],
      reportTypeOptions: getActivityReportTypeOptions(),
      statusOptions: getActivityReportStatusOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createActivityReport(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const [projectsList, branches, staffMembers, tasks] = await Promise.all([
        projectService.listProjects(req.currentUser.tenant_id, {}),
        branchRepo.listByTenantId(req.currentUser.tenant_id),
        staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id),
        req.body.project_id ? projectRepo.listTasks(req.currentUser.tenant_id, req.body.project_id) : []
      ]);

      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Create Activity Report",
        contentPartial: "../pages/tenant/activity-reports/create",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Activity Reports", href: "/activity-reports" },
          { label: "Create Activity Report" }
        ],
        formData: buildActivityReportFormData(req.body),
        projects: projectsList,
        branches,
        staffMembers,
        tasks,
        reportTypeOptions: getActivityReportTypeOptions(),
        statusOptions: getActivityReportStatusOptions(),
        validationErrors: errors.array()
      });
    }

    const report = await activityReportService.createReport(
      req.currentUser.tenant_id,
      req.body,
      req.currentUser,
      req.ip
    );

    req.flash("success", "Activity report created successfully.");
    return res.redirect(`/activity-reports/${report.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/activity-reports/create");
    }
    return next(error);
  }
}

async function loadActivityReportDetailContext(req, reportId, overrides = {}) {
  const tenantId = req.currentUser.tenant_id;
  const report = await activityReportService.findReportById(tenantId, reportId);
  if (!report) {
    return null;
  }

  const allowedTabs = new Set(["overview", "attachments", "approval", "indicator-updates", "activity"]);
  const [attachments, indicatorUpdates, activity] = await Promise.all([
    activityReportService.listAttachments(tenantId, reportId),
    activityReportService.listReportIndicatorUpdates(tenantId, reportId),
    auditLogRepo.listActivityReportActivityByTenantId(tenantId, reportId, 100)
  ]);

  return {
    pageTitle: report.title,
    contentPartial: "../pages/tenant/activity-reports/show",
    breadcrumbs: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Activity Reports", href: "/activity-reports" },
      { label: report.title }
    ],
    report,
    attachments: attachments || [],
    indicatorUpdates: indicatorUpdates || [],
    activity: activity || [],
    canApprove: canApproveActivityReport(req.currentUser, report),
    ...overrides,
    activeTab: allowedTabs.has(overrides.activeTab) ? overrides.activeTab : "overview"
  };
}

async function showActivityReportDetail(req, res, next) {
  try {
    const viewModel = await loadActivityReportDetailContext(req, req.params.id, {
      activeTab: req.query.tab || "overview"
    });
    if (!viewModel) {
      return renderNotFound(res, "Activity Report Not Found");
    }
    return res.render("layouts/tenant-layout", viewModel);
  } catch (error) {
    return next(error);
  }
}

async function showEditActivityReport(req, res, next) {
  try {
    const report = await activityReportService.findReportById(req.currentUser.tenant_id, req.params.id);
    if (!report) {
      return renderNotFound(res, "Activity Report Not Found");
    }

    const [projectsList, branches, staffMembers, tasks] = await Promise.all([
      projectService.listProjects(req.currentUser.tenant_id, {}),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id),
      projectRepo.listTasks(req.currentUser.tenant_id, report.project_id)
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: `Edit ${report.title}`,
      contentPartial: "../pages/tenant/activity-reports/edit",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Activity Reports", href: "/activity-reports" },
        { label: report.title, href: `/activity-reports/${report.id}` },
        { label: "Edit" }
      ],
      report,
      formData: buildActivityReportFormData(report),
      projects: projectsList,
      branches,
      staffMembers,
      tasks,
      reportTypeOptions: getActivityReportTypeOptions(),
      statusOptions: getActivityReportStatusOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function updateActivityReport(req, res, next) {
  try {
    const report = await activityReportService.findReportById(req.currentUser.tenant_id, req.params.id);
    if (!report) {
      return renderNotFound(res, "Activity Report Not Found");
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const [projectsList, branches, staffMembers, tasks] = await Promise.all([
        projectService.listProjects(req.currentUser.tenant_id, {}),
        branchRepo.listByTenantId(req.currentUser.tenant_id),
        staffRepo.listActiveAttendanceEligibleByTenantId(req.currentUser.tenant_id),
        req.body.project_id ? projectRepo.listTasks(req.currentUser.tenant_id, req.body.project_id) : []
      ]);

      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: `Edit ${report.title}`,
        contentPartial: "../pages/tenant/activity-reports/edit",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Activity Reports", href: "/activity-reports" },
          { label: report.title, href: `/activity-reports/${report.id}` },
          { label: "Edit" }
        ],
        report,
        formData: buildActivityReportFormData(req.body),
        projects: projectsList,
        branches,
        staffMembers,
        tasks,
        reportTypeOptions: getActivityReportTypeOptions(),
        statusOptions: getActivityReportStatusOptions(),
        validationErrors: errors.array()
      });
    }

    const updated = await activityReportService.updateReport(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser,
      req.ip
    );

    req.flash("success", "Activity report updated successfully.");
    return res.redirect(`/activity-reports/${updated.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/activity-reports/${req.params.id}/edit`);
    }
    return next(error);
  }
}

async function submitActivityReport(req, res, next) {
  try {
    const updated = await activityReportService.submitReport(
      req.currentUser.tenant_id,
      req.params.id,
      req.currentUser.id,
      req.ip
    );
    req.flash("success", "Activity report submitted successfully.");
    return res.redirect(`/activity-reports/${updated.id}?tab=approval`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/activity-reports/${req.params.id}`);
    }
    return next(error);
  }
}

async function approveActivityReport(req, res, next) {
  try {
    const updated = await activityReportService.approveReport(
      req.currentUser.tenant_id,
      req.params.id,
      req.currentUser,
      req.ip
    );
    req.flash("success", "Activity report approved successfully.");
    return res.redirect(`/activity-reports/${updated.id}?tab=approval`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/activity-reports/${req.params.id}?tab=approval`);
    }
    return next(error);
  }
}

async function rejectActivityReport(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/activity-reports/${req.params.id}?tab=approval`);
    }
    const updated = await activityReportService.rejectReport(
      req.currentUser.tenant_id,
      req.params.id,
      req.currentUser,
      req.body.rejection_reason,
      req.ip
    );
    req.flash("success", "Activity report rejected successfully.");
    return res.redirect(`/activity-reports/${updated.id}?tab=approval`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/activity-reports/${req.params.id}?tab=approval`);
    }
    return next(error);
  }
}

async function addActivityReportAttachment(req, res, next) {
  try {
    if (!req.file) {
      req.flash("error", "Please choose an image or PDF attachment.");
      return res.redirect(`/activity-reports/${req.params.id}?tab=attachments`);
    }

    const relativePath = path.join(
      "uploads",
      "activity-reports",
      String(req.currentUser.tenant_id),
      req.file.filename
    ).replace(/\\/g, "/");

    await activityReportService.addAttachment(
      req.currentUser.tenant_id,
      req.params.id,
      {
        original_name: req.file.originalname,
        stored_name: req.file.filename,
        file_path: `/${relativePath}`,
        mime_type: req.file.mimetype,
        file_size: req.file.size
      },
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Attachment uploaded successfully.");
    return res.redirect(`/activity-reports/${req.params.id}?tab=attachments`);
  } catch (error) {
    if (req.file && req.file.path) {
      try {
        require("fs").unlinkSync(req.file.path);
      } catch (_) {}
    }
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/activity-reports/${req.params.id}?tab=attachments`);
    }
    return next(error);
  }
}

async function projectIndicators(req, res, next) {
  try {
    const viewModel = await loadProjectDetailContext(req, req.params.id, {
      activeTab: "indicators"
    });
    if (!viewModel) {
      return renderNotFound(res, "Project Not Found");
    }
    return res.render("layouts/tenant-layout", viewModel);
  } catch (error) {
    return next(error);
  }
}

async function createProjectIndicator(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const viewModel = await loadProjectDetailContext(req, req.params.id, {
        activeTab: "indicators",
        indicatorFormData: buildIndicatorFormData(req.body),
        indicatorValidationErrors: errors.array()
      });
      return res.status(422).render("layouts/tenant-layout", viewModel);
    }

    await indicatorService.createIndicator(
      req.currentUser.tenant_id,
      { ...req.body, project_id: req.params.id },
      req.currentUser.id,
      req.ip
    );

    req.flash("success", "Project indicator created successfully.");
    return res.redirect(`/projects/${req.params.id}?tab=indicators`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/projects/${req.params.id}?tab=indicators`);
    }
    return next(error);
  }
}

async function updateProjectIndicator(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/projects");
    }

    const updated = await indicatorService.updateIndicator(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser.id,
      req.ip
    );
    req.flash("success", "Indicator updated successfully.");
    return res.redirect(`/projects/${updated.project_id}?tab=indicators`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      const indicator = await indicatorRepo.findIndicatorById(req.currentUser.tenant_id, req.params.id);
      return res.redirect(indicator ? `/projects/${indicator.project_id}?tab=indicators` : "/projects");
    }
    return next(error);
  }
}

async function updateIndicatorProgress(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/projects");
    }

    const update = await indicatorService.addIndicatorUpdate(
      req.currentUser.tenant_id,
      req.params.id,
      req.body,
      req.currentUser.id,
      req.ip
    );
    const indicator = await indicatorRepo.findIndicatorById(req.currentUser.tenant_id, req.params.id);
    req.flash("success", "Indicator progress updated successfully.");
    return res.redirect(`/projects/${indicator.project_id}?tab=indicators`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      const indicator = await indicatorRepo.findIndicatorById(req.currentUser.tenant_id, req.params.id);
      return res.redirect(indicator ? `/projects/${indicator.project_id}?tab=indicators` : "/projects");
    }
    return next(error);
  }
}

async function approvals(req, res, next) {
  try {
    const tenantId = req.currentUser.tenant_id;
    const enabledModules = {
      attendance: hasLicensedModule(req, "attendance"),
      reports: hasLicensedModule(req, "reports"),
      finance: hasLicensedModule(req, "finance"),
      payroll: hasLicensedModule(req, "payroll")
    };

    const [
      workflow,
      pendingAttendance,
      pendingActivityReports,
      pendingExpenses,
      payrollRuns
    ] = await Promise.all([
      approvalWorkflowRepo.findByTenantId(tenantId),
      enabledModules.attendance ? attendanceRepo.listAttendance(tenantId, { approval_status: "submitted" }) : [],
      enabledModules.reports ? activityReportRepo.listReports(tenantId, { status: "submitted" }) : [],
      enabledModules.finance ? expenseRepo.listExpenses(tenantId, { status: "submitted" }) : [],
      enabledModules.payroll ? payrollRepo.listPayrollRuns(tenantId) : []
    ]);

    const pendingPayrollRuns = payrollRuns.filter((run) => run.status === "submitted");
    const approvalQueues = {
      attendance: pendingAttendance.slice(0, 10),
      activityReports: pendingActivityReports.slice(0, 10),
      expenses: pendingExpenses.slice(0, 10),
      payrollRuns: pendingPayrollRuns.slice(0, 10)
    };
    const approvalCounts = {
      attendance: pendingAttendance.length,
      activityReports: pendingActivityReports.length,
      expenses: pendingExpenses.length,
      payrollRuns: pendingPayrollRuns.length,
      total:
        pendingAttendance.length +
        pendingActivityReports.length +
        pendingExpenses.length +
        pendingPayrollRuns.length
    };

    return res.render("layouts/tenant-layout", {
      pageTitle: "Approvals",
      contentPartial: "../pages/tenant/approvals/index",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Approvals" }],
      workflow,
      enabledModules,
      approvalQueues,
      approvalCounts,
      canApprove: {
        attendance: attendanceService.APPROVER_ROLES.has(req.currentUser.role),
        activityReports: pendingActivityReports.some((report) => canApproveActivityReport(req.currentUser, report)),
        expenses: expenseService.APPROVE_ROLES.has(req.currentUser.role),
        payroll: payrollService.MANAGE_ROLES.has(req.currentUser.role)
      }
    });
  } catch (error) {
    return next(error);
  }
}

function settingsHome(req, res) {
  return res.render("layouts/tenant-layout", {
    pageTitle: "Settings",
    contentPartial: "../pages/tenant/settings/index",
    breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]
  });
}

async function organizationSettings(req, res, next) {
  try {
    const profile = await organizationProfileRepo.findByTenantId(req.currentUser.tenant_id);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Organization Profile",
      contentPartial: "../pages/tenant/settings/organization",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/settings" },
        { label: "Organization Profile" }
      ],
      formData: buildOrganizationProfileFormData(profile),
      monthOptions: getMonthOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function saveOrganizationSettings(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Organization Profile",
        contentPartial: "../pages/tenant/settings/organization",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Organization Profile" }
        ],
        formData: buildOrganizationProfileFormData(req.body),
        monthOptions: getMonthOptions(),
        validationErrors: errors.array()
      });
    }

    await tenantAdminService.saveOrganizationProfile({
      tenantId: req.currentUser.tenant_id,
      actor: req.currentUser,
      ipAddress: req.ip,
      payload: req.body
    });

    req.flash("success", "Organization profile saved successfully.");
    return res.redirect("/settings/organization");
  } catch (error) {
    return next(error);
  }
}

async function departments(req, res, next) {
  try {
    const departmentsList = await departmentRepo.listByTenantId(req.currentUser.tenant_id);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Departments",
      contentPartial: "../pages/tenant/settings/departments",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/settings" },
        { label: "Departments" }
      ],
      departments: departmentsList,
      formData: buildDepartmentFormData(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createDepartment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const departmentsList = await departmentRepo.listByTenantId(req.currentUser.tenant_id);
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Departments",
        contentPartial: "../pages/tenant/settings/departments",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Departments" }
        ],
        departments: departmentsList,
        formData: buildDepartmentFormData(req.body),
        validationErrors: errors.array()
      });
    }

    await tenantAdminService.createDepartment({
      tenantId: req.currentUser.tenant_id,
      actor: req.currentUser,
      ipAddress: req.ip,
      payload: req.body
    });

    req.flash("success", "Department created successfully.");
    return res.redirect("/settings/departments");
  } catch (error) {
    return next(error);
  }
}

async function editDepartment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/settings/departments");
    }

    await tenantAdminService.updateDepartment({
      tenantId: req.currentUser.tenant_id,
      departmentId: req.params.id,
      actor: req.currentUser,
      ipAddress: req.ip,
      payload: req.body
    });

    req.flash("success", "Department updated successfully.");
    return res.redirect("/settings/departments");
  } catch (error) {
    return next(error);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    await tenantAdminService.deleteDepartment({
      tenantId: req.currentUser.tenant_id,
      departmentId: req.params.id,
      actor: req.currentUser,
      ipAddress: req.ip
    });

    req.flash("success", "Department deleted successfully.");
    return res.redirect("/settings/departments");
  } catch (error) {
    return next(error);
  }
}

async function users(req, res, next) {
  try {
    const tenantUsers = await userRepo.listByTenantId(req.currentUser.tenant_id);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Users",
      contentPartial: "../pages/tenant/settings/users/index",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/settings" },
        { label: "Users" }
      ],
      users: tenantUsers
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateUser(req, res, next) {
  try {
    const [departmentsList, roles] = await Promise.all([
      departmentRepo.listByTenantId(req.currentUser.tenant_id),
      roleRepo.listTenantAssignableRoles()
    ]);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Create User",
      contentPartial: "../pages/tenant/settings/users/create",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/settings" },
        { label: "Users", href: "/settings/users" },
        { label: "Create User" }
      ],
      departments: departmentsList,
      roles,
      formData: buildTenantUserFormData(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const [departmentsList, roles] = await Promise.all([
      departmentRepo.listByTenantId(req.currentUser.tenant_id),
      roleRepo.listTenantAssignableRoles()
    ]);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Create User",
        contentPartial: "../pages/tenant/settings/users/create",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Users", href: "/settings/users" },
          { label: "Create User" }
        ],
        departments: departmentsList,
        roles,
        formData: buildTenantUserFormData(req.body),
        validationErrors: errors.array()
      });
    }

    await tenantAdminService.createTenantUser({
      tenantId: req.currentUser.tenant_id,
      actor: req.currentUser,
      ipAddress: req.ip,
      payload: req.body
    });

    req.flash("success", "Tenant user created successfully.");
    return res.redirect("/settings/users");
  } catch (error) {
    return next(error);
  }
}

async function approvalSettings(req, res, next) {
  try {
    const workflow = await approvalWorkflowRepo.findByTenantId(req.currentUser.tenant_id);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Approval Workflow",
      contentPartial: "../pages/tenant/settings/approvals",
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/settings" },
        { label: "Approval Workflow" }
      ],
      formData: buildApprovalWorkflowFormData(workflow || {}),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function saveApprovalSettings(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Approval Workflow",
        contentPartial: "../pages/tenant/settings/approvals",
        breadcrumbs: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Approval Workflow" }
        ],
        formData: buildApprovalWorkflowFormData(req.body),
        validationErrors: errors.array()
      });
    }

    await tenantAdminService.saveApprovalWorkflow({
      tenantId: req.currentUser.tenant_id,
      actor: req.currentUser,
      ipAddress: req.ip,
      payload: req.body
    });

    req.flash("success", "Approval workflow settings saved.");
    return res.redirect("/settings/approvals");
  } catch (error) {
    return next(error);
  }
}

async function auditLogs(req, res, next) {
  try {
    const logs = await auditLogRepo.listTenantAuditLogs(req.currentUser.tenant_id, {}, 100);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Organization Audit Logs",
      contentPartial: "../pages/tenant/audit-logs",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Audit Logs" }],
      logs
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  dashboard,
  staff,
  showCreateStaff,
  createStaff,
  showStaffDetail,
  showEditStaff,
  updateStaff,
  updateStaffStatus,
  branches,
  showCreateBranch,
  createBranch,
  showBranchDetail,
  showEditBranch,
  updateBranch,
  updateBranchStatus,
  attendance,
  showCreateAttendance,
  createAttendance,
  showBulkAttendance,
  createBulkAttendance,
  showSelfCheckin,
  submitSelfCheckin,
  showAttendanceDetail,
  showEditAttendance,
  updateAttendance,
  approveAttendance,
  rejectAttendance,
  projects,
  showCreateProject,
  createProject,
  showProjectDetail,
  showEditProject,
  updateProject,
  updateProjectStatus,
  assignProjectStaff,
  removeProjectAssignment,
  createProjectTask,
  updateProjectTask,
  updateProjectTaskStatus,
  activityReports,
  showCreateActivityReport,
  createActivityReport,
  showActivityReportDetail,
  showEditActivityReport,
  updateActivityReport,
  submitActivityReport,
  approveActivityReport,
  rejectActivityReport,
  addActivityReportAttachment,
  projectIndicators,
  createProjectIndicator,
  updateProjectIndicator,
  updateIndicatorProgress,
  payroll: placeholder(
    "Payroll",
    "Payroll",
    "Payroll management will be implemented in a future phase.",
    "Payroll"
  ),
  reports: placeholder(
    "Reports",
    "Reports",
    "Reporting tools will be implemented in a future phase.",
    "Reports"
  ),
  approvals,
  settingsHome,
  organizationSettings,
  saveOrganizationSettings,
  departments,
  createDepartment,
  editDepartment,
  deleteDepartment,
  users,
  showCreateUser,
  createUser,
  approvalSettings,
  saveApprovalSettings,
  auditLogs,
  licenseExpired
};
