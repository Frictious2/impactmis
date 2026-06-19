const pool = require("../db/pool");

async function getDashboardMetrics(tenantId, db = pool) {
  const [[metrics]] = await db.query(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM projects p
          WHERE p.tenant_id = ?
            AND p.status IN ('active', 'completed')
        ) AS active_project_count,
        (
          SELECT COUNT(*)
          FROM activity_reports ar
          WHERE ar.tenant_id = ?
            AND ar.status = 'approved'
        ) AS approved_report_count,
        (
          SELECT COALESCE(SUM(ar.beneficiaries_reached), 0)
          FROM activity_reports ar
          WHERE ar.tenant_id = ?
            AND ar.status = 'approved'
            AND YEAR(ar.report_date) = YEAR(CURDATE())
            AND MONTH(ar.report_date) = MONTH(CURDATE())
        ) AS beneficiaries_reached_this_month,
        (
          SELECT COUNT(*)
          FROM project_indicators pi
          INNER JOIN projects p ON p.id = pi.project_id AND p.tenant_id = pi.tenant_id
          WHERE pi.tenant_id = ?
            AND p.status IN ('active', 'completed')
            AND pi.status = 'active'
            AND (
              pi.target_value = 0
              OR pi.current_value >= pi.target_value
            )
        ) AS indicators_on_track
    `,
    [tenantId, tenantId, tenantId, tenantId]
  );

  const [reportsByProject] = await db.query(
    `
      SELECT
        p.id,
        p.project_code,
        p.project_name,
        COUNT(ar.id) AS approved_report_count
      FROM projects p
      LEFT JOIN activity_reports ar
        ON ar.project_id = p.id
       AND ar.tenant_id = p.tenant_id
       AND ar.status = 'approved'
      WHERE p.tenant_id = ?
        AND p.status IN ('active', 'completed')
      GROUP BY p.id, p.project_code, p.project_name
      ORDER BY approved_report_count DESC, p.project_name ASC
      LIMIT 8
    `,
    [tenantId]
  );

  const [beneficiariesByMonth] = await db.query(
    `
      SELECT
        DATE_FORMAT(ar.report_date, '%Y-%m') AS month_key,
        DATE_FORMAT(ar.report_date, '%b %Y') AS month_label,
        COALESCE(SUM(ar.beneficiaries_reached), 0) AS beneficiaries_reached
      FROM activity_reports ar
      WHERE ar.tenant_id = ?
        AND ar.status = 'approved'
      GROUP BY DATE_FORMAT(ar.report_date, '%Y-%m'), DATE_FORMAT(ar.report_date, '%b %Y')
      ORDER BY month_key DESC
      LIMIT 6
    `,
    [tenantId]
  );

  const [indicatorSummary] = await db.query(
    `
      SELECT
        p.project_code,
        p.project_name,
        COUNT(pi.id) AS indicator_count,
        SUM(
          CASE
            WHEN pi.target_value = 0 OR pi.current_value >= pi.target_value THEN 1
            ELSE 0
          END
        ) AS indicators_on_track
      FROM projects p
      LEFT JOIN project_indicators pi
        ON pi.project_id = p.id
       AND pi.tenant_id = p.tenant_id
       AND pi.status = 'active'
      WHERE p.tenant_id = ?
        AND p.status IN ('active', 'completed')
      GROUP BY p.id, p.project_code, p.project_name
      ORDER BY p.project_name ASC
      LIMIT 8
    `,
    [tenantId]
  );

  return {
    activeProjectCount: Number(metrics.active_project_count || 0),
    approvedReportCount: Number(metrics.approved_report_count || 0),
    beneficiariesReachedThisMonth: Number(metrics.beneficiaries_reached_this_month || 0),
    indicatorsOnTrack: Number(metrics.indicators_on_track || 0),
    reportsByProject,
    beneficiariesByMonth: beneficiariesByMonth.reverse(),
    indicatorSummary
  };
}

async function listProjects(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["p.tenant_id = ?", "p.status IN ('active', 'completed')"];

  if (filters.status) {
    where.push("p.status = ?");
    params.push(filters.status);
  }

  if (filters.branch_id) {
    where.push("p.branch_id = ?");
    params.push(filters.branch_id);
  }

  const [rows] = await db.query(
    `
      SELECT
        p.id,
        p.project_code,
        p.project_name,
        p.project_description,
        p.donor_name,
        p.start_date,
        p.end_date,
        p.status,
        p.completion_percentage,
        b.name AS branch_name
      FROM projects p
      LEFT JOIN branches b
        ON b.id = p.branch_id
       AND b.tenant_id = p.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.start_date DESC, p.id DESC
    `,
    params
  );

  return rows;
}

async function findProjectById(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        p.id,
        p.project_code,
        p.project_name,
        p.project_description,
        p.donor_name,
        p.start_date,
        p.end_date,
        p.status,
        p.completion_percentage,
        b.id AS branch_id,
        b.name AS branch_name
      FROM projects p
      LEFT JOIN branches b
        ON b.id = p.branch_id
       AND b.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
        AND p.id = ?
        AND p.status IN ('active', 'completed')
      LIMIT 1
    `,
    [tenantId, id]
  );

  return rows[0] || null;
}

async function listApprovedReports(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["ar.tenant_id = ?", "ar.status = 'approved'"];

  if (filters.project_id) {
    where.push("ar.project_id = ?");
    params.push(filters.project_id);
  }

  if (filters.report_type) {
    where.push("ar.report_type = ?");
    params.push(filters.report_type);
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
        ar.id,
        ar.report_code,
        ar.project_id,
        ar.branch_id,
        ar.report_date,
        ar.report_type,
        ar.title,
        ar.summary,
        ar.activities_completed,
        ar.challenges,
        ar.recommendations,
        ar.beneficiaries_reached,
        ar.male_beneficiaries,
        ar.female_beneficiaries,
        ar.youth_beneficiaries,
        ar.approved_at,
        p.project_code,
        p.project_name,
        b.name AS branch_name
      FROM activity_reports ar
      INNER JOIN projects p
        ON p.id = ar.project_id
       AND p.tenant_id = ar.tenant_id
       AND p.status IN ('active', 'completed')
      LEFT JOIN branches b
        ON b.id = ar.branch_id
       AND b.tenant_id = ar.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY ar.report_date DESC, ar.id DESC
    `,
    params
  );

  return rows;
}

async function findApprovedReportById(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        ar.id,
        ar.report_code,
        ar.project_id,
        ar.branch_id,
        ar.report_date,
        ar.report_type,
        ar.title,
        ar.summary,
        ar.activities_completed,
        ar.challenges,
        ar.recommendations,
        ar.beneficiaries_reached,
        ar.male_beneficiaries,
        ar.female_beneficiaries,
        ar.youth_beneficiaries,
        ar.approved_at,
        p.project_code,
        p.project_name,
        b.name AS branch_name
      FROM activity_reports ar
      INNER JOIN projects p
        ON p.id = ar.project_id
       AND p.tenant_id = ar.tenant_id
       AND p.status IN ('active', 'completed')
      LEFT JOIN branches b
        ON b.id = ar.branch_id
       AND b.tenant_id = ar.tenant_id
      WHERE ar.tenant_id = ?
        AND ar.id = ?
        AND ar.status = 'approved'
      LIMIT 1
    `,
    [tenantId, id]
  );

  return rows[0] || null;
}

async function listReportAttachments(tenantId, reportId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        ara.id,
        ara.original_name,
        ara.file_path,
        ara.mime_type,
        ara.file_size,
        ara.created_at
      FROM activity_report_attachments ara
      INNER JOIN activity_reports ar
        ON ar.id = ara.activity_report_id
       AND ar.tenant_id = ara.tenant_id
       AND ar.status = 'approved'
      WHERE ara.tenant_id = ?
        AND ara.activity_report_id = ?
      ORDER BY ara.created_at DESC, ara.id DESC
    `,
    [tenantId, reportId]
  );

  return rows;
}

async function listIndicators(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["pi.tenant_id = ?", "p.status IN ('active', 'completed')"];

  if (filters.project_id) {
    where.push("pi.project_id = ?");
    params.push(filters.project_id);
  }

  const [rows] = await db.query(
    `
      SELECT
        pi.id,
        pi.project_id,
        pi.indicator_name,
        pi.target_value,
        pi.current_value,
        pi.unit,
        pi.status,
        p.project_code,
        p.project_name
      FROM project_indicators pi
      INNER JOIN projects p
        ON p.id = pi.project_id
       AND p.tenant_id = pi.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.project_name ASC, pi.indicator_name ASC
    `,
    params
  );

  return rows;
}

async function listProjectIndicators(tenantId, projectId, db = pool) {
  return listIndicators(tenantId, { project_id: projectId }, db);
}

async function getBeneficiarySummary(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["ar.tenant_id = ?", "ar.status = 'approved'"];

  if (filters.project_id) {
    where.push("ar.project_id = ?");
    params.push(filters.project_id);
  }

  if (filters.branch_id) {
    where.push("ar.branch_id = ?");
    params.push(filters.branch_id);
  }

  if (filters.date_from) {
    where.push("ar.report_date >= ?");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push("ar.report_date <= ?");
    params.push(filters.date_to);
  }

  const [totalsRows] = await db.query(
    `
      SELECT
        COALESCE(SUM(ar.beneficiaries_reached), 0) AS total_beneficiaries,
        COALESCE(SUM(ar.male_beneficiaries), 0) AS male_beneficiaries,
        COALESCE(SUM(ar.female_beneficiaries), 0) AS female_beneficiaries,
        COALESCE(SUM(ar.youth_beneficiaries), 0) AS youth_beneficiaries
      FROM activity_reports ar
      INNER JOIN projects p
        ON p.id = ar.project_id
       AND p.tenant_id = ar.tenant_id
       AND p.status IN ('active', 'completed')
      WHERE ${where.join(" AND ")}
    `,
    params
  );

  const [byProject] = await db.query(
    `
      SELECT
        p.id AS project_id,
        p.project_code,
        p.project_name,
        COALESCE(SUM(ar.beneficiaries_reached), 0) AS beneficiaries_reached,
        COALESCE(SUM(ar.male_beneficiaries), 0) AS male_beneficiaries,
        COALESCE(SUM(ar.female_beneficiaries), 0) AS female_beneficiaries,
        COALESCE(SUM(ar.youth_beneficiaries), 0) AS youth_beneficiaries
      FROM activity_reports ar
      INNER JOIN projects p
        ON p.id = ar.project_id
       AND p.tenant_id = ar.tenant_id
       AND p.status IN ('active', 'completed')
      WHERE ${where.join(" AND ")}
      GROUP BY p.id, p.project_code, p.project_name
      ORDER BY beneficiaries_reached DESC, p.project_name ASC
    `,
    params
  );

  const [byMonth] = await db.query(
    `
      SELECT
        DATE_FORMAT(ar.report_date, '%Y-%m') AS month_key,
        DATE_FORMAT(ar.report_date, '%b %Y') AS month_label,
        COALESCE(SUM(ar.beneficiaries_reached), 0) AS beneficiaries_reached
      FROM activity_reports ar
      INNER JOIN projects p
        ON p.id = ar.project_id
       AND p.tenant_id = ar.tenant_id
       AND p.status IN ('active', 'completed')
      WHERE ${where.join(" AND ")}
      GROUP BY DATE_FORMAT(ar.report_date, '%Y-%m'), DATE_FORMAT(ar.report_date, '%b %Y')
      ORDER BY month_key DESC
      LIMIT 12
    `,
    params
  );

  const [byBranch] = await db.query(
    `
      SELECT
        b.id AS branch_id,
        COALESCE(b.name, 'Unassigned') AS branch_name,
        COUNT(DISTINCT ar.project_id) AS project_count,
        COALESCE(SUM(ar.beneficiaries_reached), 0) AS beneficiaries_reached
      FROM activity_reports ar
      INNER JOIN projects p
        ON p.id = ar.project_id
       AND p.tenant_id = ar.tenant_id
       AND p.status IN ('active', 'completed')
      LEFT JOIN branches b
        ON b.id = ar.branch_id
       AND b.tenant_id = ar.tenant_id
      WHERE ${where.join(" AND ")}
      GROUP BY b.id, branch_name
      ORDER BY beneficiaries_reached DESC, branch_name ASC
    `,
    params
  );

  return {
    totals: {
      totalBeneficiaries: Number(totalsRows[0]?.total_beneficiaries || 0),
      maleBeneficiaries: Number(totalsRows[0]?.male_beneficiaries || 0),
      femaleBeneficiaries: Number(totalsRows[0]?.female_beneficiaries || 0),
      youthBeneficiaries: Number(totalsRows[0]?.youth_beneficiaries || 0)
    },
    byProject,
    byMonth: byMonth.reverse(),
    byBranch
  };
}

module.exports = {
  getDashboardMetrics,
  listProjects,
  findProjectById,
  listApprovedReports,
  findApprovedReportById,
  listReportAttachments,
  listIndicators,
  listProjectIndicators,
  getBeneficiarySummary
};
