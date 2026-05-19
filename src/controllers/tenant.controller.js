const { validationResult } = require("express-validator");
const tenantRepo = require("../repos/tenant.repo");
const organizationProfileRepo = require("../repos/organization-profile.repo");
const departmentRepo = require("../repos/department.repo");
const userRepo = require("../repos/user.repo");
const roleRepo = require("../repos/role.repo");
const approvalWorkflowRepo = require("../repos/approval-workflow.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const staffService = require("../services/staff.service");
const attendanceService = require("../services/attendance.service");
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
  buildAttendanceFormData,
  buildAttendanceFilters,
  getAttendanceStatusOptions,
  getAttendanceApprovalOptions
} = require("../utils/attendance-form");

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

function renderNotFound(res, title) {
  return res.status(404).render("pages/errors/404", { pageTitle: title });
}

async function dashboard(req, res, next) {
  try {
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
    const departmentsList = await departmentRepo.listByTenantId(req.currentUser.tenant_id);

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
      const departmentsList = await departmentRepo.listByTenantId(req.currentUser.tenant_id);
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
    const [staffMember, departmentsList] = await Promise.all([
      staffService.findStaffById(req.currentUser.tenant_id, req.params.id),
      departmentRepo.listByTenantId(req.currentUser.tenant_id)
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
    const [staffMember, departmentsList] = await Promise.all([
      staffService.findStaffById(req.currentUser.tenant_id, req.params.id),
      departmentRepo.listByTenantId(req.currentUser.tenant_id)
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
    const logs = await auditLogRepo.listByTenantId(req.currentUser.tenant_id, 100);

    return res.render("layouts/tenant-layout", {
      pageTitle: "Audit Logs",
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
  attendance,
  showCreateAttendance,
  createAttendance,
  showBulkAttendance,
  createBulkAttendance,
  showAttendanceDetail,
  showEditAttendance,
  updateAttendance,
  approveAttendance,
  rejectAttendance,
  projects: placeholder(
    "Projects",
    "Projects",
    "Project management will be implemented in a future phase.",
    "Projects"
  ),
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
  approvals: placeholder(
    "Approvals",
    "Approvals",
    "Business approval workflows will be implemented in a future phase.",
    "Approvals"
  ),
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
