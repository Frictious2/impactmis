const pool = require("../db/pool");

async function listReports(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["ar.tenant_id = ?"];

  if (filters.project_id) {
    where.push("ar.project_id = ?");
    params.push(filters.project_id);
  }
  if (filters.branch_id) {
    where.push("ar.branch_id = ?");
    params.push(filters.branch_id);
  }
  if (filters.staff_member_id) {
    where.push("ar.staff_member_id = ?");
    params.push(filters.staff_member_id);
  }
  if (filters.report_type) {
    where.push("ar.report_type = ?");
    params.push(filters.report_type);
  }
  if (filters.status) {
    where.push("ar.status = ?");
    params.push(filters.status);
  }
  if (filters.date_from) {
    where.push("ar.report_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("ar.report_date <= ?");
    params.push(filters.date_to);
  }

  const [rows] = await db.query(
    `
      SELECT
        ar.*,
        p.project_code,
        p.project_name,
        pt.title AS task_title,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS staff_name,
        sm.staff_code,
        b.name AS branch_name,
        submitter.full_name AS submitted_by_name,
        approver.full_name AS approved_by_name
      FROM activity_reports ar
      INNER JOIN projects p ON p.id = ar.project_id AND p.tenant_id = ar.tenant_id
      LEFT JOIN project_tasks pt ON pt.id = ar.task_id AND pt.tenant_id = ar.tenant_id
      LEFT JOIN staff_members sm ON sm.id = ar.staff_member_id AND sm.tenant_id = ar.tenant_id
      LEFT JOIN branches b ON b.id = ar.branch_id AND b.tenant_id = ar.tenant_id
      LEFT JOIN users submitter ON submitter.id = ar.submitted_by
      LEFT JOIN users approver ON approver.id = ar.approved_by
      WHERE ${where.join(" AND ")}
      ORDER BY ar.report_date DESC, ar.id DESC
    `,
    params
  );

  return rows;
}

async function findReportById(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        ar.*,
        p.project_code,
        p.project_name,
        pt.title AS task_title,
        pt.project_id AS task_project_id,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS staff_name,
        sm.staff_code,
        b.name AS branch_name,
        submitter.full_name AS submitted_by_name,
        approver.full_name AS approved_by_name
      FROM activity_reports ar
      INNER JOIN projects p ON p.id = ar.project_id AND p.tenant_id = ar.tenant_id
      LEFT JOIN project_tasks pt ON pt.id = ar.task_id AND pt.tenant_id = ar.tenant_id
      LEFT JOIN staff_members sm ON sm.id = ar.staff_member_id AND sm.tenant_id = ar.tenant_id
      LEFT JOIN branches b ON b.id = ar.branch_id AND b.tenant_id = ar.tenant_id
      LEFT JOIN users submitter ON submitter.id = ar.submitted_by
      LEFT JOIN users approver ON approver.id = ar.approved_by
      WHERE ar.tenant_id = ?
        AND ar.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );

  return rows[0] || null;
}

async function findByCode(tenantId, reportCode, excludeId = null, db = pool) {
  const params = [tenantId, reportCode];
  let sql = "SELECT id FROM activity_reports WHERE tenant_id = ? AND report_code = ?";
  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function createReport(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO activity_reports (
        tenant_id, report_code, project_id, task_id, staff_member_id, branch_id,
        report_date, report_type, title, summary, activities_completed, challenges,
        recommendations, beneficiaries_reached, male_beneficiaries, female_beneficiaries,
        youth_beneficiaries, status, submitted_by, approved_by, approved_at, rejection_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.report_code,
      payload.project_id,
      payload.task_id,
      payload.staff_member_id,
      payload.branch_id,
      payload.report_date,
      payload.report_type,
      payload.title,
      payload.summary,
      payload.activities_completed,
      payload.challenges,
      payload.recommendations,
      payload.beneficiaries_reached,
      payload.male_beneficiaries,
      payload.female_beneficiaries,
      payload.youth_beneficiaries,
      payload.status,
      userId,
      payload.approved_by || null,
      payload.approved_at || null,
      payload.rejection_reason || null
    ]
  );

  return findReportById(tenantId, result.insertId, db);
}

async function updateReport(tenantId, id, payload, db = pool) {
  await db.query(
    `
      UPDATE activity_reports
      SET
        report_code = ?,
        project_id = ?,
        task_id = ?,
        staff_member_id = ?,
        branch_id = ?,
        report_date = ?,
        report_type = ?,
        title = ?,
        summary = ?,
        activities_completed = ?,
        challenges = ?,
        recommendations = ?,
        beneficiaries_reached = ?,
        male_beneficiaries = ?,
        female_beneficiaries = ?,
        youth_beneficiaries = ?,
        status = ?,
        approved_by = ?,
        approved_at = ?,
        rejection_reason = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.report_code,
      payload.project_id,
      payload.task_id,
      payload.staff_member_id,
      payload.branch_id,
      payload.report_date,
      payload.report_type,
      payload.title,
      payload.summary,
      payload.activities_completed,
      payload.challenges,
      payload.recommendations,
      payload.beneficiaries_reached,
      payload.male_beneficiaries,
      payload.female_beneficiaries,
      payload.youth_beneficiaries,
      payload.status,
      payload.approved_by || null,
      payload.approved_at || null,
      payload.rejection_reason || null,
      tenantId,
      id
    ]
  );

  return findReportById(tenantId, id, db);
}

async function addAttachment(tenantId, reportId, file, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO activity_report_attachments (
        tenant_id, activity_report_id, original_name, stored_name, file_path, mime_type, file_size, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      reportId,
      file.original_name,
      file.stored_name,
      file.file_path,
      file.mime_type,
      file.file_size,
      userId
    ]
  );

  const [rows] = await db.query(
    "SELECT * FROM activity_report_attachments WHERE id = ? LIMIT 1",
    [result.insertId]
  );
  return rows[0] || null;
}

async function listAttachments(tenantId, reportId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        ara.*,
        u.full_name AS uploaded_by_name
      FROM activity_report_attachments ara
      LEFT JOIN users u ON u.id = ara.uploaded_by
      WHERE ara.tenant_id = ?
        AND ara.activity_report_id = ?
      ORDER BY ara.created_at DESC, ara.id DESC
    `,
    [tenantId, reportId]
  );
  return rows;
}

async function countSubmittedByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM activity_reports WHERE tenant_id = ? AND status = 'submitted'",
    [tenantId]
  );
  return row.total;
}

async function countPendingApprovalsByTenantId(tenantId, db = pool) {
  return countSubmittedByTenantId(tenantId, db);
}

async function countApprovedThisMonthByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM activity_reports
      WHERE tenant_id = ?
        AND status = 'approved'
        AND approved_at IS NOT NULL
        AND YEAR(approved_at) = YEAR(CURDATE())
        AND MONTH(approved_at) = MONTH(CURDATE())
    `,
    [tenantId]
  );
  return row.total;
}

async function sumBeneficiariesThisMonthByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COALESCE(SUM(beneficiaries_reached), 0) AS total
      FROM activity_reports
      WHERE tenant_id = ?
        AND status = 'approved'
        AND YEAR(report_date) = YEAR(CURDATE())
        AND MONTH(report_date) = MONTH(CURDATE())
    `,
    [tenantId]
  );
  return Number(row.total || 0);
}

async function listByProjectId(tenantId, projectId, limit = 10, db = pool) {
  const [rows] = await db.query(
    `
      SELECT id, report_code, title, report_date, report_type, status, beneficiaries_reached
      FROM activity_reports
      WHERE tenant_id = ?
        AND project_id = ?
      ORDER BY report_date DESC, id DESC
      LIMIT ?
    `,
    [tenantId, projectId, Number(limit)]
  );
  return rows;
}

async function countByProjectId(tenantId, projectId, db = pool) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM activity_reports WHERE tenant_id = ? AND project_id = ?",
    [tenantId, projectId]
  );
  return row.total;
}

module.exports = {
  listReports,
  findReportById,
  findByCode,
  createReport,
  updateReport,
  addAttachment,
  listAttachments,
  countSubmittedByTenantId,
  countPendingApprovalsByTenantId,
  countApprovedThisMonthByTenantId,
  sumBeneficiariesThisMonthByTenantId,
  listByProjectId,
  countByProjectId
};
