const fs = require("fs");
const path = require("path");
const pool = require("../db/pool");
const activityReportRepo = require("../repos/activity-report.repo");
const projectRepo = require("../repos/project.repo");
const branchRepo = require("../repos/branch.repo");
const staffRepo = require("../repos/staff.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const indicatorRepo = require("../repos/indicator.repo");
const notificationService = require("./notification.service");
const { normalizeNullable } = require("../utils/tenant-form");

const APPROVER_ROLES = new Set(["Tenant Admin", "Project Manager", "Manager"]);
const HR_ROLE = "HR Manager";

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return Number(value);
}

function normalizePayload(payload) {
  return {
    report_code: normalizeNullable(payload.report_code),
    project_id: Number(payload.project_id),
    task_id: normalizeNullable(payload.task_id),
    staff_member_id: normalizeNullable(payload.staff_member_id),
    branch_id: normalizeNullable(payload.branch_id),
    report_date: payload.report_date,
    report_type: payload.report_type,
    title: String(payload.title || "").trim(),
    summary: String(payload.summary || "").trim(),
    activities_completed: normalizeNullable(payload.activities_completed),
    challenges: normalizeNullable(payload.challenges),
    recommendations: normalizeNullable(payload.recommendations),
    beneficiaries_reached: normalizeNumber(payload.beneficiaries_reached),
    male_beneficiaries: normalizeNumber(payload.male_beneficiaries),
    female_beneficiaries: normalizeNumber(payload.female_beneficiaries),
    youth_beneficiaries: normalizeNumber(payload.youth_beneficiaries),
    status: payload.status || "submitted",
    approved_by: null,
    approved_at: null,
    rejection_reason: normalizeNullable(payload.rejection_reason)
  };
}

async function generateReportCode(tenantId, db = pool) {
  const prefix = "RPT";
  const [rows] = await db.query(
    `
      SELECT report_code
      FROM activity_reports
      WHERE tenant_id = ?
        AND report_code LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [tenantId, `${prefix}-%`]
  );
  const lastCode = rows[0]?.report_code || `${prefix}-0000`;
  const lastNumber = Number(String(lastCode).split("-")[1] || 0);
  return `${prefix}-${String(lastNumber + 1).padStart(4, "0")}`;
}

async function assertProjectBelongsToTenant(tenantId, projectId, db = pool) {
  const project = await projectRepo.findProject(tenantId, projectId, db);
  if (!project) {
    const error = new Error("Selected project was not found.");
    error.statusCode = 404;
    throw error;
  }
  return project;
}

async function assertTaskBelongsToProject(tenantId, taskId, projectId, db = pool) {
  if (!taskId) {
    return null;
  }

  const task = await projectRepo.findTask(tenantId, taskId, db);
  if (!task || Number(task.project_id) !== Number(projectId)) {
    const error = new Error("Selected task was not found for this project.");
    error.statusCode = 404;
    throw error;
  }
  return task;
}

async function assertBranchBelongsToTenant(tenantId, branchId, db = pool) {
  if (!branchId) {
    return null;
  }
  const branch = await branchRepo.findByIdForTenant(branchId, tenantId, db);
  if (!branch) {
    const error = new Error("Selected branch was not found.");
    error.statusCode = 404;
    throw error;
  }
  return branch;
}

async function assertStaffBelongsToTenant(tenantId, staffId, db = pool) {
  if (!staffId) {
    return null;
  }
  const staff = await staffRepo.findStaffById(tenantId, staffId, db);
  if (!staff) {
    const error = new Error("Selected staff member was not found.");
    error.statusCode = 404;
    throw error;
  }
  return staff;
}

function assertApprovalPermission(user, report) {
  if (!user) {
    const error = new Error("You are not allowed to approve activity reports.");
    error.statusCode = 403;
    throw error;
  }

  if (APPROVER_ROLES.has(user.role)) {
    return;
  }

  if (user.role === HR_ROLE && report.staff_member_id) {
    return;
  }

  const error = new Error("You are not allowed to approve activity reports.");
  error.statusCode = 403;
  throw error;
}

async function assertStaffSelfReportingRule(tenantId, currentUser, payload, db = pool) {
  if (!currentUser || !["Staff", "Volunteer"].includes(currentUser.role)) {
    return;
  }

  const linkedStaff = await staffRepo.findActiveByEmailForTenant(tenantId, currentUser.email, db);
  if (!linkedStaff) {
    const error = new Error("Your user account is not linked to an active staff record.");
    error.statusCode = 403;
    throw error;
  }

  if (!payload.staff_member_id || Number(payload.staff_member_id) !== Number(linkedStaff.id)) {
    const error = new Error("You can only create reports for your own staff record.");
    error.statusCode = 403;
    throw error;
  }
}

async function listReports(tenantId, filters) {
  return activityReportRepo.listReports(tenantId, filters);
}

async function findReportById(tenantId, id) {
  return activityReportRepo.findReportById(tenantId, id);
}

async function createReport(tenantId, payload, currentUser, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const normalized = normalizePayload(payload);
    await assertStaffSelfReportingRule(tenantId, currentUser, normalized, connection);
    const project = await assertProjectBelongsToTenant(tenantId, normalized.project_id, connection);
    await assertTaskBelongsToProject(tenantId, normalized.task_id, normalized.project_id, connection);
    await assertStaffBelongsToTenant(tenantId, normalized.staff_member_id, connection);
    await assertBranchBelongsToTenant(tenantId, normalized.branch_id, connection);

    normalized.report_code = normalized.report_code || (await generateReportCode(tenantId, connection));
    const report = await activityReportRepo.createReport(tenantId, normalized, currentUser.id, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: currentUser.id,
        action: "activity_report.created",
        entity_type: "activity_report",
        entity_id: String(report.id),
        metadata_json: {
          report_id: report.id,
          report_code: report.report_code,
          project_id: report.project_id
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    if (report.status === "submitted") {
      notificationService.notifyRoles(tenantId, ["Tenant Admin", "Project Manager"], {
        title: "Activity report submitted",
        message: `${report.report_code} is waiting for review.`,
        type: "info",
        category: "activity_report",
        link_url: `/activity-reports/${report.id}`,
        created_by: currentUser.id
      });
    }
    return report;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateReport(tenantId, id, payload, currentUser, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await activityReportRepo.findReportById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Activity report not found.");
      error.statusCode = 404;
      throw error;
    }

    const normalized = normalizePayload(payload);
    await assertStaffSelfReportingRule(tenantId, currentUser, normalized, connection);
    await assertProjectBelongsToTenant(tenantId, normalized.project_id, connection);
    await assertTaskBelongsToProject(tenantId, normalized.task_id, normalized.project_id, connection);
    await assertStaffBelongsToTenant(tenantId, normalized.staff_member_id, connection);
    await assertBranchBelongsToTenant(tenantId, normalized.branch_id, connection);
    normalized.report_code = normalized.report_code || existing.report_code;

    const report = await activityReportRepo.updateReport(tenantId, id, normalized, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: currentUser.id,
        action: "activity_report.updated",
        entity_type: "activity_report",
        entity_id: String(report.id),
        metadata_json: {
          report_id: report.id,
          report_code: report.report_code,
          project_id: report.project_id
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    notificationService.notifyRoles(tenantId, ["Tenant Admin", "Project Manager"], {
      title: "Activity report submitted",
      message: `${report.report_code} is waiting for review.`,
      type: "info",
      category: "activity_report",
      link_url: `/activity-reports/${report.id}`,
      created_by: userId
    });
    return report;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function submitReport(tenantId, id, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await activityReportRepo.findReportById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Activity report not found.");
      error.statusCode = 404;
      throw error;
    }
    if (existing.status === "approved") {
      const error = new Error("Approved reports cannot be resubmitted.");
      error.statusCode = 422;
      throw error;
    }
    if (existing.status === "submitted") {
      const error = new Error("This report has already been submitted.");
      error.statusCode = 422;
      throw error;
    }
    const report = await activityReportRepo.updateReport(
      tenantId,
      id,
      { ...existing, status: "submitted", approved_by: null, approved_at: null, rejection_reason: null },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "activity_report.submitted",
        entity_type: "activity_report",
        entity_id: String(report.id),
        metadata_json: { report_id: report.id, report_code: report.report_code, project_id: report.project_id },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    notificationService.safeUserNotification(tenantId, existing.submitted_by, {
      title: "Activity report approved",
      message: `${report.report_code} was approved.`,
      type: "success",
      category: "activity_report",
      link_url: `/activity-reports/${report.id}`,
      created_by: approver.id
    });
    return report;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function approveReport(tenantId, id, approver, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await activityReportRepo.findReportById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Activity report not found.");
      error.statusCode = 404;
      throw error;
    }
    if (existing.status !== "submitted") {
      const error = new Error("Only submitted reports can be approved.");
      error.statusCode = 422;
      throw error;
    }
    assertApprovalPermission(approver, existing);
    const report = await activityReportRepo.updateReport(
      tenantId,
      id,
      { ...existing, status: "approved", approved_by: approver.id, approved_at: new Date(), rejection_reason: null },
      connection
    );
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: approver.id,
        action: "activity_report.approved",
        entity_type: "activity_report",
        entity_id: String(report.id),
        metadata_json: { report_id: report.id, report_code: report.report_code, project_id: report.project_id },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    notificationService.safeUserNotification(tenantId, existing.submitted_by, {
      title: "Activity report rejected",
      message: `${report.report_code} was rejected.`,
      type: "danger",
      category: "activity_report",
      link_url: `/activity-reports/${report.id}`,
      created_by: approver.id
    });
    return report;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function rejectReport(tenantId, id, approver, reason, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await activityReportRepo.findReportById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Activity report not found.");
      error.statusCode = 404;
      throw error;
    }
    if (existing.status !== "submitted") {
      const error = new Error("Only submitted reports can be rejected.");
      error.statusCode = 422;
      throw error;
    }
    assertApprovalPermission(approver, existing);
    const report = await activityReportRepo.updateReport(
      tenantId,
      id,
      { ...existing, status: "rejected", approved_by: approver.id, approved_at: null, rejection_reason: reason },
      connection
    );
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: approver.id,
        action: "activity_report.rejected",
        entity_type: "activity_report",
        entity_id: String(report.id),
        metadata_json: { report_id: report.id, report_code: report.report_code, project_id: report.project_id },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    return report;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function addAttachment(tenantId, reportId, file, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const report = await activityReportRepo.findReportById(tenantId, reportId, connection);
    if (!report) {
      const error = new Error("Activity report not found.");
      error.statusCode = 404;
      throw error;
    }
    const attachment = await activityReportRepo.addAttachment(tenantId, reportId, file, userId, connection);
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "activity_report.attachment_added",
        entity_type: "activity_report_attachment",
        entity_id: String(attachment.id),
        metadata_json: { report_id: report.id, report_code: report.report_code, project_id: report.project_id },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    return attachment;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listAttachments(tenantId, reportId) {
  return activityReportRepo.listAttachments(tenantId, reportId);
}

async function listReportIndicatorUpdates(tenantId, reportId) {
  const report = await activityReportRepo.findReportById(tenantId, reportId);
  if (!report) {
    return [];
  }
  return indicatorRepo.listUpdatesByReportId(tenantId, reportId);
}

function ensureUploadDirectory(tenantId) {
  const relativeDir = path.join("uploads", "activity-reports", String(tenantId));
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  fs.mkdirSync(absoluteDir, { recursive: true });
  return { relativeDir, absoluteDir };
}

module.exports = {
  APPROVER_ROLES,
  HR_ROLE,
  listReports,
  findReportById,
  createReport,
  updateReport,
  submitReport,
  approveReport,
  rejectReport,
  addAttachment,
  listAttachments,
  listReportIndicatorUpdates,
  ensureUploadDirectory
};
