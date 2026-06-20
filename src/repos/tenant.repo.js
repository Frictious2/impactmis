const pool = require("../db/pool");
const organizationProfileRepo = require("./organization-profile.repo");
const departmentRepo = require("./department.repo");
const userRepo = require("./user.repo");
const approvalWorkflowRepo = require("./approval-workflow.repo");
const staffRepo = require("./staff.repo");
const attendanceRepo = require("./attendance.repo");
const branchRepo = require("./branch.repo");
const projectRepo = require("./project.repo");
const activityReportRepo = require("./activity-report.repo");
const payrollRepo = require("./payroll.repo");
const financeRepo = require("./finance.repo");
const budgetRepo = require("./budget.repo");
const accountingRepo = require("./accounting.repo");
const logframeRepo = require("./logframe.repo");
const measurementRepo = require("./measurement.repo");
const surveyRepo = require("./survey.repo");
const auditLogRepo = require("./audit-log.repo");

async function findById(id, db = pool) {
  const [rows] = await db.query("SELECT * FROM tenants WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function existsByTenantCode(tenantCode, excludeId = null, db = pool) {
  const params = [tenantCode];
  let sql = "SELECT id FROM tenants WHERE tenant_code = ?";

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function existsBySlug(slug, excludeId = null, db = pool) {
  const params = [slug];
  let sql = "SELECT id FROM tenants WHERE slug = ?";

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function create(payload, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO tenants (
        name,
        tenant_code,
        slug,
        primary_domain,
        contact_name,
        contact_email,
        contact_phone,
        country,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.name,
      payload.tenant_code,
      payload.slug,
      payload.primary_domain,
      payload.contact_name,
      payload.contact_email,
      payload.contact_phone,
      payload.country,
      payload.status || "active"
    ]
  );

  return findById(result.insertId, db);
}

async function updateStatus(id, status, db = pool) {
  await db.query("UPDATE tenants SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
  return findById(id, db);
}

async function getDeveloperDashboardStats() {
  const [[totals]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM tenants) AS totalTenants,
      (
        SELECT COUNT(*)
        FROM licenses
        WHERE status = 'active'
          AND NOW() BETWEEN starts_at AND expires_at
      ) AS activeLicenses,
      (
        SELECT COUNT(*)
        FROM licenses
        WHERE status = 'active'
          AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)
      ) AS expiringLicenses,
      (
        SELECT COUNT(*)
        FROM tenants
        WHERE status = 'suspended'
      ) AS suspendedTenants
  `);

  return totals;
}

async function listForDeveloper(filters) {
  const params = [];
  const where = [];

  if (filters.search) {
    where.push("(t.name LIKE ? OR t.tenant_code LIKE ? OR COALESCE(t.contact_email, '') LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (filters.status) {
    where.push("t.status = ?");
    params.push(filters.status);
  }

  if (filters.license === "active") {
    where.push("active_license.id IS NOT NULL");
  } else if (filters.license === "expired") {
    where.push("active_license.id IS NULL AND latest_license.id IS NOT NULL");
  } else if (filters.license === "no_license") {
    where.push("latest_license.id IS NULL");
  }

  const [rows] = await pool.query(
    `
      SELECT
        t.*,
        latest_license.id AS latest_license_id,
        latest_license.plan_name AS latest_license_plan_name,
        latest_license.status AS latest_license_status,
        latest_license.expires_at AS latest_license_expires_at,
        active_license.id AS active_license_id,
        active_license.expires_at AS active_license_expires_at,
        CASE
          WHEN active_license.id IS NOT NULL THEN 'active'
          WHEN latest_license.id IS NULL THEN 'no_license'
          ELSE 'expired'
        END AS license_state
      FROM tenants t
      LEFT JOIN licenses latest_license
        ON latest_license.id = (
          SELECT l1.id
          FROM licenses l1
          WHERE l1.tenant_id = t.id
          ORDER BY l1.starts_at DESC, l1.id DESC
          LIMIT 1
        )
      LEFT JOIN licenses active_license
        ON active_license.id = (
          SELECT l2.id
          FROM licenses l2
          WHERE l2.tenant_id = t.id
            AND l2.status = 'active'
            AND NOW() BETWEEN l2.starts_at AND l2.expires_at
          ORDER BY l2.expires_at DESC, l2.id DESC
          LIMIT 1
        )
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.created_at DESC, t.id DESC
    `,
    params
  );

  return rows;
}

async function findDeveloperTenantDetailById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        t.*,
        (
          SELECT COUNT(*)
          FROM users u
          WHERE u.tenant_id = t.id
        ) AS user_count
      FROM tenants t
      WHERE t.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function getTenantDashboardStats(tenantId) {
  const auditLogCountPromise = auditLogRepo.countTenantAuditLogs(tenantId);

  const [
    organizationProfile,
    departmentCount,
    activeUserCount,
    approvalWorkflow,
    auditLogCount,
    activeStaffCount,
    activeVolunteerCount,
    todayAttendanceCount,
    pendingAttendanceApprovalsCount,
    totalBranches,
    todaySelfCheckins,
    outsideGeofenceAttempts,
    activeProjectCount,
    completedProjectCount,
    assignedProjectStaffCount,
    overdueTaskCount,
    submittedReportCount,
    pendingReportApprovalsCount,
    approvedReportsThisMonthCount,
    beneficiariesReachedThisMonth,
    pendingPayrollApprovalCount,
    currentMonthPayroll,
    expensesThisMonthCount,
    pendingExpenseApprovalsCount,
    approvedExpensesThisMonth,
    projectBudgetUtilization,
    bankAccountsCount,
    unpostedJournalsCount,
    currentMonthIncome,
    currentMonthExpenses,
    activeLogFramesCount,
    indicatorTrackSummary,
    surveySummary
  ] =
    await Promise.all([
      organizationProfileRepo.findByTenantId(tenantId),
      departmentRepo.countByTenantId(tenantId),
      userRepo.countActiveByTenantId(tenantId),
      approvalWorkflowRepo.findByTenantId(tenantId),
      auditLogCountPromise,
      staffRepo.countActiveByTenantId(tenantId),
      staffRepo.countActiveVolunteersByTenantId(tenantId),
      attendanceRepo.countTodayByTenantId(tenantId),
      attendanceRepo.countPendingApprovalsByTenantId(tenantId),
      branchRepo.countByTenantId(tenantId),
      attendanceRepo.countTodaySelfCheckinsByTenantId(tenantId),
      attendanceRepo.countOutsideGeofenceAttemptsByTenantId(tenantId),
      projectRepo.countActiveByTenantId(tenantId),
      projectRepo.countCompletedByTenantId(tenantId),
      projectRepo.countAssignedStaffByTenantId(tenantId),
      projectRepo.countOverdueTasksByTenantId(tenantId),
      activityReportRepo.countSubmittedByTenantId(tenantId),
      activityReportRepo.countPendingApprovalsByTenantId(tenantId),
      activityReportRepo.countApprovedThisMonthByTenantId(tenantId),
      activityReportRepo.sumBeneficiariesThisMonthByTenantId(tenantId),
      payrollRepo.countPendingApprovalByTenantId(tenantId),
      payrollRepo.getCurrentMonthPayrollByTenantId(tenantId),
      financeRepo.countExpensesThisMonth(tenantId),
      financeRepo.countPendingExpenseApprovals(tenantId),
      financeRepo.countApprovedExpensesThisMonth(tenantId),
      budgetRepo.getTenantBudgetUtilization(tenantId),
      accountingRepo.countBankAccounts(tenantId),
      accountingRepo.countUnpostedJournals(tenantId),
      accountingRepo.sumCurrentMonthByType(tenantId, "income"),
      accountingRepo.sumCurrentMonthByType(tenantId, "expense"),
      logframeRepo.countActiveByTenantId(tenantId),
      measurementRepo.countOnTrack(tenantId),
      surveyRepo.countResponsesByTenantId(tenantId)
    ]);

  return {
    organizationConfigured: Boolean(organizationProfile),
    departmentCount,
    activeUserCount,
    activeStaffCount,
    activeVolunteerCount,
    todayAttendanceCount,
    pendingAttendanceApprovalsCount,
    totalBranches,
    todaySelfCheckins,
    outsideGeofenceAttempts,
    activeProjectCount,
    completedProjectCount,
    assignedProjectStaffCount,
    overdueTaskCount,
    submittedReportCount,
    pendingReportApprovalsCount,
    approvedReportsThisMonthCount,
    beneficiariesReachedThisMonth,
    currentMonthPayrollStatus: currentMonthPayroll ? currentMonthPayroll.status : "not_generated",
    currentMonthPayrollNet: currentMonthPayroll ? Number(currentMonthPayroll.total_net || 0) : 0,
    pendingPayrollApprovalCount,
    expensesThisMonthCount,
    pendingExpenseApprovalsCount,
    approvedExpensesThisMonth,
    projectBudgetUtilization,
    bankAccountsCount,
    unpostedJournalsCount,
    currentMonthIncome,
    currentMonthExpenses,
    activeLogFramesCount,
    indicatorsOnTrack: indicatorTrackSummary.onTrack,
    indicatorsOffTrack: indicatorTrackSummary.offTrack,
    surveysConducted: surveySummary.surveys,
    totalSurveyResponses: surveySummary.responses,
    workflowCount: approvalWorkflow
      ? [
          approvalWorkflow.attendance_approvals,
          approvalWorkflow.payroll_approvals,
          approvalWorkflow.expense_approvals,
          approvalWorkflow.project_report_approvals,
          approvalWorkflow.staff_approvals
        ].filter((value) => Number(value) > 0).length
      : 0,
    auditLogCount
  };
}

module.exports = {
  findById,
  existsByTenantCode,
  existsBySlug,
  create,
  updateStatus,
  getDeveloperDashboardStats,
  getTenantDashboardStats,
  listForDeveloper,
  findDeveloperTenantDetailById
};
